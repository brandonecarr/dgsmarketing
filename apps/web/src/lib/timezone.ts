/**
 * Tenant-aware date math. The gauges, schedulers, and Auto-Rosie all read
 * through these so "this month" and "today" mean the same thing the operator
 * means.
 *
 * Implementation uses Intl.DateTimeFormat — no extra deps, works in the
 * Vercel runtime. For most US service-business tenants we expect timezones
 * like "America/New_York" / "America/Chicago" / "America/Phoenix".
 */

/** Returns the wall-clock year/month/day at `instant` in `tz`. */
export function partsIn(instant: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * UTC instant corresponding to the given wall-clock time in `tz`.
 * Iteratively corrects for DST so the returned instant's wall-clock
 * matches the requested one within a few ms.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  // Start with a naive UTC guess, then correct.
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i++) {
    const parts = partsIn(new Date(guess), tz);
    const diffMin =
      (year - parts.year) * 525600 +
      (month - parts.month) * 43800 +
      (day - parts.day) * 1440 +
      (hour - parts.hour) * 60 +
      (minute - parts.minute);
    if (diffMin === 0) break;
    guess += diffMin * 60_000;
  }
  return new Date(guess);
}

/** Start of the current calendar month in the tenant's timezone, as a UTC Date. */
export function monthStart(now: Date, tz: string): Date {
  const p = partsIn(now, tz);
  return zonedTimeToUtc(p.year, p.month, 1, 0, 0, tz);
}

/** Start of next month in the tenant's timezone, as a UTC Date. */
export function monthEnd(now: Date, tz: string): Date {
  const p = partsIn(now, tz);
  const nextMonth = p.month === 12 ? 1 : p.month + 1;
  const nextYear = p.month === 12 ? p.year + 1 : p.year;
  return zonedTimeToUtc(nextYear, nextMonth, 1, 0, 0, tz);
}

/** Last calendar day number of the current month in the tenant's timezone. */
export function daysInMonth(now: Date, tz: string): number {
  const p = partsIn(now, tz);
  // Last day = (start of next month - 1 day) → in tz.
  const end = monthEnd(now, tz);
  const lastDay = partsIn(new Date(end.getTime() - 1), tz);
  if (lastDay.year !== p.year || lastDay.month !== p.month) return 30;
  return lastDay.day;
}

/** Today's day-of-month number in the tenant's timezone. */
export function dayOfMonth(now: Date, tz: string): number {
  return partsIn(now, tz).day;
}

/** Local hour-of-day in the tenant's timezone (0-23). */
export function hourOfDay(now: Date, tz: string): number {
  return partsIn(now, tz).hour;
}
