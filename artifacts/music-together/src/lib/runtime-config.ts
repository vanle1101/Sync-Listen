import { setBaseUrl } from "@workspace/api-client-react";

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function toWebSocketUrl(apiBaseUrl: string): string | null {
  try {
    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

const apiBaseUrl = trim(import.meta.env.VITE_API_BASE_URL);
const wsUrlFromEnv = trim(import.meta.env.VITE_WS_URL);
const preferSameOriginDevProxy =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  (window.location.port === "22338" || window.location.port === "5173");
const fallbackLocalApiBaseUrl =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
  (window.location.port === "22338" || window.location.port === "5173")
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : undefined;

function getEffectiveApiBaseUrl(): string | undefined {
  if (preferSameOriginDevProxy) return undefined;
  return apiBaseUrl ?? fallbackLocalApiBaseUrl;
}

export function configureApiBaseUrl(): void {
  setBaseUrl(getEffectiveApiBaseUrl() ?? null);
}

export function getApiUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const effectiveApiBaseUrl = getEffectiveApiBaseUrl();
  return effectiveApiBaseUrl ? `${effectiveApiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function getWebSocketUrl(): string {
  if (preferSameOriginDevProxy) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  if (wsUrlFromEnv) {
    return wsUrlFromEnv;
  }

  const effectiveApiBaseUrl = getEffectiveApiBaseUrl();
  if (effectiveApiBaseUrl) {
    const derived = toWebSocketUrl(effectiveApiBaseUrl);
    if (derived) return derived;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
