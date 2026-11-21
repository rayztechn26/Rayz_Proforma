export type FailureKind = "hosting" | "service" | "http" | "invalid-response" | "connection";
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: FailureKind,
    public readonly endpoint: string,
    public readonly method: string,
    public readonly status: number | null,
    public readonly contentType: string,
    public readonly requestId = "",
  ) {
    super(`${message} (${method} ${endpoint}; ${status === null ? "no HTTP response" : `HTTP ${status}`}; ${contentType || "unknown content type"}${requestId ? `; reference ${requestId}` : ""})`);
    this.name = "ApiError";
  }
}

// Inspect the body as well as its content type: hosting blocks can be JSON or
// HTML, and an HTML challenge can even return HTTP 200. Never display raw HTML.
export function readApiResponse(raw: string, status: number, contentType: string, endpoint: string, method: string, requestId = ""): any {
  const fail = (message: string, kind: FailureKind): never => { throw new ApiError(message, kind, endpoint, method, status, contentType, requestId); };
  let data: any;
  try { data = JSON.parse(raw); } catch { /* HTML/error pages are classified below. */ }
  const challengeText = data && typeof data === "object" ? (typeof data.message === "string" ? data.message : "") : raw;
  if (/imunify360|bot[- ]protection|access denied by imunify|verifying your browser|cf-chl-|challenge-platform/i.test(challengeText))
    fail("The hosting security service blocked the connection. Retry later or contact support; your payment and company details are preserved.", "hosting");
  if (!/^(application\/(?:[\w.-]+\+)?json)(?:\s*;|$)/i.test(contentType))
    fail("The server returned a web page instead of an API response. Retry or contact support.", "invalid-response");
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("The server returned an unexpected API response. Please retry.", "invalid-response");
  if (status >= 500)
    fail("The activation service is temporarily unavailable. Retry; your approved payment and entered details are preserved.", "service");
  if (status < 200 || status >= 300) {
    const validation = data.errors && typeof data.errors === "object" ? Object.values(data.errors).flat().filter((v): v is string => typeof v === "string").join("\n") : "";
    const message = validation || (typeof data.message === "string" && data.message) || (status === 401 ? "Please sign in again." : "The request could not be completed.");
    fail(message, "http");
  }
  return data;
}
