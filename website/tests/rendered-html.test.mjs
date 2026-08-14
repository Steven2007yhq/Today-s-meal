import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the official product site with download center", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>好吃的今天 - 一日三餐，不再为难<\/title>/);
  assert.match(html, /把每天吃什么/);
  assert.match(html, /小饭 AI/);
  assert.match(html, /\/api\/downloads\/1\.1\.0/);
  assert.match(html, /\/api\/downloads\/1\.0\.4/);
  assert.match(html, /\/api\/downloads\/1\.0\.3/);
  assert.match(html, /\/lifestyle\/family-dinner\.webp/);
  assert.match(html, /\/lifestyle\/elder-tea\.webp/);
  assert.match(html, /\/lifestyle\/fitness-training\.webp/);
  assert.match(html, /alt="东亚家庭一起分享家常晚餐"/);
  assert.match(html, /alt="乐龄夫妇在家中安静品茶"/);
  assert.match(html, /alt="男士进行哑铃力量训练"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|底层模型名称：/i);
});

test("unknown download versions fail safely", async () => {
  const { findRelease } = await import("../app/releases.ts");
  assert.equal(findRelease("9.9.9"), undefined);
});
