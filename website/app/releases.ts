export const releases = [
  {
    version: "1.1.0",
    size: "113.6 MB",
    date: "2026-08-14",
    sha256: "047333BAB51E9A30092C03D0C4176B7746807152A7FC5A31702F340CD7061C9C",
    objectKey: "installers/hao-chi-de-jin-tian-setup-1.1.0.exe",
    fileName: "hao-chi-de-jin-tian-setup-1.1.0.exe",
    recommended: true,
    summary: "当前推荐的封闭测试版本，包含最新品牌、导航和帮助体验。",
    highlights: ["小饭 AI 统一品牌", "后退 / 前进与完整快捷键", "PDF 使用说明与安全边界"],
  },
  {
    version: "1.0.4",
    size: "112.8 MB",
    date: "2026-08-05",
    sha256: "038DF434B2AB279FB58BBE963C789EF7C52C76CDA6C35F4C6515997A99F5B1D1",
    objectKey: "installers/hao-chi-de-jin-tian-setup-1.0.4.exe",
    fileName: "hao-chi-de-jin-tian-setup-1.0.4.exe",
    recommended: false,
    summary: "完整功能稳定版，适合需要回退到上一代界面的测试用户。",
    highlights: ["八大菜系库与饭量换算", "餐食日历和营养报告", "收藏与 PDF 导出"],
  },
  {
    version: "1.0.3",
    size: "106.5 MB",
    date: "2026-08-05",
    sha256: "578440AC81B60AF33ED0FE08479D6FB4A14CB95A8BFC8A47D3EB7D1425B8D849",
    objectKey: "installers/hao-chi-de-jin-tian-setup-1.0.3.exe",
    fileName: "hao-chi-de-jin-tian-setup-1.0.3.exe",
    recommended: false,
    summary: "精简兼容版本，仅建议在新版无法运行时用于问题定位。",
    highlights: ["核心三餐计划", "四种饮食场景", "旧版 Windows 兼容回退"],
  },
] as const;

export function findRelease(version: string) {
  return releases.find((release) => release.version === version);
}
