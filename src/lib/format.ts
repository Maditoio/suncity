export function userKey(input: {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return input.userId || input.userEmail || input.userName || "unknown";
}

export function displayName(input: {
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
}) {
  return input.userName || input.userEmail || (input.userId ? `User ${input.userId}` : "Unknown user");
}

export function dayBounds(timezone: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(date);
  const start = zonedDate(ymd, "00:00:00", timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { ymd, start: start.toISOString(), end: end.toISOString() };
}

export function rangeFromDates(timezone: string, fromYmd?: string, toYmd?: string) {
  const from = fromYmd ? zonedDate(fromYmd, "00:00:00", timezone).toISOString() : undefined;
  const toExclusive = toYmd
    ? new Date(zonedDate(toYmd, "00:00:00", timezone).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const endDate = toYmd ? zonedDate(toYmd, "23:59:59", timezone).toISOString() : undefined;
  return { from, to: toExclusive, start_date: from, end_date: endDate };
}

function zonedDate(ymd: string, time: string, timezone: string) {
  const guess = new Date(`${ymd}T${time}Z`);
  const asZone = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const pick = (type: string) => Number(asZone.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function formatWhen(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}
