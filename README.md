# 好吃的今天

面向中国大陆用户的智能饮食规划 Windows 桌面原型。它把“一日三餐怎么安排”做成一个轻松、温暖、可持续记录的工作台，并为家庭、60 岁以上人群和健身用户提供独立场景。

## 运行

```powershell
npm install
npm run dev       # 浏览器预览
npm run app       # Electron 桌面窗口（先启动 Vite）
npm run build     # 生产构建
npm run test      # 运行 Node 自动化测试
npm run check     # 测试 + 生产构建
npm run pack:win  # 生成 Windows NSIS 安装包
```

连接小饭 AI：用户不填写、保存或查看任何上游服务凭证；运营方把多条服务通道写入后台服务器的 `MEAL_AI_API_KEYS`，后台按匿名用户标识稳定分配通道，并在某条通道限流、失效或额度不足时自动切换。桌面端只访问小饭 AI 网关，不会加载上游凭证。

## 已实现

- 日常模式：三餐标注、用量与热量编辑、近三日上下文入口、周计划和营养图表。
- 家庭模式：进入前匿名家庭构成建档、成人/儿童份量建议、一锅多吃策略。
- 乐龄模式：清爽主题、盐糖钙提示、疾病史与用药风险导向的独立提示词。
- 健身模式：力量感主题、训练部位横向教练窗、训练日宏量营养建议。
- 商业化：免费/Pro 权限门槛、服务端商品与订单、微信/支付宝 Native 扫码下单、验签回调、幂等到账与会员有效期续接。
- 账号与分享：手机/163/QQ 邮箱、微信/QQ 登录界面、滑块验证、微信/朋友圈/QQ 分享卡片。
- 收藏系统：收藏夹与收藏项已写入 PostgreSQL，可从菜谱卡和详情页直接收藏、移除、按收藏夹筛选。
- 小饭 AI 顾问：由平台统一托管；后台服务池按用户稳定分配并支持故障切换、连接检测、超时与限流提示；四套场景提示词会注入今日餐食和近期饭量上下文，前端、Electron 与服务器三重拦截非饮食问题。
- 八大菜系库：当前前端合并为 150 道可搜索菜品，按菜名、菜系、食材、口味和烹饪方式检索；哈希表提供常数时间定位，关系图按共同食材、做法、风味和菜系计算带权近邻，前后端关系边已扩充到 1 万条以上。
- 饭量引擎：综合用户同餐次的历史份量与单餐热量目标，自动换算菜品食材克数、热量和三大营养素。
- 日历与导出：支持前后翻月、日期选择、右键查看当日三餐；单道食谱和周菜单均可通过 Windows 保存对话框导出为 PDF。
- 键盘操作：支持页面直达、场景切换、搜索、小饭 AI、历史导航、缩放和窗口刷新；应用内可从“设置与帮助”打开独立的快捷键说明 PDF。
- 帮助文档：桌面安装包使用排版后的使用说明 PDF 和快捷键说明 PDF，不再向普通用户展示 README 源文件或 Markdown 内容。
- 时间口径：面向中国大陆统一采用 `Asia/Shanghai`（UTC+8）计算顶部时间、日历“今天”和餐食日期归档；数据库时间戳仍保存标准 UTC。

## 当前交付边界

当前版本适合作为可安装产品原型和封闭测试版本，还不是可直接收费运营的公开商业版。代码中的真实能力与演示能力边界如下：

- 可用：桌面安装与生产构建、菜谱检索与饭量换算、日历编辑与本地持久化、PDF 导出、收藏的本地降级、PostgreSQL/MinIO/小饭 AI 后台骨架、密码哈希与服务端会话。
- 半闭环：手机号/邮箱注册登录已经写入数据库，但生产短信/邮件发送商尚未接入；当前滑块只校验令牌格式，不是服务端人机验证；微信/QQ 只有授权启动地址，没有回调换取身份的闭环。支付代码已经闭环，但仍需运营方填写已审核商户参数和公网 HTTPS 回调域名后才能真实收款。
- 演示：自动续费、退款后台、对账告警、周报指标和分享落地仍未形成生产闭环；健康档案和家庭档案主要保存在本机，不能作为医疗服务承诺。
- 待发布：仓库中的安全启动检查、迁移账本和错误兜底晚于现有 1.0.4 安装包，重新对外发版前必须生成新版本号的签名安装包。

