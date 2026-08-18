/** GMT+2 with no daylight-saving shift. 09:00 there is 07:00 UTC. */
const GMT_PLUS_2_MS = 2 * 60 * 60 * 1000;
const RESTORE_HOUR_GMT2 = 9;

export function nextRestoreAt(from = new Date()) {
  const local = new Date(from.getTime() + GMT_PLUS_2_MS);
  const utcHour = RESTORE_HOUR_GMT2 - 2;
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, utcHour, 0, 0),
  ).toISOString();
}
