import {
  type FUniver,
  type IMutationInfo,
  type IUndoRedoItem,
  IUndoRedoService,
  type IWorkbookData,
  type Univer,
} from "@univerjs/presets";

import type {
  SheetEntry,
  SheetMutation,
  SheetReceivedMessage,
  SheetSentMessage,
  SheetSnapshot,
} from "@/server/do/sheet";

import {gunzipText, gzipText, PACK_OVER_CHARS} from "./sheet-compress";
import {isPersonalMutation, withoutPersonalState} from "./sheet-filters";
import {fingerprint} from "./sheet-fingerprint";
import {isStructural, setSheetNameResolver, setStyleResolver, transform} from "./sheet-ot";

// After this many log entries, a client uploads a snapshot so newcomers don't replay them all.
const SNAPSHOT_EVERY = 100;
// Every this many entries, idle clients compare fingerprints of their workbooks (see
// sheet-fingerprint.ts), so one that drifted is caught and rebuilt.
const CHECK_EVERY = 50;
// The room accepts WebSocket messages up to 32 MiB: a single edit bigger than this (a huge paste)
// can't be sent at all, so it's undone here instead of silently never reaching anyone.
export const MAX_MUTATION_BYTES = 30 * 1024 * 1024;
// Several edits waiting together go out in batches of about this much, so one huge paste doesn't
// hold up everything typed after it.
const BATCH_BUDGET_CHARS = 2 * 1024 * 1024;

/** A mutation's size on the wire, in bytes (only measured exactly when it could matter). */
export function wireBytes(json: string) {
  // UTF-8 is at most 3 bytes per UTF-16 unit, so short strings can't be near the limit.
  return json.length * 3 < MAX_MUTATION_BYTES ? json.length : new TextEncoder().encode(json).length;
}

/** Every client must build the same empty workbook (same ids), since mutations name them. */
function emptyWorkbook(unitId: string): Partial<IWorkbookData> {
  return {
    id: unitId,
    name: "Puzzle",
    sheetOrder: ["sheet1"],
    sheets: {sheet1: {id: "sheet1", name: "Sheet1", rowCount: 200, columnCount: 26}},
  };
}

/** A snapshot is Univer's own workbook JSON, uploaded by a client; the room only stores it. */
function parseWorkbook(data: string): Partial<IWorkbookData> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Univer's JSON, stored untouched.
  return JSON.parse(data) as Partial<IWorkbookData>;
}

/** Whether a mutation's params name this workbook (`unitId`). */
export function isForUnit(params: unknown, unitId: string) {
  return typeof params === "object" && params !== null && "unitId" in params
    ? params.unitId === unitId
    : false;
}

/**
 * Problems worth reporting: a teammate's edit that failed here, or edits made offline that had
 * to be redone on top of the room's copy without knowing everything that changed meanwhile.
 */
export type SyncProblem =
  | {kind: "apply-failed"; mutationId: string; error: unknown}
  | {kind: "offline-edits-rebased"};

/** The undo and redo stacks, which LocalUndoRedoService keeps per unit (protected API). */
type UndoStacks = {
  _getUndoStack(unitId: string): IUndoRedoItem[] | null;
  _getRedoStack(unitId: string): IUndoRedoItem[] | null;
  _updateStatus(): void;
};

/**
 * Keeps a Univer workbook in sync with its SheetRoom (see that file for the protocol).
 *
 * Local edits are applied at once. They wait in `buffer` until no batch is in flight, then go out
 * as one batch made on top of `confirmedSeq`. A teammate's entry that arrives meanwhile was
 * ordered before ours, so it's transformed over our unconfirmed edits before it's applied here,
 * and our unconfirmed edits (and our undo history) are transformed over it, so they still mean
 * the same cells when they're sent or undone.
 */
export class SheetSync {
  /** The last room entry this workbook includes. */
  confirmedSeq = 0;
  /** Sent, not yet confirmed (at most one batch). */
  /** The batch sent and not yet confirmed, and every entry it was sent on top of. */
  private inflight: {batchId: string; mutations: SheetMutation[]; baseSeqs: number[]} | null = null;
  /** Applied here, not yet sent. */
  private buffer: SheetMutation[] = [];
  /** The current command's mutations (a command makes several in a row), until it's done. */
  private command: SheetMutation[] = [];
  private commandTooBig = false;
  /** False until the first `init`, and while rebuilding after a resync: nothing is sent. */
  ready = false;
  /** Whether a workbook was ever loaded: edits made since are kept, even while resyncing. */
  loaded = false;
  /** True while the workbook is rebuilt from the room's copy (those mutations aren't edits). */
  private rebuilding = false;
  /** The latest stored snapshot (so the next is taken about SNAPSHOT_EVERY entries later). */
  private lastSnapshotSeq = 0;
  /** Where this client last uploaded one (not to upload again before it's stored). */
  private snapshotSentSeq = 0;

