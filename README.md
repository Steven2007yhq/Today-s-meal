# 好吃的今天

面向中国大陆用户的智能饮食规划 Windows 桌面原型。它把“一日三餐怎么安排”做成一个轻松、温暖、可持续记录的工作台，并为家庭、60 岁以上人群和健身用户提供独立场景。

## 运行

```powershell
npm install
npm run dev       # 浏览器预览
npm run app       # Electron 桌面窗口（先启动 Vite）
npm run build     # 生产构建
npm run pack:win  # 生成 Windows NSIS 安装包
```

连接真实 AI：项目只使用 `DeepSeek deepseek-chat`。用户不填写、保存或查看 API Key；运营方把多把 Key 写入后台服务器的 `DEEPSEEK_API_KEYS`，后台按匿名用户标识稳定分配密钥槽位，并在某把 Key 限流、失效或余额不足时自动切换。桌面端只访问平台 AI 网关，不会加载 DeepSeek Key。

## 已实现

- 日常模式：三餐标注、用量与热量编辑、近三日上下文入口、周计划和营养图表。
- 家庭模式：进入前匿名家庭构成建档、成人/儿童份量建议、一锅多吃策略。
- 乐龄模式：清爽主题、盐糖钙提示、疾病史与用药风险导向的独立提示词。
- 健身模式：力量感主题、训练部位横向教练窗、训练日宏量营养建议。
- 商业化：免费/Pro 权限门槛、月付 ¥29.99、年付 ¥199.99、微信/支付宝支付演示。
- 账号与分享：手机/163/QQ 邮箱、微信/QQ 登录界面、滑块验证、微信/朋友圈/QQ 分享卡片。
- 收藏系统：收藏夹与收藏项已写入 PostgreSQL，可从菜谱卡和详情页直接收藏、移除、按收藏夹筛选。
- AI 顾问：仅使用平台托管的 DeepSeek；后台密钥池按用户稳定分配并支持故障切换、连接检测、超时与限流提示；四套 `.md` 系统提示词会注入今日餐食和近期饭量上下文，前端、Electron 与服务器三重拦截非饮食问题。
- 八大菜系库：当前前端合并为 150 道可搜索菜品，按菜名、菜系、食材、口味和烹饪方式检索；哈希表提供常数时间定位，关系图按共同食材、做法、风味和菜系计算带权近邻，前后端关系边已扩充到 1 万条以上。
- 饭量引擎：综合用户同餐次的历史份量与单餐热量目标，自动换算菜品食材克数、热量和三大营养素。
- 日历与导出：支持前后翻月、日期选择、右键查看当日三餐；单道食谱和周菜单均可通过 Windows 保存对话框导出为 PDF。
- 键盘操作：`Ctrl+K` 打开菜谱搜索；模态表单支持 `Tab` / `Shift+Tab` 循环导航，进入有默认值的输入框时自动选中原内容。
- 时间口径：面向中国大陆统一采用 `Asia/Shanghai`（UTC+8）计算顶部时间、日历“今天”和餐食日期归档；数据库时间戳仍保存标准 UTC。

登录/注册已经接入 PostgreSQL 身份服务：手机号或 163/QQ/Foxmail 邮箱注册时需要验证码、密码和滑块校验；登录会校验账号、密码与滑块，手机号也可附带短信验证码做二次校验。开发环境默认验证码为 `123456`（由 `/api/auth/send-code` 返回，生产环境请关闭 `AUTH_EXPOSE_DEV_CODE` 并接入短信/邮件服务）。会话使用服务端随机 Token，数据库只保存 Token 哈希，前端只保存短期会话 Token，不再保存密码。微信和 QQ 按钮已接入 OAuth2.0 启动接口；未配置 AppID/回调地址时会明确提示配置项，不会伪造登录成功。

认证接口：

```text
POST /api/auth/send-code
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
GET  /api/auth/oauth/wechat/start
GET  /api/auth/oauth/qq/start
```

## 扩充菜谱库

爬取器只处理明确列在 `scripts/recipe_sources.json` 中、允许自动访问且提供 Schema.org `Recipe` JSON-LD 的页面。运行前请确认来源条款、图片授权和 `robots.txt`；脚本只保存图片来源 URL，不下载或重新分发图片文件。

