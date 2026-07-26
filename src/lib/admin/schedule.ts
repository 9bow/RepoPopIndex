export function nextMonthlyRun(
  from: Date,
  scheduleDay: number,
  hourUtc = 1
): Date {
  const day = Math.min(28, Math.max(1, Math.trunc(scheduleDay)));
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day, hourUtc, 0, 0, 0)
  );
  if (candidate.getTime() > from.getTime()) return candidate;
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day, hourUtc, 0, 0, 0)
  );
}
