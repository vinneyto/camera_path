import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { proxyApiRequest } from "./proxy-api-request";

const origin = "https://camera-path.vercel.app";
const backend = "https://backend.cloudfront.net";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("CAMERA_PATH_BACKEND_URL", backend);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("keeps the JWT in a Secure HttpOnly cookie and returns only session metadata to the UI", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ access_token: "secret-jwt", expires_in: 28800 }),
  );
  const request = new NextRequest(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "editor", password: "password" }),
  });
  const response = await proxyApiRequest(request);
  expect(await response.json()).toEqual({ expires_in: 28800 });
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=strict");
  expect(cookie).toContain("Max-Age=28800");
  const [url, options] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`${backend}/api/v1/auth/login`);
  expect(options!.body).toBe(request.body);
});

it("forwards cookie JWT, method, body, query and revision without trusting client Authorization", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ id: "p" }, { headers: { ETag: '"7"' } }),
  );
  const request = new NextRequest(`${origin}/api/v1/projects/p?test=1`, {
    method: "PATCH",
    headers: {
      origin,
      cookie: "camera-path-session=real-token",
      Authorization: "Bearer forged",
      "If-Match": '"6"',
      "Content-Type": "application/json",
    },
    body: '{"name":"New"}',
  });
  const response = await proxyApiRequest(request);
  const [url, options] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`${backend}/api/v1/projects/p?test=1`);
  expect(options!.method).toBe("PATCH");
  expect(new Headers(options!.headers).get("Authorization")).toBe(
    "Bearer real-token",
  );
  expect(new Headers(options!.headers).get("If-Match")).toBe('"6"');
  expect(response.headers.get("ETag")).toBe('"7"');
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it.each([undefined, "https://attacker.example"])(
  "rejects writes with missing or foreign Origin (%s)",
  async (supplied) => {
    const response = await proxyApiRequest(
      new NextRequest(`${origin}/api/v1/auth/login`, {
        method: "POST",
        headers: supplied ? { origin: supplied } : {},
      }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("preserves SSE streaming without reading/buffering the upstream stream", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('event: delta\ndata: {"text":"Hello"}\n\n'),
      );
      controller.close();
    },
  });
  fetchMock.mockResolvedValue(
    new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    }),
  );
  const response = await proxyApiRequest(
    new NextRequest(`${origin}/api/v1/projects/p/chat/messages/stream`, {
      method: "POST",
      headers: { origin, cookie: "camera-path-session=token" },
    }),
  );
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(await response.text()).toContain('"Hello"');
});

it("routes local content URLs through the proxy and leaves signed S3 URLs direct", async () => {
  fetchMock.mockResolvedValue(
    Response.json([
      {
        upload_url: `${backend}/api/v1/library/a/content`,
        download_url: "https://bucket.s3.amazonaws.com/a?signature=abc",
      },
    ]),
  );
  const response = await proxyApiRequest(
    new NextRequest(`${origin}/api/v1/library`),
  );
  expect(await response.json()).toEqual([
    {
      upload_url: "/api/v1/library/a/content",
      download_url: "https://bucket.s3.amazonaws.com/a?signature=abc",
    },
  ]);
});

it("streams local binary uploads and forwards download ranges", async () => {
  fetchMock.mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const request = new NextRequest(`${origin}/api/v1/library/a/content`, {
    method: "PUT",
    headers: {
      origin,
      cookie: "camera-path-session=token",
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array([1, 2, 3]),
  });
  expect((await proxyApiRequest(request)).status).toBe(204);
  expect(fetchMock.mock.calls[0][1]!.body).toBe(request.body);
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1, 2]), {
      status: 206,
      headers: { "Content-Range": "bytes 0-1/3" },
    }),
  );
  const download = await proxyApiRequest(
    new NextRequest(`${origin}/api/v1/library/a/content`, {
      headers: { Range: "bytes=0-1" },
    }),
  );
  expect(download.status).toBe(206);
  expect(download.headers.get("content-range")).toBe("bytes 0-1/3");
  expect(new Headers(fetchMock.mock.calls[1][1]!.headers).get("Range")).toBe(
    "bytes=0-1",
  );
});

it("clears the cookie only after logout succeeds, or the backend rejects the JWT", async () => {
  const logout = new NextRequest(`${origin}/api/v1/auth/logout`, {
    method: "POST",
    headers: { origin, cookie: "camera-path-session=token" },
  });
  fetchMock.mockResolvedValue(
    Response.json({ detail: "Unavailable" }, { status: 503 }),
  );
  expect((await proxyApiRequest(logout)).headers.get("set-cookie")).toBeNull();
  fetchMock.mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    }),
  );
  expect((await proxyApiRequest(logout)).headers.get("set-cookie")).toContain(
    "Max-Age=0",
  );
  fetchMock.mockResolvedValue(
    Response.json({ detail: "Authentication required" }, { status: 401 }),
  );
  expect(
    (
      await proxyApiRequest(new NextRequest(`${origin}/api/v1/auth/session`))
    ).headers.get("set-cookie"),
  ).toContain("Max-Age=0");
});

it("accepts loopback browser Origin even when NextURL normalizes 127.0.0.1 to localhost", async () => {
  fetchMock.mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const request = new NextRequest("http://127.0.0.1:3000/api/v1/auth/logout", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
  });
  expect(request.nextUrl.host).toBe("localhost:3000");
  expect((await proxyApiRequest(request)).status).toBe(204);
  expect(fetchMock).toHaveBeenCalledOnce();
});