  constructor(
    private readonly univer: Univer,
    private readonly api: FUniver,
    private readonly unitId: string,
    private readonly send: (message: SheetSentMessage) => void,
    private readonly hooks: {
      /** Teammates' mutations, after they've been applied here. */
      onRemoteApplied: (mutations: SheetMutation[]) => void;
      /** Whether some of this person's edits haven't reached the room yet. */
      onPendingChange: (pending: boolean) => void;
      /** A command was too big to send, and was reverted here (or couldn't be: `reverted`). */
      onTooBig: (reverted: boolean) => void;
      /** The workbook was (re)built from the room's copy (a snapshot, then `entries`). */
      onWorkbookLoaded: (entries: SheetEntry[]) => void;
      /** The room found this workbook had drifted; it's being rebuilt (unsent edits are kept). */
      onResync: () => void;
      /** Something went wrong that the person may not notice (for error reporting). */
      onProblem: (problem: SyncProblem) => void;
    }
  ) {
    // Formulas name sheets; transforms need their ids.
    setSheetNameResolver(name =>
      this.api.getWorkbook(this.unitId)?.getSheetByName(name)?.getSheetId()
    );
    // Cell writes may name a stored style; transforms need its keys.
    setStyleResolver(id => this.api.getWorkbook(this.unitId)?.getWorkbook().getStyles().get(id));
  }

  /** Whether some of this person's edits haven't been confirmed by the room yet. */
  get pending() {
    return this.inflight !== null || this.buffer.length > 0 || this.command.length > 0;
  }

  /** What to ask the room for on (re)connecting: entries after this one. */
  hello(): SheetSentMessage {
    return this.helloFrom(this.ready ? this.confirmedSeq : 0);
  }

  /** Also names the unconfirmed batch, so the room can say whether it already took it. */
  private helloFrom(since: number): SheetSentMessage {
    const inflight = this.inflight;
    return inflight
      ? {
          type: "hello",
          since,
          inflight: {batchId: inflight.batchId, baseSeqs: inflight.baseSeqs.slice(-50)},
        }
      : {type: "hello", since};
  }

  /** Messages are handled one at a time, in order (unpacking a large one takes a moment). */
  private queue: Promise<void> = Promise.resolve();

  handle(message: SheetReceivedMessage) {
    this.queue = this.queue.then(() => this.processUnpacked(message));
  }

  private async processUnpacked(message: SheetReceivedMessage) {
    try {
      this.process(await unpack(message));
    } catch (error) {
      this.hooks.onProblem({kind: "apply-failed", mutationId: message.type, error});
    }
  }

  private process(message: SheetReceivedMessage) {
    switch (message.type) {
      case "init":
        this.init(message.snapshot, message.entries, message.caughtUp, message.inflightApplied);
        return;
      case "entry":
        this.receive(message);
        return;
      case "reject":
        this.rejected(message.batchId);
        return;
      case "resync":
        this.resync(message.discard === true);
        return;
      case "verify":
        // A teammate uploaded a snapshot at this entry: compare, if this workbook is there too.
        if (message.seq === this.confirmedSeq) this.checkpoint(false, false, true);
        return;
      case "snapshot-saved":
        this.lastSnapshotSeq = Math.max(this.lastSnapshotSeq, message.seq);
        return;
      default:
        return;
    }
  }

  /** A mutation made here (by this person, or their undo); `bytes` is its size on the wire. */
  local(mutation: SheetMutation, bytes: number) {
    if (!this.loaded || this.rebuilding) return;
    // Filters are personal (see sheet-filters.ts).
    if (isPersonalMutation(mutation.id)) return;
    if (bytes > MAX_MUTATION_BYTES) this.commandTooBig = true;
    const first = this.command.length === 0;
    this.command.push(mutation);
    // A command's mutations arrive in one go: send them (or none of them) together.
    if (!first) return;
    queueMicrotask(() => {
      const command = this.command;
      const tooBig = this.commandTooBig;
      this.command = [];
      this.commandTooBig = false;
      if (tooBig) {
        this.hooks.onTooBig(this.revert(command));
      } else {
        this.buffer.push(...command);
        this.flush();
      }
      this.hooks.onPendingChange(this.pending);
    });
  }

