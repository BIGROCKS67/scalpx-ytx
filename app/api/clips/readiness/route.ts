import { NextResponse } from "next/server";
import { checkClipsReadiness } from "@/lib/clips/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const readiness = await checkClipsReadiness();
  return NextResponse.json(readiness);
}
