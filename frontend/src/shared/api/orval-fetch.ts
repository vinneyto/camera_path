import { API_URL } from "@/shared/config/env";

const revisions = new Map<string, number>();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function rememberProjectRevision(projectId: string, revision: number) {
  revisions.set(projectId, Math.max(revision, revisions.get(projectId) ?? -1));
}

export function forgetProjectRevision(projectId: string) {
  revisions.delete(projectId);
}

export async function orvalFetch<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const projectId = /^\/api\/v1\/projects\/([^/]+)/.exec(url)?.[1];
  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (projectId && !["GET", "HEAD"].includes(method)) {
    const revision = revisions.get(projectId);
    if (revision === undefined) {
      throw new Error(
        "Project revision is unavailable; reload the project before editing.",
      );
    }
    headers.set("If-Match", `"${revision}"`);
  }

  let response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  // Parallel resource reads can race with a mutation. Refetch an older response
  // so the separately cached resources converge on the latest project revision.
  const received = response.headers.get("ETag");
  const receivedRevision = received && /^"(\d+)"$/.exec(received)?.[1];
  if (
    projectId &&
    method === "GET" &&
    receivedRevision &&
    Number(receivedRevision) < (revisions.get(projectId) ?? 0)
  ) {
    response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new ApiError(
      payload?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  if (projectId) {
    const etag = response.headers.get("ETag");
    const revision = etag && /^"(\d+)"$/.exec(etag)?.[1];
    if (revision) rememberProjectRevision(projectId, Number(revision));
  }
  return {
    data: response.status === 204 ? undefined : await response.json(),
    status: response.status,
    headers: response.headers,
  } as T;
}
