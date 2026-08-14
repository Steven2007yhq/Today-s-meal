import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
const uploadToken = process.env.UPLOAD_TOKEN;
const sitesAccessToken = process.env.OAI_SITES_ACCESS_TOKEN;

if (!siteUrl || !uploadToken) {
  throw new Error("SITE_URL and UPLOAD_TOKEN are required");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const releasesDir = path.resolve(scriptDir, "..", "..", "release");
const installers = [
  ["1.1.0", "好吃的今天-Setup-1.1.0.exe"],
  ["1.0.4", "今天吃啥-Setup-1.0.4.exe"],
  ["1.0.3", "今天吃啥-Setup-1.0.3.exe"],
];
const chunkSize = 16 * 1024 * 1024;

function requestHeaders(extra = {}) {
  return {
    authorization: `Bearer ${uploadToken}`,
    ...(sitesAccessToken ? { "OAI-Sites-Authorization": `Bearer ${sitesAccessToken}` } : {}),
    ...extra,
  };
}

async function checkedFetch(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed (${response.status}): ${await response.text()}`);
  }
  return response;
}

async function uploadInstaller(version, fileName) {
  const filePath = path.join(releasesDir, fileName);
  const file = await open(filePath, "r");
  const { size } = await file.stat();
  let uploadId;

  try {
    const start = await checkedFetch(`${siteUrl}/api/admin/uploads/${version}?action=start`, {
      method: "POST",
      headers: requestHeaders(),
    });
    ({ uploadId } = await start.json());

    const parts = [];
    let offset = 0;
    let partNumber = 1;
    while (offset < size) {
      const length = Math.min(chunkSize, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      await file.read(buffer, 0, length, offset);
      const response = await checkedFetch(
        `${siteUrl}/api/admin/uploads/${version}?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        { method: "PUT", headers: requestHeaders({ "content-type": "application/octet-stream" }), body: buffer },
      );
      parts.push(await response.json());
      offset += length;
      partNumber += 1;
      process.stdout.write(`Uploaded ${version}: ${Math.round((offset / size) * 100)}%\r`);
    }

    const complete = await checkedFetch(
      `${siteUrl}/api/admin/uploads/${version}?action=complete&uploadId=${encodeURIComponent(uploadId)}`,
      {
        method: "POST",
        headers: requestHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ parts }),
      },
    );
    const result = await complete.json();
    console.log(`Uploaded ${version}: ${result.size} bytes`);
  } catch (error) {
    if (uploadId) {
      await fetch(`${siteUrl}/api/admin/uploads/${version}?uploadId=${encodeURIComponent(uploadId)}`, {
        method: "DELETE",
        headers: requestHeaders(),
      }).catch(() => {});
    }
    throw error;
  } finally {
    await file.close();
  }
}

for (const [version, fileName] of installers) {
  await uploadInstaller(version, fileName);
}

for (const [version] of installers) {
  const response = await checkedFetch(`${siteUrl}/api/downloads/${version}`, {
    method: "HEAD",
    headers: sitesAccessToken ? { "OAI-Sites-Authorization": `Bearer ${sitesAccessToken}` } : {},
  });
  console.log(`Verified ${version}: ${response.headers.get("content-length")} bytes`);
}
