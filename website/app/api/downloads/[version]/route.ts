import { env } from "cloudflare:workers";
import { findRelease } from "../../../releases";

type RouteContext = { params: Promise<{ version: string }> };
type DownloadEnv = { DOWNLOADS?: R2Bucket };

export async function GET(_request: Request, context: RouteContext) {
  const { version } = await context.params;
  const release = findRelease(version);
  if (!release) return new Response("未找到该版本", { status: 404 });

  const bucket = (env as unknown as DownloadEnv).DOWNLOADS;
  if (!bucket) return new Response("下载服务正在准备中", { status: 503 });
  const object = await bucket.get(release.objectKey);
  if (!object) return new Response("该安装包暂未上传", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/vnd.microsoft.portable-executable");
  headers.set("Content-Disposition", `attachment; filename="${release.fileName}"`);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "public, max-age=3600, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { version } = await context.params;
  const release = findRelease(version);
  if (!release) return new Response(null, { status: 404 });

  const bucket = (env as unknown as DownloadEnv).DOWNLOADS;
  if (!bucket) return new Response(null, { status: 503 });
  const object = await bucket.head(release.objectKey);
  if (!object) return new Response(null, { status: 404 });

  return new Response(null, {
    headers: {
      "Content-Type": "application/vnd.microsoft.portable-executable",
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="${release.fileName}"`,
      "ETag": object.httpEtag,
      "Cache-Control": "public, max-age=3600, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