详细审查、优先级和商业化路线见 [`docs/commercialization-readiness.md`](docs/commercialization-readiness.md)。

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

## Pro 会员支付

会员价格只由 PostgreSQL `billing.products` 决定，客户端传来的金额不会参与计费。月度与年度商品分别按一个自然月和一个自然年计算，订单会冻结购买时的商品名称和周期，避免后续调价影响已付款权益。服务端生成订单后返回微信或支付宝付款码；只有平台签名验证、商户身份、订单号、金额和币种全部一致的通知或主动查单结果，才会把订单改为已支付并写入 Pro 权益。重复事件由唯一键去重，连续购买会从现有有效期末尾续接。

```text
GET  /api/billing/products
GET  /api/membership/me
POST /api/billing/orders
GET  /api/billing/orders
GET  /api/billing/orders/:orderId
POST /api/billing/orders/:orderId/reconcile
POST /api/billing/admin/orders/:orderId/refund
POST /api/billing/webhooks/wechat
POST /api/billing/webhooks/alipay
```

部署前在服务器 `.env` 配置 `PAYMENT_NOTIFY_BASE_URL`、`BILLING_ADMIN_TOKEN` 及对应的 `WECHAT_PAY_*` / `ALIPAY_*` 参数，然后运行 `npm run db:migrate`。私钥、管理令牌、API v3 密钥和支付宝公钥路径只允许存在于服务器，不能使用 `VITE_*` 变量。`PAYMENT_DEV_SIMULATION=true` 仅供开发环境验证订单闭环；生产环境检测到它会拒绝启动。

客户端可读取最近订单，并对未确认订单发起一次服务端主动查单。管理端退款接口只负责登记已经在支付平台完成的退款、撤销对应权益并将后续已购权益前移，不会代替商户在微信或支付宝发起资金退款。该接口必须使用 `X-Billing-Admin-Token`。当前仍未实现自动扣款、平台退款发起和定时批量对账任务。

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

## 平台托管小饭 AI

复制 `.env.example` 为后台服务器的 `.env`，至少设置 `MEAL_AI_API_KEYS` 和 `AI_ASSIGNMENT_SECRET`；多条通道凭证用英文逗号分隔。若启用 `AI_GATEWAY_TOKEN`，再复制 `.env.desktop.example` 为开发机的 `.env.desktop` 并填写相同的网关令牌。正式发布时应由部署系统注入桌面网关地址和登录访问令牌，不要把任何上游服务凭证放进安装包。

```powershell
npm run server
```

小饭 AI 状态、对话和检测接口分别为 `GET /api/ai/status`、`POST /api/ai/chat`、`POST /api/ai/test`。客户端只发送匿名安装标识、当前场景和去标识化餐食上下文；服务器使用 HMAC 将该标识映射到服务池槽位，响应中不会返回槽位编号、上游服务商、模型名称或任何凭证。

## 架构说明

当前交付是可运行桌面前端与小饭 AI 安全网关。生产环境建议采用 Electron 自动更新 + HTTPS API 网关 + PostgreSQL + Redis + 对象存储：

1. 身份服务处理手机/邮箱验证码、微信/QQ OAuth、密码哈希、滑块验证和风控。
2. 餐食服务存储日历、食材克数、每周计划、营养报告以及 Windows 日历同步事件。
3. 推荐服务只接收去标识化画像和最近三天饮食，由小饭 AI 后台服务池分配通道并注入模块提示词。
4. 支付服务服务端创建微信/支付宝订单，以签名回调为唯一开通 Pro 的依据。
5. 分析服务按模块聚合注册、活跃与方案生成量，不复制手机号等身份字段。

完整的逻辑分库/分表草案位于 `database/schema.sql`。生产版 Windows 日历同步应通过独立 WinRT Adapter 调用 `Windows.ApplicationModel.Appointments`，失败时回退到应用内日历；网页预览模式仅使用应用内日历。

## 合规提示

健康情况、疾病史与用药信息属于敏感个人信息。正式上线前需加入单独同意、端到端传输加密、字段级加密、删除与导出机制，并完成《个人信息保护法》要求的影响评估。AI 结果只作为饮食教育建议，不替代医生诊疗。
