/** Returns true if `s` matches the YYYY-MM-DD format. */
export function isValidDateParam(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Returns ISO date string YYYY-MM-DD in local time. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM in local time. */
export function currentMonthISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Returns array of 7 ISO dates for the week containing `date` (Sun-Sat). */
export function weekOf(date: string): string[] {
  const d = new Date(date + "T00:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay()); // getDay() 0 = Sunday
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const next = new Date(sunday);
    next.setDate(sunday.getDate() + i);
    out.push(todayISO(next));
  }
  return out;
}

/** Returns ISO week number (1-53) for a given date. */
export function isoWeek(date: string): number {
  const d = new Date(date + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

/** Returns formatted month name in English short form, e.g. "May 2026". */
export function formatMonth(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[m - 1]} ${y}`;
}

/** Returns short weekday name in English: "Mon" / "Tue" / ... */
export function shortWeekday(date: string): string {
  const d = new Date(date + "T00:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

/** Returns day-of-month number, e.g. 22. */
export function dayOfMonth(date: string): number {
  return Number(date.split("-")[2]);
}

/** Returns true if `s` matches the YYYY-MM format. */
export function isValidMonthParam(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

function shiftMonth(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Previous calendar month, e.g. "2026-01" -> "2025-12". */
export function prevMonth(monthISO: string): string {
  return shiftMonth(monthISO, -1);
}

/** Next calendar month, e.g. "2026-12" -> "2027-01". */
export function nextMonth(monthISO: string): string {
  return shiftMonth(monthISO, 1);
}

/** Shift an ISO date (YYYY-MM-DD) by n days. */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

/**
 * Shift an ISO date by n months, clamping the day to the target month's last
 * day (e.g. addMonths("2026-01-31", 1) === "2026-02-28").
 */
export function addMonths(date: string, n: number): string {
  const [y, m, day] = date.split("-").map(Number);
  const targetIdx = y * 12 + (m - 1) + n;
  const ny = Math.floor(targetIdx / 12);
  const nm = (((targetIdx % 12) + 12) % 12); // 0-based month, always 0-11
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}
