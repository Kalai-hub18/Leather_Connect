const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'lc.token';
const USER_KEY = 'lc.user';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role:
    | 'SUPER_ADMIN'
    | 'COLLEGE_ADMIN'
    | 'PLACEMENT_OFFICER'
    | 'STUDENT_COORDINATOR'
    | 'HR'
    | 'STUDENT'
    | 'ALUMNI';
  collegeId: string | null;
  companyId: string | null;
}

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  set(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/** Carries the server's error code so callers can branch without string-matching. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  const token = session.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    if (res.status === 401) session.clear();
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Request failed');
  }

  return body?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
};

export async function login(email: string, password: string) {
  const result = await request<{ accessToken: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  session.set(result.accessToken, result.user);
  return result.user;
}
