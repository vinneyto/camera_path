import { NextRequest, NextResponse } from "next/server";

import { proxyApiRequest } from "@/shared/server/proxy-api-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyApiRequest(request);
}

export { GET as POST, GET as PATCH, GET as PUT, GET as DELETE, GET as HEAD };