  private init(
    snapshot: SheetSnapshot | null,
    entries: SheetEntry[],
    caughtUp: boolean,
    inflightApplied = false
  ) {
    if (caughtUp && this.ready) {
      for (const entry of entries) this.receive(entry);
    } else {
      // First load, a resync, or offline too long to catch up: start over from the room's copy.
      // What this person made that the room doesn't have yet is kept, moved over the entries
      // they hadn't seen, redone on the new workbook and sent.
      const {mutations: kept, exact} = rebasePending(
        {
          // Already in the room's copy (perhaps only in its snapshot): not redone.
          inflight: inflightApplied ? null : this.inflight,
          buffer: this.buffer,
          since: this.confirmedSeq,
        },
        snapshot?.seq ?? 0,
        entries
      );
      if (!exact && kept.length > 0) this.hooks.onProblem({kind: "offline-edits-rebased"});
      this.inflight = null;
      this.buffer = [];
      this.rebuilding = true;
      try {
        if (this.api.getWorkbook(this.unitId)) this.api.disposeUnit(this.unitId);
        this.api.createWorkbook(
          snapshot ? withoutPersonalState(parseWorkbook(snapshot.data)) : emptyWorkbook(this.unitId)
        );
        this.confirmedSeq = snapshot?.seq ?? 0;
        this.lastSnapshotSeq = this.confirmedSeq;
        for (const entry of entries) {
          this.apply(entry.mutations);
          this.confirmedSeq = entry.seq;
        }
        this.apply(kept);
      } finally {
        this.rebuilding = false;
      }
      this.buffer = kept;
      this.ready = true;
      this.loaded = true;
      this.hooks.onWorkbookLoaded(entries);
      if (entries.length >= SNAPSHOT_EVERY) this.checkpoint(true, true);
    }
    // Resend what the room doesn't have yet (a batch it confirmed was in `entries`).
    if (this.inflight) this.sendInflight();
    else this.flush();
    this.hooks.onPendingChange(this.pending);
  }

  private receive(entry: SheetEntry) {
    // Only the next one: an entry broadcast while this client is (re)joining comes again in its
    // `init`, in order.
    if (!this.ready || entry.seq !== this.confirmedSeq + 1) return;
    if (this.inflight?.batchId === entry.batchId) {
      // Ours: already applied here.
      this.inflight = null;
      this.confirmedSeq = entry.seq;
      this.checkpoint(true);
      this.flush();
      this.hooks.onPendingChange(this.pending);
      return;
    }
    // A teammate's, ordered before anything of ours still unconfirmed.
    let remote = entry.mutations;
    if (this.inflight) {
      const [inflight, r] = transform(this.inflight.mutations, remote, false);
      this.inflight.mutations = inflight;
      remote = r;
    }
    const [buffer, r] = transform(this.buffer, remote, false);
    this.buffer = buffer;
    remote = r;
    this.apply(remote);
    if (remote.some(isStructural)) {
      // Formulas typed here but not yet confirmed now point elsewhere (they were transformed
      // above, for sending); this workbook still shows them as typed, so write the moved ones.
      this.apply([...(this.inflight?.mutations ?? []), ...this.buffer].filter(writesFormula));
    }
    this.transformHistory(remote);
    this.confirmedSeq = entry.seq;
    this.hooks.onRemoteApplied(remote);
    this.checkpoint(false);
  }

  private rejected(batchId: string) {
    // While resyncing, the rebuilt workbook's `init` sends it again (see there).
    if (!this.ready || this.inflight?.batchId !== batchId) return;
    // The entries it missed have arrived (and it was transformed over them): try again on top.
    if (this.inflight.mutations.length === 0) {
      this.inflight = null;
      this.flush();
    } else {
      this.sendInflight();
    }
  }

  private flush() {
    if (!this.ready || this.inflight || this.buffer.length === 0) return;
    // Up to the budget (at least one): the rest waits for the next batch.
    let size = 0;
    let count = 0;
    while (count < this.buffer.length) {
      size += JSON.stringify(this.buffer[count]).length;
      if (count > 0 && size > BATCH_BUDGET_CHARS) break;
      count++;
    }
    this.inflight = {
      batchId: crypto.randomUUID(),
      mutations: this.buffer.slice(0, count),
      baseSeqs: [],
    };
    this.buffer = this.buffer.slice(count);
    this.sendInflight();
  }

