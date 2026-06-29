import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dir, "..");
const binDir = path.join(root, "bin");
const dest = path.join(binDir, "yt-dlp");

const platform = process.platform;
if (platform !== "linux" && platform !== "darwin") {
  console.log("[install-yt-dlp] skip - unsupported platform", platform);
  process.exit(0);
}

if (fs.existsSync(dest)) {
  console.log("[install-yt-dlp] already present");
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

const url =
  platform === "linux"
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";

console.log("[install-yt-dlp] downloading for", platform);
try {
  execSync(`curl -fsSL "${url}" -o "${dest}"`, { stdio: "inherit" });
  fs.chmodSync(dest, 0o755);
  console.log("[install-yt-dlp] installed to bin/yt-dlp");
} catch (e) {
  // Optional dependency - only used for clip YouTube import. Never fail install.
  console.warn("[install-yt-dlp] skip - download unavailable:", e?.message ?? e);
}
