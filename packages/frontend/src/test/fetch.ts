import { vi } from 'vitest';

/**
 * Network-boundary test helper.
 *
 * The only thing the frontend talks to outside the browser is the backend over
 * `fetch`, so that is the only thing tests stub. Everything above it (lib/api,
 * the auth store, components, react-router, date-fns) runs for real.
 */

export interface RecordedRequest {
  method: string;
  /** Path relative to the `/api` prefix, e.g. `/events/e1` */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export class MockReply {
  constructor(
    public status: number,
    public body: unknown
  ) {}
}

/** Successful API envelope, as the backend returns it */
export function ok<T>(data?: T, pagination?: unknown) {
  return new MockReply(200, {
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(pagination !== undefined ? { pagination } : {}),
  });
}

/** Error API envelope, as the backend returns it */
export function fail(status: number, code: string, message: string) {
  return new MockReply(status, { success: false, error: { code, message } });
}

type RouteResult = MockReply | Promise<MockReply>;
type Route = MockReply | ((req: RecordedRequest) => RouteResult);

/** Requests that were made during the current test */
export const requests: RecordedRequest[] = [];
/** Requests that matched no route (checked in test/setup.ts) */
export const unhandledRequests: string[] = [];

/**
 * Install fetch routes. Keys are `"METHOD /path"` (path without `/api` and
 * without query string). A route that returns a never-resolving promise can
 * be used to hold a component in its loading state.
 */
export function mockFetch(routes: Record<string, Route>) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method || 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const req: RecordedRequest = {
      method,
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    };
    requests.push(req);

    const key = `${method} ${path}`;
    const route = routes[key];
    if (!route) {
      unhandledRequests.push(key);
      throw new Error(`Unhandled request in test: ${key}`);
    }
    const reply = await (typeof route === 'function' ? route(req) : route);
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    } as Response;
  });
}

/** Requests made to a given `"METHOD /path"` */
export function requestsTo(key: string) {
  return requests.filter((r) => `${r.method} ${r.path}` === key);
}

export function resetFetchLog() {
  requests.length = 0;
  unhandledRequests.length = 0;
}

/** Never-resolving reply, to observe loading states */
export function pending(): Promise<MockReply> {
  return new Promise(() => {});
}
