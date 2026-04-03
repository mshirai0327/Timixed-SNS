import type { DriftCreateResponse, DriftTimelineResponse } from './types';

const DEFAULT_API_BASE = '/api/v1';
const SESSION_SEED = crypto.randomUUID();

function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
}

function getAccessToken() {
  return (
    import.meta.env.VITE_API_BEARER_TOKEN ||
    window.localStorage.getItem('drift.access_token') ||
    ''
  );
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getAccessToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchTimeline(): Promise<DriftTimelineResponse> {
  const response = await fetch(`${getApiBase()}/timeline`, {
    headers: buildHeaders({
      Accept: 'application/json',
      'X-Session-Seed': SESSION_SEED
    })
  });

  return parseJson<DriftTimelineResponse>(response);
}

export async function createDrift(body: string): Promise<DriftCreateResponse> {
  const response = await fetch(`${getApiBase()}/drifts`, {
    method: 'POST',
    headers: buildHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }),
    body: JSON.stringify({ body })
  });

  return parseJson<DriftCreateResponse>(response);
}
