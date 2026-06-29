import { NextResponse } from "next/server";
import { hostCapabilities } from "@/lib/runtimeHost";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(hostCapabilities());
}
