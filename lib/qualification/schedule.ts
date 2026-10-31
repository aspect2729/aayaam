const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export type ClockParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

export function istParts(date: Date): ClockParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function dateKey(parts: ClockParts) {
  return `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function fromIst(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MS);
}

function parseClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function nextAllowedSend(now: Date, quietStart = "21:00", quietEnd = "09:00", holidays: string[] = []) {
  const startMin = parseClock(quietStart);
  const endMin = parseClock(quietEnd);
  let cursor = new Date(now.getTime());
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const parts = istParts(cursor);
    const minutes = parts.hour * 60 + parts.minute;
    const holiday = holidays.includes(dateKey(parts));
    const quiet = minutes >= startMin || minutes < endMin;
    if (!holiday && !quiet) return cursor;
    if (!holiday && minutes < endMin) return fromIst(parts.year, parts.month, parts.day, Math.floor(endMin / 60), endMin % 60);
    const nextMorning = fromIst(parts.year, parts.month, parts.day + 1, Math.floor(endMin / 60), endMin % 60);
    cursor = nextMorning;
  }
  return cursor;
}

export function jitterMs(id: string, maxMinutes: number) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % (maxMinutes * 60)) * 1000;
}

export function withJitter(base: Date, id: string, maxMinutes: number, quietStart = "21:00", quietEnd = "09:00", holidays: string[] = []) {
  const jittered = new Date(base.getTime() + jitterMs(id, maxMinutes));
  const allowed = nextAllowedSend(jittered, quietStart, quietEnd, holidays);
  if (allowed.getTime() !== jittered.getTime()) return base;
  return jittered;
}

export function formatSlotLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
