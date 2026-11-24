/**
 * The ledger is paged with cursors ("continue after this record"), so the page
 * that was asked for can come back empty when records disappear between
 * requests. An empty page after the first one means that page no longer
 * exists, and the caller should start again from the first page.
 *
 * The first page never restarts: an empty ledger would otherwise reload forever.
 */
export function shouldRestartFromFirstPage(pageIndex: number, recordCount: number): boolean {
  return pageIndex > 0 && recordCount === 0;
}
