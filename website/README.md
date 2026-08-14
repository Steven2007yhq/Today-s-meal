# 好吃的今天官网

“好吃的今天”Windows 桌面应用的产品官网，集中介绍产品目的、核心优势、场景模式、小饭 AI、隐私边界和历史安装版本。

## 本地开发

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
npm run lint
```

安装包通过 Sites R2 的 `DOWNLOADS` 绑定提供。生产上传接口只接受服务端环境变量 `UPLOAD_TOKEN` 对应的 Bearer 凭证，并采用分片上传以支持大于 100 MB 的安装包。
