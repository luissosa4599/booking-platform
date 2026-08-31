import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  /** Internal: set once a 401 has already triggered a refresh, so we don't loop. */
  _retried?: boolean;
}

interface AuthHandlers {
  /** Current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /** Exchange the stored refresh token for a new pair. Throws if it can't. */
  refresh: () => Promise<void>;
  /** Called when refresh fails — the session is gone, the gate redirects to sign-in. */
  onAuthLost: () => void;
}

// Registered by lib/session.ts at module load. Kept out of a direct import to
// avoid a client <-> session cycle.
let handlers: AuthHandlers | null = null;

export function setAuthHandlers(next: AuthHandlers): void {
  handlers = next;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = handlers?.getAccessToken() ?? null;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // A 401 on a token-bearing request means the access token expired mid-session.
  // Refresh once and replay; if the refresh itself fails, the session is over.
  if (
    response.status === 401 &&
    !options._retried &&
    handlers &&
    !path.startsWith("/auth/")
  ) {
    try {
      await handlers.refresh();
    } catch {
      handlers.onAuthLost();
      throw new ApiError(401, null, "Session expired");
    }
    return apiFetch<T>(path, { ...options, _retried: true });
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body (e.g. a raw 500 stack trace) — ignore, status is what matters.
    }
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
