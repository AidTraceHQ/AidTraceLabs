/**
 * Returns the date in the viewer's local time zone as YYYY-MM-DD.
 *
 * `toISOString()` reports the UTC date, which differs from the local date for
 * part of every day (for example before 09:00 in Japan).
 */
export function localDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
