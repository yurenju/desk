const COOKIE_NAME = "__Host-Session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function parseSessionId(headers: Headers): string | null {
  const raw = headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      const val = rest.join("=").replace(/^"|"$/g, ""); // Strip wrapping quotes
      return val || null; // Return null if empty
    }
  }
  return null;
}

export function serializeSessionCookie(id: string): string {
  // Validate ID format to prevent header/cookie injection
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Invalid session ID format");
  }
  return [
    `${COOKIE_NAME}=${id}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}
