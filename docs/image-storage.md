# 菜品图片存储：MinIO + PostgreSQL

## 架构

```text
React / Electron
    │ GET /api/images?dishIds=...
    ▼
Node Image API :8787
    ├── PostgreSQL :55432  保存图片元数据、哈希、授权和软删除状态
    └── MinIO :9000       私有桶保存 WebP 原图与 480×360 缩略图
         MinIO Console :9001
```

前端不会保存 MinIO 密钥，也不会直接访问永久公开地址。图片 API 从 PostgreSQL 找到对象键后，生成有效期一小时的预签名 URL。服务离线时，客户端自动回退到安装包内的本地图片。

## 本地启动

1. 安装并启动 Docker Desktop，确认 `docker compose version` 可运行。
2. 将 `.env.example` 复制为 `.env`，至少修改 `POSTGRES_PASSWORD`、`MINIO_ROOT_PASSWORD` 和 `IMAGE_UPLOAD_TOKEN`。
3. 执行以下命令：

```powershell
npm install
npm run infra:up
npm run db:migrate
npm run server
```

服务启动后，另开终端迁移当前菜品图片：

```powershell
npm run images:migrate
```

验证地址：

- 图片服务：`http://127.0.0.1:8787/health`
- MinIO 控制台：`http://127.0.0.1:9001`
- PostgreSQL：`127.0.0.1:55432`（容器内仍使用 `5432`）

关闭容器使用 `npm run infra:down`。默认命令不会删除数据卷；不要随意执行 `docker compose down -v`。

如果要同步这次新增的 36 道节日/西式菜，直接运行 `npm run catalog:seasonal`。脚本会读取 `src/data/seasonalDishData.mjs`，把图片上传到 MinIO，并把菜谱元数据和关系边写进 PostgreSQL。

## 图片处理

- 接受 JPEG、PNG、WebP，单文件最大 12MB。
- 原图经 EXIF 方向校正，最长边限制为 1600px，输出质量 88 的 WebP。
- 自动生成 480×360、质量 82 的 WebP 缩略图。
- 上传前计算 SHA-256，同一菜品的相同文件只保留一份。
- 每条记录必须提供 `licenseType`；当前本地图使用 `user_provided_ai`。
- 删除接口只设置 `deleted_at`，不会立刻清理 MinIO 对象。

## API

| 方法 | 地址 | 说明 | 权限 |
|---|---|---|---|
| `GET` | `/health` | 检查 PostgreSQL 和 MinIO | 公开 |
| `GET` | `/api/images?dishIds=a,b` | 批量获取每道菜最新图片 | 公开 |
| `GET` | `/api/dishes/:dishId/images` | 获取菜品所有有效图片 | 公开 |
| `POST` | `/api/images` | 上传、压缩并登记图片 | Bearer Token |
| `DELETE` | `/api/images/:id` | 软删除图片记录 | Bearer Token |

上传字段：`image`、`dishId`、`licenseType`、可选 `sourceUrl`、可选 `attribution`。`IMAGE_UPLOAD_TOKEN` 仅供管理脚本和未来管理后台使用，禁止写入 `VITE_*` 环境变量。

## 备份与上线

- PostgreSQL：定时执行 `pg_dump`，保留元数据和授权记录。
- MinIO：启用 Bucket Versioning，并通过 `mc mirror` 复制到第二存储位置。
- 生产环境关闭默认端口公网访问，在反向代理后启用 HTTPS。
- MinIO 使用独立应用账号和最小权限策略，不在应用中使用 root 凭据。
- 生产 API 应接入真实管理员身份系统、上传频控、审计日志和恶意文件扫描。
