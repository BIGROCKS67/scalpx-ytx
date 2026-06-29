import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { readLocalClipAsset } from "@/lib/clips/videoUpload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const asset = readLocalClipAsset(name);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = fs.statSync(asset.filePath);
  const range = req.headers.get("range");

  if (range) {
    const match = /^bytes=(\d+)-(\d+)?$/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      const chunkLen = end - start + 1;
      const stream = fs.createReadStream(asset.filePath, { start, end });
      return new NextResponse(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Type": asset.mime,
          "Content-Length": String(chunkLen),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const stream = fs.createReadStream(asset.filePath);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
