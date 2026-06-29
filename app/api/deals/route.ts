import { NextResponse } from "next/server";
import { listScoutDeals } from "@/lib/adapters/deals";

export const dynamic = "force-dynamic";

export async function GET() {
  const deals = await listScoutDeals();
  return NextResponse.json({ deals });
}
