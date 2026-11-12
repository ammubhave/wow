import type {IWorkbookData} from "@univerjs/presets";

/**
 * A short fingerprint of what a workbook shows (cells, formulas, styles, merges, sizes), equal in
 * every browser that has applied the same edits. Browsers compare fingerprints to catch one that
 * has drifted (an edit that failed to apply there) before it uploads a bad snapshot for everyone.
 *
 * Only what's the same everywhere counts: a formula cell by its formula (its value is computed,
 * possibly a moment later), styles by their content (Univer names stored styles with random
 * ids), and nothing personal or per-browser (filters, selections, add-on resources).
 */

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON with object keys sorted, so equal content gives equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObj(value)) {
    return `{${Object.keys(value)
      .filter(key => value[key] !== undefined && value[key] !== null)
      .toSorted()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Row heights or column widths people set, and what's hidden. Not automatic row heights: each
 * browser measures those from its own font rendering.
 */
function sizes(data: unknown, size: "h" | "w") {
  if (!isObj(data)) return {};
  const out: Obj = {};
  for (const [index, entry] of Object.entries(data)) {
    if (!isObj(entry)) continue;
    const kept = {size: entry.ia === 1 ? undefined : entry[size], hidden: entry.hd};
    if (kept.size !== undefined || kept.hidden !== undefined) out[index] = kept;
  }
  return out;
}

/** The content that should be identical in every browser. */
export function fingerprintContent(data: Partial<IWorkbookData>): string {
  const styles: Obj = isObj(data.styles) ? data.styles : {};
  const style = (s: unknown) => (typeof s === "string" ? styles[s] : s);
  const sheets = (data.sheetOrder ?? []).map(id => {
    const raw: unknown = data.sheets?.[id];
    const sheet: Obj = isObj(raw) ? raw : {};
    const cells: [row: number, col: number, content: unknown, style: unknown][] = [];
    const cellData: Obj = isObj(sheet.cellData) ? sheet.cellData : {};
    for (const [r, row] of Object.entries(cellData)) {
      if (!isObj(row)) continue;
      for (const [c, cell] of Object.entries(row)) {
        if (!isObj(cell)) continue;
        const content = typeof cell.f === "string" && cell.f !== "" ? {f: cell.f} : {v: cell.v};
        const s = style(cell.s);
        if (content.v === undefined && content.f === undefined && s === undefined) continue;
        cells.push([Number(r), Number(c), content, s ?? null]);
      }
    }
    cells.sort(([ar, ac], [br, bc]) => ar - br || ac - bc);
    return {
      id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      merges: Array.isArray(sheet.mergeData) ? sheet.mergeData.map(canonical).toSorted() : [],
      rows: sizes(sheet.rowData, "h"),
      columns: sizes(sheet.columnData, "w"),
      cells,
    };
  });
  return canonical(sheets);
}

/** A hex SHA-256 (first 16 characters) of a workbook's shared content. */
export async function fingerprint(data: Partial<IWorkbookData>) {
  const bytes = new TextEncoder().encode(fingerprintContent(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
