import { env } from "cloudflare:workers";
import { findRelease } from "../../../../releases";

type RouteContext = { params: Promise<{ version: string }> };
type UploadEnv = { DOWNLOADS?: R2Bucket; UPLOAD_TOKEN?: string };

function getRuntime() {
  return env as unknown as UploadEnv;
}

function isAuthorized(request: Request, runtime: UploadEnv) {
  const expected = runtime.UPLOAD_TOKEN;
  const bearer = request.headers.get("authorization") === `Bearer ${expected}`;
  const uploadHeader = request.headers.get("x-upload-token") === expected;
  return Boolean(expected && (bearer || uploadHeader));
}

async function getReleaseFromContext(context: RouteContext) {
  const { version } = await context.params;
  return findRelease(version);
}

export async function POST(request: Request, context: RouteContext) {
  const runtime = getRuntime();
  if (!isAuthorized(request, runtime)) return new Response("Unauthorized", { status: 401 });
  if (!runtime.DOWNLOADS) return new Response("R2 unavailable", { status: 503 });
  const release = await getReleaseFromContext(context);
  if (!release) return new Response("Unknown version", { status: 404 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "start";
  if (action === "start") {
    const upload = await runtime.DOWNLOADS.createMultipartUpload(release.objectKey, {
      httpMetadata: {
        contentType: "application/vnd.microsoft.portable-executable",
        contentDisposition: `attachment; filename="${release.fileName}"`,
      },
      customMetadata: { version: release.version, sha256: release.sha256 },
    });
    return Response.json({ uploadId: upload.uploadId, key: release.objectKey });
  }

  if (action === "complete") {
    const uploadId = url.searchParams.get("uploadId");
    if (!uploadId) return new Response("Missing uploadId", { status: 400 });
    const payload = await request.json() as { parts?: R2UploadedPart[] };
    if (!Array.isArray(payload.parts) || !payload.parts.length) return new Response("Missing parts", { status: 400 });
    const upload = runtime.DOWNLOADS.resumeMultipartUpload(release.objectKey, uploadId);
    const object = await upload.complete(payload.parts);
    return Response.json({ ok: true, size: object.size, etag: object.httpEtag });
  }

  return new Response("Unsupported action", { status: 400 });
}

export async function PUT(request: Request, context: RouteContext) {
  const runtime = getRuntime();
  if (!isAuthorized(request, runtime)) return new Response("Unauthorized", { status: 401 });
  if (!runtime.DOWNLOADS) return new Response("R2 unavailable", { status: 503 });
  const release = await getReleaseFromContext(context);
  if (!release) return new Response("Unknown version", { status: 404 });

  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
    return new Response("Invalid upload part", { status: 400 });
  }
  const upload = runtime.DOWNLOADS.resumeMultipartUpload(release.objectKey, uploadId);
  const part = await upload.uploadPart(partNumber, request.body);
  return Response.json(part);
}

export async function DELETE(request: Request, context: RouteContext) {
  const runtime = getRuntime();
  if (!isAuthorized(request, runtime)) return new Response("Unauthorized", { status: 401 });
  if (!runtime.DOWNLOADS) return new Response("R2 unavailable", { status: 503 });
  const release = await getReleaseFromContext(context);
  if (!release) return new Response("Unknown version", { status: 404 });
  const uploadId = new URL(request.url).searchParams.get("uploadId");
  if (!uploadId) return new Response("Missing uploadId", { status: 400 });
  await runtime.DOWNLOADS.resumeMultipartUpload(release.objectKey, uploadId).abort();
  return Response.json({ ok: true });
}