```powershell
# 先参考 recipe_sources.example.json 填写合法来源
npm run recipes:build
npm run build
```

生成结果写入 `src/data/crawledDishLibrary.json`，应用构建时会与内置八大菜系种子库自动合并。输出同时包含 `dishHash`、`nameHash` 和基于 Jaccard 食材相似度、烹饪方式及菜系加权的 `graphEdges`。

饭量计算位于 `src/services/dishEngine.js`：同一餐次历史份量占 58%，建议热量目标占 42%，结果限制在 0.65–1.55 标准份之间。生产版应继续引入家庭人数、年龄、疾病与训练目标，并使用《中国食物成分表》授权数据校准营养值。

## MinIO + PostgreSQL 图片库

项目已包含私有图片存储方案：`docker-compose.yml` 启动 PostgreSQL、MinIO 和私有桶初始化任务；`server/index.mjs` 提供图片压缩、缩略图、SHA-256 去重、软删除、授权信息与预签名读取；`npm run images:migrate` 可将当前 10 张本地菜品图批量迁移。

用户提供的新图默认放在 `%USERPROFILE%\Desktop\今天吃啥\figure`，运行 `npm run images:figure` 会按图片内容哈希生成稳定 ID，并发上传原图 WebP 与缩略图。图片上传后运行 `npm run catalog:build`，会生成菜品食材与营养哈希、写入 PostgreSQL 菜品和关系表，并把 MinIO 图片记录关联到可搜索的语义菜品 ID。两个脚本都可重复执行。

新增的 36 道节日/西式菜统一放在 `src/data/seasonalDishData.mjs`，前端直接合并，云端同步可运行 `npm run catalog:seasonal`，会把这批图片、菜谱元数据和关系边一起写入 PostgreSQL + MinIO。

本地需要先安装 Docker Desktop。完整启动命令、API、备份与上线安全要求见 `docs/image-storage.md`。如果图片服务未启动，桌面应用会自动回退到内置图片，不影响离线使用。

## 平台托管 DeepSeek

复制 `.env.example` 为后台服务器的 `.env`，至少设置 `DEEPSEEK_API_KEYS` 和 `AI_ASSIGNMENT_SECRET`；多把 Key 用英文逗号分隔。若启用 `AI_GATEWAY_TOKEN`，再复制 `.env.desktop.example` 为开发机的 `.env.desktop` 并填写相同的网关令牌。正式发布时应由部署系统注入桌面网关地址和登录访问令牌，不要把 DeepSeek Key 放进安装包。

```powershell
npm run server
```

AI 状态、对话和检测接口分别为 `GET /api/ai/status`、`POST /api/ai/chat`、`POST /api/ai/test`。客户端只发送匿名安装标识、当前场景和去标识化餐食上下文；服务器使用 HMAC 将该标识映射到密钥池槽位，响应中不会返回槽位编号或任何 Key。

## 架构说明

当前交付是可运行桌面前端与 DeepSeek 安全桥接。生产环境建议采用 Electron 自动更新 + HTTPS API 网关 + PostgreSQL + Redis + 对象存储：

1. 身份服务处理手机/邮箱验证码、微信/QQ OAuth、密码哈希、滑块验证和风控。
2. 餐食服务存储日历、食材克数、每周计划、营养报告以及 Windows 日历同步事件。
3. 推荐服务只接收去标识化画像和最近三天饮食，由后台密钥池分配 DeepSeek 通道并注入模块提示词。
4. 支付服务服务端创建微信/支付宝订单，以签名回调为唯一开通 Pro 的依据。
5. 分析服务按模块聚合注册、活跃与方案生成量，不复制手机号等身份字段。

完整的逻辑分库/分表草案位于 `database/schema.sql`。生产版 Windows 日历同步应通过独立 WinRT Adapter 调用 `Windows.ApplicationModel.Appointments`，失败时回退到应用内日历；网页预览模式仅使用应用内日历。

## 合规提示

健康情况、疾病史与用药信息属于敏感个人信息。正式上线前需加入单独同意、端到端传输加密、字段级加密、删除与导出机制，并完成《个人信息保护法》要求的影响评估。AI 结果只作为饮食教育建议，不替代医生诊疗。
