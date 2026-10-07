import { NextRequest, NextResponse } from "next/server";

const COOKIE = "camera-path-session";

export async function proxyApiRequest(
  request: NextRequest,
): Promise<NextResponse> {
  const backend = new URL(
    process.env.CAMERA_PATH_BACKEND_URL ?? "http://127.0.0.1:8000",
  );
  const path = request.nextUrl.pathname;
  const writing = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const source = new URL(origin ?? "");
    // NextURL normalizes loopback IPs to localhost; Host preserves the browser address.
    sameOrigin =
      source.origin === origin &&
      source.protocol === request.nextUrl.protocol &&
      source.host === (request.headers.get("host") ?? request.nextUrl.host);
  } catch {
    /* Missing/malformed origins cannot authorize browser writes. */
  }
  // Cookie-authenticated writes, including login/logout, must come from our UI.
  if (writing && !sameOrigin) {
    return NextResponse.json(
      { detail: "Same-origin request required" },
      { status: 403 },
    );
  }
  const target = new URL(path + request.nextUrl.search, backend);
  const headers = new Headers();
  for (const name of [
    "content-type",
    "accept",
    "if-match",
    "range",
    "if-range",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get(COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Stream PLY uploads and SSE without buffering. Forward only to the configured origin.
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: writing ? request.body : undefined,
      ...(writing ? { duplex: "half" } : {}),
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    } as RequestInit);
  } catch {
    return NextResponse.json(
      { detail: "Backend unavailable" },
      { status: 502 },
    );
  }
  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of [
    "content-type",
    "content-disposition",
    "etag",
    "www-authenticate",
    "retry-after",
    "content-range",
    "accept-ranges",
    "x-accel-buffering",
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
  let response: NextResponse;
  if ([204, 205].includes(upstream.status) || request.method === "HEAD") {
    response = new NextResponse(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } else if (path === "/api/v1/auth/login" && upstream.ok) {
    const result = (await upstream.json()) as {
      access_token: string;
      expires_in: number;
    };
    // The browser sees session metadata only; the JWT stays in an HttpOnly cookie.
    response = NextResponse.json(
      { expires_in: result.expires_in },
      { headers: responseHeaders },
    );
    response.cookies.set(COOKIE, result.access_token, {
      ...cookieOptions,
      maxAge: result.expires_in,
    });
  } else if (
    upstream.headers.get("content-type")?.includes("application/json")
  ) {
    const data: unknown = await upstream.json();
    // The filesystem adapter returns backend URLs. Keep local content on our proxy;
    // signed URLs from external storage (S3) remain direct browser transfers.
    const rewrite = (value: unknown): unknown => {
      if (typeof value === "string") {
        try {
          const url = new URL(value);
          if (
            url.origin === backend.origin &&
            /^\/api\/v1\/library\/[^/]+\/content$/.test(url.pathname)
          ) {
            return url.pathname + url.search;
          }
        } catch {
          /* Non-URL strings are unchanged. */
        }
        return value;
      }
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, rewrite(item)]),
        );
      }
      return value;
    };
    response = NextResponse.json(rewrite(data), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } else {
    response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }
  if (
    upstream.status === 401 ||
    (path === "/api/v1/auth/logout" && upstream.ok)
  ) {
    response.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  }
  return response;
}
