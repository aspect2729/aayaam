export const browserUserAgent = "AayaamBot/1.0 (+https://aayaam.example/bot)";

function ipv4Private(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function inspectBrowserRequest(input: {
  url: string;
  allowHosts: string[];
  mode: "read" | "assisted_manual" | "supervised_write";
  supervisedEnabled?: boolean;
  action?: "fetch" | "fill";
  fieldType?: string;
  fieldName?: string;
  pageText?: string;
}) {
  if (input.mode === "assisted_manual") {
    return { allowed: false, reason: "Assisted mode writes a checklist. It does not drive a browser." };
  }
  if (input.mode === "supervised_write" && !input.supervisedEnabled) {
    return { allowed: false, reason: "Supervised write is off. The owner has not enabled FEATURE_BROWSER_SUPERVISED_WRITE." };
  }
  if (input.action === "fill" && /password/i.test(`${input.fieldType ?? ""} ${input.fieldName ?? ""}`)) {
    return { allowed: false, reason: "A password field is never filled." };
  }
  if (input.pageText && /recaptcha|i['’]m not a robot|captcha/i.test(input.pageText)) {
    return { allowed: false, reason: "A challenge is on the page. Control returns to the owner.", handoff: "owner" as const };
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { allowed: false, reason: "The address is not a URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: "Only http and https addresses are allowed." };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1" || ipv4Private(host)) {
    return { allowed: false, reason: "Private and local addresses are blocked." };
  }
  if (/(^|\.)google\.(com|co\.in)$/.test(host) && /\/(search|maps)(\/|$)/.test(parsed.pathname)) {
    return { allowed: false, reason: "Google Search and Google Maps pages are not fetched. Use the Places API and a rank API." };
  }
  if (!input.allowHosts.some((allowed) => allowed.toLowerCase() === host)) {
    return { allowed: false, reason: "The host is not on this task’s allow list." };
  }
  return { allowed: true, reason: "Read is allowed for this host." };
}

export function robotsAllows(robotsTxt: string, path: string) {
  const lines = robotsTxt.split("\n").map((line) => line.trim());
  let applies = false;
  const disallowed: string[] = [];
  for (const line of lines) {
    const agent = line.match(/^user-agent:\s*(.+)$/i);
    if (agent) {
      applies = agent[1].trim() === "*" || /aayaambot/i.test(agent[1]);
      continue;
    }
    const rule = line.match(/^disallow:\s*(.*)$/i);
    if (applies && rule && rule[1]) disallowed.push(rule[1].trim());
  }
  return !disallowed.some((rule) => path.startsWith(rule));
}

export function crawlBudget(input: { maxPages?: number; maxDepth?: number } = {}) {
  return {
    maxPages: Math.min(input.maxPages ?? 200, 200),
    maxDepth: Math.min(input.maxDepth ?? 5, 5),
    perHostIntervalMs: 1000,
    userAgent: browserUserAgent,
  };
}
