import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, product: "ytx", version: "0.1.0" });
}
