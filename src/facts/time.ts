/**
 * Clock formatting for anchors — LOCAL time on the machine running the CLI:
 * the session owner's clock, the one they lived the day in. Never called
 * from compositions (TZ math there would break render determinism); times
 * reach the renderer pre-formatted via digest text and the sceneTimes sidecar.
 */
export function formatClock(isoTimestamp: string | undefined): string | null {
  if (!isoTimestamp) return null;
  const ms = Date.parse(isoTimestamp);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
