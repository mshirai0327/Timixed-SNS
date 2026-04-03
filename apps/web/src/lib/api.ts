import type {
  AuthResponse,
  DriftCreateResponse,
  DriftTimelineResponse,
  LoginRequest,
  RegisterRequest,
  SessionResponse
} from './types';

const DEFAULT_API_BASE = '/api/v1';
const SESSION_SEED = crypto.randomUUID();
const ACCESS_TOKEN_KEY = 'timixed_diary.access_token';

function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
    const fallbackMessage = `Request failed: ${response.status}`;

    try {
      const data = (await response.json()) as {
        error?: {
          message?: string;
        };
      };

      throw new Error(data.error?.message || fallbackMessage);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  return (await response.json()) as T;
}

export async function registerAccount(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${getApiBase()}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<AuthResponse>(response);
}

export async function loginAccount(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<AuthResponse>(response);
}

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(`${getApiBase()}/auth/me`, {
    headers: buildHeaders({
      Accept: 'application/json'
    })
  });

  return parseJson<SessionResponse>(response);
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
