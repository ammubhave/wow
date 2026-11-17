/** Converting between timestamps and `<input type="datetime-local">` values (local time). */

const pad = (n: number) => String(n).padStart(2, "0");

/** The input value for a time, in this browser's time zone ("" for none). */
export function toLocalInput(date: Date | number | string | null | undefined) {
  if (date === null || date === undefined || date === "") return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The time an input value means, in ms (null for empty). */
export const fromLocalInput = (value: string) => (value ? new Date(value).getTime() : null);

/** An input value for a calendar date (UTC midnight, as all-day dates are) at a time of day. */
export const dateAt = (date: Date, time: string) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${time}`;