  private sendInflight() {
    const inflight = this.inflight;
    if (!inflight) return;
    const message = {
      type: "mutations",
      batchId: inflight.batchId,
      baseSeq: this.confirmedSeq,
    } as const;
    inflight.baseSeqs.push(this.confirmedSeq);
    const json = JSON.stringify(inflight.mutations);
    if (json.length <= PACK_OVER_CHARS) {
      this.send({...message, mutations: inflight.mutations});
      return;
    }
    // A big paste: gzipped. If teammates' entries arrive meanwhile, the room rejects this (it's
    // made on top of an older entry) and the transformed batch is sent again.
    void (async () => {
      const packed = await gzipText(json);
      if (this.inflight === inflight) this.send({...message, mutations: [], packed});
    })();
  }

  private apply(mutations: SheetMutation[] | undefined) {
    // A malformed entry is skipped, never allowed to stop the sheet from loading.
    for (const mutation of Array.isArray(mutations) ? mutations : []) {
      // Never let a stored batch touch anything but this workbook.
      if (!isForUnit(mutation.params, this.unitId)) continue;
      // Someone's filter, from before filters were personal.
      if (isPersonalMutation(mutation.id)) continue;
      try {
        // fromCollab: applied without being re-sent, and kept out of this person's undo history.
        this.api.syncExecuteCommand(mutation.id, mutation.params ?? {}, {fromCollab: true});
      } catch (error) {
        this.hooks.onProblem({kind: "apply-failed", mutationId: mutation.id, error});
      }
    }
  }

  /**
   * This person's undo and redo history was recorded before a teammate's edit: move it through
   * that edit, so undoing still changes the cells it changed (not whatever moved into them).
   */
  /**
   * Takes back a command that was applied here but can't be sent: runs its undo from this
   * workbook's history (not the focused editor's, which `univerAPI.undo()` would use) and drops it
   * from the history. False if the history's latest entry isn't that command.
   */
  private revert(command: SheetMutation[]) {
    const history = this.history();
    const stack = history.undo;
    const item = stack?.at(-1);
    if (!stack || !item || !item.redoMutations.some(m => command.some(c => c.id === m.id))) {
      return false;
    }
    stack.pop();
    for (const mutation of item.undoMutations) {
      // onlyLocal: not sent (the room never had the command).
      this.api.syncExecuteCommand(mutation.id, mutation.params, {onlyLocal: true});
    }
    history.changed();
    return true;
  }

  /** This workbook's undo and redo history (LocalUndoRedoService keeps it per unit). */
  private history() {
    /* oxlint-disable no-underscore-dangle, typescript/no-unsafe-type-assertion -- Univer's
       injector and LocalUndoRedoService's protected stacks (Univer is pinned to an exact version). */
    const service = this.univer.__getInjector().get(IUndoRedoService) as unknown as UndoStacks;
    return {
      undo: service._getUndoStack(this.unitId),
      redo: service._getRedoStack(this.unitId),
      changed: () => service._updateStatus(),
    };
    /* oxlint-enable no-underscore-dangle, typescript/no-unsafe-type-assertion */
  }

  private transformHistory(remote: SheetMutation[]) {
    if (remote.length === 0) return;
    const {undo, redo} = this.history();
    const stacks = [undo, redo];
    for (const stack of stacks) {
      for (const item of stack ?? []) {
        item.undoMutations = asMutationInfos(transform(item.undoMutations, remote, false)[0]);
        item.redoMutations = asMutationInfos(transform(item.redoMutations, remote, false)[0]);
      }
    }
  }

