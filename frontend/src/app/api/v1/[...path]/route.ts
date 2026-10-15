import { NextRequest, NextResponse } from "next/server";

import { proxyApiRequest } from "@host/server/proxy-api-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyApiRequest(request);
}

export { GET as DELETE, GET as HEAD, GET as PATCH, GET as POST, GET as PUT };
