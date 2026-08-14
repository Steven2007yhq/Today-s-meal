"use client";

import { useState } from "react";
import "./upload.css";

const installers = [
  { version: "1.1.0", label: "好吃的今天最新版", expectedSize: "113.6 MB" },
  { version: "1.0.4", label: "稳定历史版本", expectedSize: "112.8 MB" },
  { version: "1.0.3", label: "兼容历史版本", expectedSize: "106.5 MB" },
];

const chunkSize = 16 * 1024 * 1024;

type UploadState = { status: string; progress: number; done: boolean; error: boolean };

export default function InstallerAdminPage() {
  const [token, setToken] = useState("");
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [states, setStates] = useState<Record<string, UploadState>>({});

  function updateState(version: string, next: Partial<UploadState>) {
    setStates((current) => ({
      ...current,
      [version]: { status: "等待选择安装包", progress: 0, done: false, error: false, ...current[version], ...next },
    }));
  }

  async function checkedFetch(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: { "x-upload-token": token, ...(init.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response;
  }

  async function upload(version: string) {
    const file = files[version];
    if (!token) return updateState(version, { status: "请先填写上传密钥", error: true });
    if (!file) return updateState(version, { status: "请先选择对应安装包", error: true });

    let uploadId = "";
    try {
      updateState(version, { status: "正在建立安全上传…", progress: 1, error: false });
      const start = await checkedFetch(`/api/admin/uploads/${version}?action=start`, { method: "POST" });
      ({ uploadId } = await start.json());

      const parts = [];
      for (let offset = 0, partNumber = 1; offset < file.size; offset += chunkSize, partNumber += 1) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const response = await checkedFetch(
          `/api/admin/uploads/${version}?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          { method: "PUT", body: chunk, headers: { "content-type": "application/octet-stream" } },
        );
        parts.push(await response.json());
        const uploaded = Math.min(offset + chunk.size, file.size);
        updateState(version, { status: `正在上传 ${Math.round((uploaded / file.size) * 100)}%`, progress: (uploaded / file.size) * 94 });
      }

      const complete = await checkedFetch(
        `/api/admin/uploads/${version}?action=complete&uploadId=${encodeURIComponent(uploadId)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parts }) },
      );
      const result = await complete.json();
      const verify = await fetch(`/api/downloads/${version}`, { method: "HEAD" });
      if (!verify.ok || Number(verify.headers.get("content-length")) !== result.size) {
        throw new Error("上传完成，但下载校验未通过");
      }
      updateState(version, { status: `上传并校验完成 · ${result.size.toLocaleString()} 字节`, progress: 100, done: true });
    } catch (error) {
      if (uploadId) {
        await fetch(`/api/admin/uploads/${version}?uploadId=${encodeURIComponent(uploadId)}`, {
          method: "DELETE",
          headers: { "x-upload-token": token },
        }).catch(() => {});
      }
      updateState(version, { status: `上传失败：${error instanceof Error ? error.message : "未知错误"}`, error: true });
    }
  }

  return (
    <main className="upload-admin">
      <header>
        <span className="upload-mark">吃</span>
        <div><small>好吃的今天 · 内部工具</small><h1>安装包管理</h1></div>
      </header>
      <section className="upload-token-card">
        <label htmlFor="upload-token">上传密钥</label>
        <input id="upload-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="输入本次发布使用的上传密钥" />
        <p>安装包会分片写入官网专用存储；密钥只在当前页面内存中使用。</p>
      </section>
      <section className="upload-list" aria-label="安装版本">
        {installers.map((installer) => {
          const state = states[installer.version];
          return (
            <article key={installer.version} data-version={installer.version}>
              <div className="upload-version"><strong>v{installer.version}</strong><span>{installer.label}</span><small>预期大小 {installer.expectedSize}</small></div>
              <label className="file-picker">
                <span>{files[installer.version]?.name ?? `选择 v${installer.version} 安装包`}</span>
                <input
                  aria-label={`选择 ${installer.version} 安装包`}
                  type="file"
                  accept=".exe,application/vnd.microsoft.portable-executable"
                  onChange={(event) => setFiles((current) => ({ ...current, [installer.version]: event.target.files?.[0] }))}
                />
              </label>
              <button type="button" onClick={() => upload(installer.version)} disabled={Boolean(state && !state.done && state.progress > 0 && !state.error)}>
                {state?.done ? "已完成" : `上传 ${installer.version}`}
              </button>
              <div className="upload-progress"><i style={{ width: `${state?.progress ?? 0}%` }}></i></div>
              <p role="status" data-upload-status={installer.version} className={state?.error ? "error" : state?.done ? "done" : ""}>{state?.status ?? "等待选择安装包"}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
