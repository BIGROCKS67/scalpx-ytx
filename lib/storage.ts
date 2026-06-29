import fs from "fs";
import path from "path";

export function dataDirectory(): string {
  const configured = process.env.YTX_DATA_DIR?.trim();
  const dir =
    configured ||
    (process.env.VERCEL
      ? path.join("/tmp", "ytx-data")
      : path.join(/* turbopackIgnore: true */ process.cwd(), "data"));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbFilePath(): string {
  return path.join(dataDirectory(), "ytx.db");
}
