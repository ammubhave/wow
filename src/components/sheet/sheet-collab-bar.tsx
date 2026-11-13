import {CheckIcon, CloudOffIcon, LoaderIcon, SquareFunctionIcon} from "lucide-react";

import type {SheetPeer} from "@/server/do/sheet";

import {peerColor} from "./sheet-presence";

export type SyncStatus = "connecting" | "saving" | "saved" | "offline";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join("") || "?";

const STATUS = {
  connecting: {icon: LoaderIcon, label: "Connecting…", spin: true},
  saving: {icon: LoaderIcon, label: "Saving…", spin: true},
  saved: {icon: CheckIcon, label: "Saved", spin: false},
  offline: {icon: CloudOffIcon, label: "Offline: edits will sync when you reconnect", spin: false},
} as const;

/**
 * Who else has the sheet open (click someone to jump to them and follow along; click again to
 * stop), and whether this person's edits have been saved. Sits in the empty right end of
 * Univer's ribbon.
 */
export function CollabBar({
  peers,
  following,
  onFollow,
  status,
  onOpenTools,
}: {
  peers: ReadonlyMap<string, SheetPeer>;
  following: string | null;
  onFollow: (peerId: string | null) => void;
  status: SyncStatus;
  onOpenTools: () => void;
}) {
  const {icon: Icon, label, spin} = STATUS[status];
  const followed = following ? peers.get(following) : undefined;
  return (
    <div className="absolute top-1 right-2 z-20 flex h-6 items-center gap-2">
      <button
        type="button"
        onClick={onOpenTools}
        aria-label="Puzzle tools"
        title="Word lookups, ciphers, extraction and crossword grids"
        className="text-foreground hover:bg-default flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium">
        <SquareFunctionIcon className="size-3.5" />
        {/* Icon only on phones, where the toolbar needs the room. */}
        <span className="hidden sm:inline">Puzzle tools</span>
      </button>
      {followed && (
        <button
          type="button"
          onClick={() => onFollow(null)}
          className="rounded-full px-2 text-[11px] leading-5 text-white"
          style={{background: peerColor(followed.userId)}}
          title="Stop following">
          Following {followed.name} ✕
        </button>
      )}
      <div className="flex -space-x-1">
        {[...peers.values()].map(peer => {
          const color = peerColor(peer.userId);
          const isFollowed = peer.id === following;
          return (
            <button
              key={peer.id}
              type="button"
              onClick={() => onFollow(isFollowed ? null : peer.id)}
              aria-label={isFollowed ? `Stop following ${peer.name}` : `Follow ${peer.name}`}
              title={
                isFollowed ? `Stop following ${peer.name}` : `Jump to ${peer.name} and follow along`
              }
              aria-pressed={isFollowed}
              className="ring-surface flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2"
              style={{
                background: color,
                outline: isFollowed ? `2px solid ${color}` : undefined,
                outlineOffset: 2,
              }}>
              {initials(peer.name)}
            </button>
          );
        })}
      </div>
      <output
        className="text-muted flex items-center gap-1 text-[11px]"
        aria-live="polite"
        title={label}>
        <Icon className={spin ? "size-3.5 animate-spin" : "size-3.5"} />
        <span className="hidden sm:inline">{status === "offline" ? "Offline" : label}</span>
      </output>
    </div>
  );
}