  /**
   * While nothing of ours is unconfirmed (so this workbook is exactly the room's log up to
   * `confirmedSeq`): upload a snapshot if one is due (on our own entry, the first quiet moment
   * after SNAPSHOT_EVERY entries since the last; or `forceSnapshot`), else share a fingerprint
   * every CHECK_EVERY entries or when asked to (`verify`).
   */
  private checkpoint(ours: boolean, forceSnapshot = false, verify = false) {
    const seq = this.confirmedSeq;
    if (this.pending || seq === 0) return;
    const snapshot =
      forceSnapshot ||
      (ours &&
        seq - this.lastSnapshotSeq >= SNAPSHOT_EVERY &&
        seq - this.snapshotSentSeq >= SNAPSHOT_EVERY);
    if (!snapshot && !verify && seq % CHECK_EVERY !== 0) return;
    const workbook = this.api.getWorkbook(this.unitId);
    if (!workbook) return;
    if (snapshot) this.snapshotSentSeq = seq;
    const data = withoutPersonalState(workbook.save());
    void (async () => {
      const hash = await fingerprint(data);
      this.send(
        snapshot
          ? {
              type: "snapshot",
              seq,
              data: await gzipText(JSON.stringify(data)),
              encoding: "gzip",
              hash,
            }
          : {type: "checksum", seq, hash}
      );
    })();
  }

  /**
   * This workbook drifted from the team's: throw it away and rebuild it from the room's log.
   * Unsent edits (and any made until the rebuild) wait, and are redone on the rebuilt workbook,
   * unless the room said to `discard` them (this person may no longer edit).
   */
  private resync(discard: boolean) {
    if (discard) {
      this.inflight = null;
      this.buffer = [];
    }
    this.ready = false;
    this.hooks.onResync();
    this.send(this.helloFrom(0));
  }
}

/**
 * Edits made here that the room doesn't have yet (`inflight`, sent, and `buffer`, not yet),
 * made on top of entry `since`, moved over the room's `entries` after it so they can be redone
 * on a workbook rebuilt from a snapshot at `snapshotSeq` and those entries. The batch in flight
 * is dropped if the room has it. `exact` is false when entries between `since` and the snapshot
 * aren't there to move over (the edits are then redone as made, on top of the snapshot).
 */
export function rebasePending(
  pending: {
    inflight: {batchId: string; mutations: SheetMutation[]} | null;
    buffer: SheetMutation[];
    since: number;
  },
  snapshotSeq: number,
  entries: SheetEntry[]
): {mutations: SheetMutation[]; exact: boolean} {
  let inflight = pending.inflight;
  let buffer = pending.buffer;
  for (const entry of entries) {
    // Already in the workbook these edits were made on.
    if (entry.seq <= pending.since) continue;
    if (entry.batchId === inflight?.batchId) {
      inflight = null;
      continue;
    }
    // A teammate's, ordered before ours (as in SheetSync's `receive`).
    let remote = entry.mutations;
    if (inflight) {
      const [mutations, r] = transform(inflight.mutations, remote, false);
      inflight = {batchId: inflight.batchId, mutations};
      remote = r;
    }
    buffer = transform(buffer, remote, false)[0];
  }
  return {
    mutations: [...(inflight?.mutations ?? []), ...buffer],
    exact: pending.since >= snapshotSeq,
  };
}

/** An entry's mutations, unzipped if it was sent gzipped. */
async function unpackEntry(entry: SheetEntry): Promise<SheetEntry> {
  if (!entry.packed) return entry;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- packed by sendInflight.
  const mutations = JSON.parse(await gunzipText(entry.packed)) as SheetMutation[];
  return {seq: entry.seq, batchId: entry.batchId, mutations};
}

/** A message with its gzipped parts (snapshot, large entries) unzipped. */
async function unpack(message: SheetReceivedMessage): Promise<SheetReceivedMessage> {
  if (message.type === "entry") return {type: "entry", ...(await unpackEntry(message))};
  if (message.type !== "init") return message;
  const snapshot =
    message.snapshot?.encoding === "gzip"
      ? {seq: message.snapshot.seq, data: await gunzipText(message.snapshot.data)}
      : message.snapshot;
  return {...message, snapshot, entries: await Promise.all(message.entries.map(unpackEntry))};
}

/** Whether a mutation writes a formula into some cell. */
function writesFormula(m: SheetMutation) {
  if (m.id !== "sheet.mutation.set-range-values") return false;
  const cells =
    typeof m.params === "object" && m.params !== null && "cellValue" in m.params
      ? m.params.cellValue
      : null;
  if (typeof cells !== "object" || cells === null) return false;
  return Object.values(cells).some(
    row =>
      typeof row === "object" &&
      row !== null &&
      Object.values(row).some(cell => typeof cell === "object" && cell !== null && "f" in cell)
  );
}

/** Transformed mutations keep Univer's shape (id + params object). */
function asMutationInfos(mutations: SheetMutation[]): IMutationInfo[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- params are Univer's own JSON.
  return mutations as IMutationInfo[];
}
