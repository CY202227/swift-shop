// Admin API client: Bearer injection, single-flight refresh on 401.
// Admin uses the same JWT pair as web; tokens are namespaced separately
// so both apps can stay logged in at once in the same browser.

const ACCESS_KEY = "admin_access";
const REFRESH_KEY = "admin_refresh";

export function loadTokens(): { access: string | null; refresh: string | null } {
  return {
    access: localStorage.getItem(ACCESS_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

export function saveTokens(t: { access: string; refresh: string }) {
  localStorage.setItem(ACCESS_KEY, t.access);
  localStorage.setItem(REFRESH_KEY, t.refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractDetail(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as Record<string, unknown>).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length && typeof d[0] === "object" && d[0] && "msg" in d[0]) {
      return String((d[0] as Record<string, unknown>).msg);
    }
  }
  return fallback;
}

async function raw(method: string, path: string, body?: unknown, token?: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? (body as FormData)
          : JSON.stringify(body),
  });
}

let refreshPromise: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refresh } = loadTokens();
      if (!refresh) return null;
      const resp = await raw("POST", "/api/v1/auth/refresh", { refresh_token: refresh });
      if (!resp.ok) {
        clearTokens();
        return null;
      }
      const pair = await resp.json();
      saveTokens({ access: pair.access_token, refresh: pair.refresh_token });
      return pair.access_token as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let { access } = loadTokens();
  let resp = await raw(method, path, body, access);

  if (resp.status === 401 && access) {
    const fresh = await refreshOnce();
    if (fresh) resp = await raw(method, path, body, fresh);
  }

  if (!resp.ok) {
    let data: unknown = null;
    try {
      data = await resp.json();
    } catch {
      // non-JSON body
    }
    const detail = extractDetail(data, `请求失败 (${resp.status})`);
    throw new ApiError(resp.status, detail);
  }
  return (await resp.json()) as T;
}

export const get = <T>(path: string) => api<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => api<T>("POST", path, body ?? {});
export const patch = <T>(path: string, body: unknown) => api<T>("PATCH", path, body);
export const del = <T>(path: string) => api<T>("DELETE", path);

// CSV export needs raw fetch (non-JSON response) with auth header
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const { access } = loadTokens();
  const resp = await fetch(path, { headers: { Authorization: `Bearer ${access}` } });
  if (!resp.ok) throw new ApiError(resp.status, "导出失败");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
