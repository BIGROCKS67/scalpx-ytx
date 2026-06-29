/** Next.js basePath - spec route /ytx */
export const YTX_BASE_PATH = process.env.NEXT_PUBLIC_YTX_BASE_PATH ?? "/ytx";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return `${YTX_BASE_PATH}/${path}`;
  if (path.startsWith(YTX_BASE_PATH)) return path;
  return `${YTX_BASE_PATH}${path}`;
}
