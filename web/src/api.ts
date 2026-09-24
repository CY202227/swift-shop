// fetch wrapper: injects Bearer token, auto-refreshes once on 401, single
// in-flight refresh promise so parallel 401s don't rotate the token twice.
import { clearTokens, loadTokens, saveTokens } from "./auth";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function rawRequest(method: string, path: string, body?: unknown, token?: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function extractDetail(data: unknown, fallback: string): string {
  // FastAPI errors: {"detail": "..."} or {"detail": [{msg: "..."}]}
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as Record<string, unknown>).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length && typeof d[0] === "object" && d[0] !== null && "msg" in d[0]) {
      return String((d[0] as Record<string, unknown>).msg);
    }
  }
  return fallback;
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refresh } = loadTokens();
  if (!refresh) return null;
  const resp = await rawRequest("POST", "/api/v1/auth/refresh", { refresh_token: refresh });
  if (!resp.ok) {
    clearTokens();
    return null;
  }
  const pair = await resp.json();
  saveTokens({ access: pair.access_token, refresh: pair.refresh_token });
  return pair.access_token as string;
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  let { access } = loadTokens();
  let resp = await rawRequest(method, path, body, access);

  if (resp.status === 401 && access) {
    const newAccess = await refreshOnce();
    if (newAccess) {
      resp = await rawRequest(method, path, body, newAccess);
    }
  }

  if (!resp.ok) {
    let data: unknown = null;
    try {
      data = await resp.json();
    } catch {
      // non-JSON error body
    }
    throw new ApiError(resp.status, extractDetail(data, `请求失败 (${resp.status})`));
  }
  return resp.json();
}

export const get = (path: string) => api("GET", path);
export const post = (path: string, body?: unknown) => api("POST", path, body ?? {});
export const patch = (path: string, body: unknown) => api("PATCH", path, body);
export const del = (path: string) => api("DELETE", path);
