export function parseEmailList(value: string | string[] | null | undefined) {
  const parts = Array.isArray(value) ? value : jsonOrLines(value);
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of parts) {
    const email = String(part || "")
      .trim()
      .toLowerCase()
      .replace(/^["']|["']$/g, "");
    if (!email.includes("@") || email.startsWith("@") || email.endsWith("@") || email.includes(" ")) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function jsonOrLines(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      // fall through to line splitting
    }
  }
  return raw.split(/[\s,;]+/);
}

export function isWhitelistedEmail(email: string | null | undefined, list: string[]) {
  if (!email || !list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export function userKey(input: {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return input.userEmail?.toLowerCase() || input.userId || input.userName || "unknown";
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
