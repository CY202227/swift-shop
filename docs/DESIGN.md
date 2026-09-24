# Shop 电商网站总体设计文档

- 版本：v0.4（2026-09-24，选型定稿 + 演示站点纳入）
- 项目根目录：`D:\Dev\shop\`（monorepo 根）
- 状态：后端 FastAPI ✅ / 前端 React ×2 ✅ / PostgreSQL ✅ / Redis 不装 ✅ / MinIO ✅ / 支付仅留接口 ✅ / **GitHub Pages 演示站点已纳入设计（§11）** / 仓库命名见 §12

---

## 1. 项目目标

搭建一个中小型电商网站，包含**商城前端（用户侧）/ 管理后台（管理员侧）/ 后端 API** 三部分，前后端分离，满足：

| # | 需求             | 对应设计                                    |
| - | -------------- | --------------------------------------- |
| 1 | 使用谷歌或邮箱注册账户    | §5.1 Google OAuth 2.0 + 邮箱验证码注册         |
| 2 | 管理员可指定是否开启邀请注册 | §5.2 `invite_required` 开关（后台随时切换）       |
| 3 | 开启后需管理员生成邀请码   | §5.2 邀请码支持次数 / 有效期 / 批量生成 / 作废          |
| 4 | 管理员可上架 / 下架商品  | §5.3 商品状态机 + 后台管理页                      |
| 5 | 可导出用户的购买记录     | §5.6 后台筛选导出 CSV / XLSX                  |
| 6 | 预留支付接口         | §5.5 PaymentProvider 适配器层，先内置 Mock 支付闭环 |
| 7 | 前后端分离          | §4 三个独立服务，REST API 通信                   |

---

## 2. 技术选型（推荐方案）

| 层                 | 选型                                              | 说明                                                           |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| 商城前端 `web/`       | **React 18 + TypeScript + Vite**                 | SPA，商品浏览 / 购物车 / 下单 / 个人中心（用户已确认 React）                    |
| 管理后台 `admin/`     | **React 18 + Ant Design**                        | 独立 SPA，中后台组件成熟（用户已确认 React）                                     |
| 演示站点 `site/`      | **React 18 + Vite（纯静态）**                        | GitHub Pages 用项目门面页，见 §11                                        |
| 后端 `backend/`     | **FastAPI (Python) + SQLAlchemy 2.0**            | 自动生成 OpenAPI 文档；Pydantic 校验；异步（用户已确认）                         |
| 主数据库              | **PostgreSQL 16**                               | 事务 / JSONB / 迁移成熟（即你说的 pg）                                   |
| 缓存/验证码/限流         | **PostgreSQL 表 + 进程内缓存（默认）**，Redis 备选          | **日均并发 ≈ 20 的规模不需要 Redis**（§3.1 详解）；代码用 KV 接口抽象，日后一条配置切换     |
| 对象存储              | **MinIO（已确认启用）**                              | 商品图片上传，S3 协议，生产可换云厂商 OSS                                        |
| 开发邮件              | Mailpit                                         | 本地捕获邮件，`http://localhost:8025` 可视化查看                         |
| 反向代理              | Nginx（生产环境）                                     | 托管 SPA 静态文件 + `/api` 反代，本地开发可省略                              |

> 备选方案：后端可换 NestJS（Node/TS 全家桶），前端可换 React + Ant Design。确认时说明即可。

---

## 3. 第三方容器清单（docker-compose 一键起）

### 3.1 必需容器（按你的实际规模裁剪）

| 容器           | 镜像                   | 用途                        | 本项目是否必装       |
| ------------ | -------------------- | ------------------------- | ------------- |
| **postgres** | `postgres:16-alpine` | 唯一主数据库：用户 / 商品 / 订单 / 邀请码 | ✅ 必装          |
| **redis**    | `redis:7-alpine`     | 缓存 / 限流 / 验证码             | ❌ **暂不装**（见下） |

> **为什么不需要 Redis：** 你说的日均并发 ≈ 20（约 1-2 req/s 峰值），PostgreSQL 单机轻松扛 1000+ 并发连接、数千万行级数据，这个量级下：
>
> - **验证码 TTL** → 一张 `verification_codes` 表 + 定期清理过期行，效果等同
> - **限流** → 进程内滑动窗口（uvicorn 单 worker 时完全够用；多 worker 后换 `KVRateLimiter`）
> - **热点缓存** → 这个流量根本不会打热任何缓存，直接查库
>
> 代码层面用 **`KVBase` 抽象接口** 封装（`kv.get/set/ttl/incr`），默认 `PgKVStore`（慢但持久）/`MemoryKVStore`（快但重启丢失）组合，切换 Redis 只需 `KV_BACKEND=redis` 一行配置 impl 不动。**先少跑一个容器，需要时再上**，不留任何重写成本。

### 3.2 推荐容器

| 容器          | 镜像                | 用途                                 | 本项目是否必装              |
| ----------- | ----------------- | ---------------------------------- | -------------------- |
| **minio**   | `minio/minio`     | 商品图片对象存储（S3 协议）                    | ✅ 已确认启用；生产可换云 OSS     |
| **mailpit** | `axllent/mailpit` | 开发环境 SMTP 捕获（`localhost:8025` 收件箱） | ✅ 开发时装（仅开发用）         |

### 3.3 生产环境容器

| 容器        | 镜像             | 用途                         |
| --------- | -------------- | -------------------------- |
| **nginx** | `nginx:stable` | 反向代理 + HTTPS 终端 + SPA 静态托管 |

> 生产环境最终只需跑 3 个容器：**postgres + api + nginx**（前端静态文件由 nginx 托管，图片若用云 OSS 则 MinIO 也省了）。

### 3.4 环境分层

| 环境     | 容器 / 组件                                                           | 说明                                  |
| ------ | ----------------------------------------------------------------- | ----------------------------------- |
| **开发** | postgres + mailpit（2 个容器）+ FastAPI 本地热更 + Vite dev server         | 改代码即生效；验证码邮件打开 `localhost:8025` 直接看 |
| **生产** | postgres + api（FastAPI 容器）+ nginx 托管两个 SPA 静态文件 + 真实 SMTP / 云 OSS | 3 个容器起步；HTTPS 由 nginx 或云负载均衡终结      |

**怎么从开发过渡到生产（健全的演进路径）**

1. 开发环境全部配置走 `.env`，同一份 `docker-compose.yml` 用 `--profile prod` / `docker-compose.prod.yml` 区分
2. 数据库结构只经 **Alembic 迁移**变更，生产升级 = 拉新镜像 + `alembic upgrade head`，可回滚
3. `.env.example` 完整列出全部变量并内置生成器：`python -c "import secrets; print(secrets.token_hex(32))"`
4. 密码用 **Argon2id** 哈希；生产密钥绝不与开发共用
5. 备份：`pg_dump` 每日定时任务，导出到独立磁盘/对象存储，**恢复演练**至少做一次
6. CI（可选后置）：push 时跑 pytest + 前端 build，绿了才允许部署

### 3.5 非容器化的外部服务（需要你申请账号 / 密钥）

| 服务               | 用途        | 需要的凭证                                                                          |
| ---------------- | --------- | ------------------------------------------------------------------------------ |
| Google OAuth 2.0 | 谷歌登录注册    | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（Google Cloud Console 创建 OAuth 客户端） |
| SMTP 邮件服务商（生产）   | 发送注册验证码邮件 | SendGrid / 阿里邮件推送 / SES 任一账号                                                   |
| 支付渠道（上线前接入）      | 收款        | Stripe / 支付宝 / 微信支付任意的商户号 + 密钥                                                 |

> 支付渠道不必现在申请 —— 接口已预留（§5.5），先用 Mock 支付跑通全流程，之后加一个适配器文件 + 一条配置即可切换。

### 3.6 `docker-compose.yml`（基础设施部分预览）

```yaml
services:
  postgres:                       # 唯一必装容器
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: shop
    ports: ["5432:5432"]
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop"]
      interval: 5s
      retries: 10

  mailpit:                        # 开发环境
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]   # SMTP + web inbox

  # redis / minio 暂不启用；需要时注释解开 + KV_BACKEND/S3 配置切换
volumes:
  pg_data:
```

---


## 4. 总体架构

```
                      ┌────────────┐
                      │   客户端     │  浏览器（桌面 / 移动）
                      └─────┬──────┘
                            │ HTTPS
                      ┌─────┴──────┐
                      │   Nginx    │  反代 + 静态托管（web / admin）
                      └─────┬──────┘
        ┌───────────────────┼───────────────────┐
  ┌─────┴──────┐      ┌─────┴──────┐      ┌─────┴──────┐
  │  商城 web   │      │  后台 admin │      │  api       │
  │  React SPA  │      │  React SPA  │      │  FastAPI   │
  └────────────┘      └────────────┘      └─────┬──────┘
                              ┌─────────────────┼───────────────┐
                        PostgreSQL 16        MinIO         Mailpit(dev)
                              └── 后端通过 SQLAlchemy / aiobotorker/boto3 访问 ──┘

  演示门面（site/，纯静态）→ GitHub Pages：https://<user>.github.io/<repo>/
  外部服务（api 直接调用）：Google OAuth · 支付渠道（预留）· 生产 SMTP
```

要点：

- **完全前后端分离**：`web` 与 `admin` 是两个独立构建的 SPA，只通过 `HTTPS + JSON` 与 `api` 通信，可独立部署、独立扩容。
- **权限边界**：所有 `/api/v1/admin/*` 路由要求 `role=admin` 的 JWT；普通用户不可达。
- **开发模式**：本地开发时前端 Vite dev server 代理 `/api` 到 FastAPI（`:8000`），容器只跑基础设施（pg / minio / mailpit），改动代码即时热更。
- **反篡改铁律**：前端回传的一切字段（价格、金额、角色、库存、用户身份）**仅作展示参考，一律不作为记账与权限依据**；订单金额由服务端按商品表现价重算，前端传来的数字直接丢弃。

---

## 5. 功能模块设计

### 5.1 认证与注册（Google + 邮箱）

**邮箱注册流程**

1. `POST /auth/register`：`email + password + invite_code?`；密码强度校验（≥8 位含数字字母），Argon2 哈希存储。
2. 后端生成 6 位数字验证码存 KV 层（默认 PostgreSQL 表，`verify:{email}`，TTL 10 分钟，60 秒重发冷却），经 SMTP 发送。
3. `POST /auth/verify-email` 校验通过 → 落库建用户 → 签发 JWT 自动登录。

**Google 注册 / 登录（授权码模式）**

1. 前端跳转 Google 授权页 → 回调带 `code` 到前端 → 交给 `POST /auth/google`。
2. 后端用 `code` 换 `access_token`，取 `sub/email/头像`。
3. 若 `invite_required` 开启：**Google 注册同样必须携带邀请码**（防止旁路绕过邀请机制）。
4. 邮箱已存在 → 绑定到 `oauth_accounts`（首次登录即登录）；不存在 → 建号（无密码字段）。

**会话（JWT）**

- access token：15 分钟；refresh token：30 天，哈希落库、支持吊销；刷新时轮换（旧 token 复用则视为泄露，吊销该用户全部会话）。
- 登出 = 吊销 refresh token（access 靠短有效期自然过期）。

### 5.2 功能：邀请注册开关 + 邀请码

**开关**：`system_settings` 表存 `invite_required: bool`，管理员后台一个开关随时切换，改动即生效（写入时清 KV 缓存）。

**邀请码**（管理员在后台）：

- 生成：8 位随机码（去掉易混淆字符）；支持**批量生成**；每码可配置**可用次数 / 有效期 / 备注**。
- 校验与扣减（防并发超用，单条 SQL 原子完成）：

```sql
-- Atomically consume one invite code slot; returns affected rows
UPDATE invite_codes
SET used_count = used_count + 1
WHERE code = :code AND status = 'active'
  AND used_count < max_uses
  AND (expires_at IS NULL OR expires_at > now());
```

- 管理列表：查看每码已用 / 剩余，支持一键作废。

### 5.3 商品管理（上架 / 下架）

- 商品字段：名称、slug、描述、价格（**分**，整数存储防浮点误差）、库存、图片（MinIO 对象 key 列表）、状态。
- 状态机：`draft（草稿）→ active（上架）→ retired（下架）`；下架对买家即时不可见，**不影响已创建订单**。
- 后台动作：新建 / 编辑 / **上架** / **下架** / 删除（有待单商品禁删）。
- 库存扣减用乐观锁防超卖：

```sql
-- Deduct stock only if enough remains; 0 affected rows = sold out
UPDATE products SET stock = stock - :qty
WHERE id = :id AND stock >= :qty;
```

### 5.4 购物车与订单

- 购物车：`cart_items` 表（user_id, product_id, qty），下单时校验库存并锁定。
- 订单金额 = 明细汇总（服务器端算，不信前端）。
- 状态机：`pending_payment → paid → shipped → completed`，可 `cancelled / refunded`。
- 订单号：`日期(YYYYMMDD) + 8 位随机`，全局唯一索引。


### 5.5 支付接口预留（核心）

采用**适配器 + 工厂**模式，业务层完全不感知具体渠道：

```python
# server/app/payments/base.py
from typing import Protocol

class PaymentProvider(Protocol):
    async def create_payment(self, order) -> PaymentResult:
        """Create a payment on the provider and return redirect/QR URL."""
    async def query_payment(self, provider_trade_no: str) -> PaymentStatus:
        """Actively query payment result (fallback when webhook is missed)."""
    async def handle_webhook(self, raw_body: bytes, headers: dict) -> WebhookResult:
        """Verify signature and translate provider events to internal status."""
    async def refund(self, provider_trade_no: str, cents: int) -> RefundResult:
        """Refund a paid order (partial or full)."""
```

- 实现：`MockProvider`（**随项目交付，模拟支付成功/失败，跑通完整下单-支付闭环**）+ `StripeProvider / AlipayProvider / WechatPayProvider`（预留）。
- 配置切换：环境变量 `PAYMENT_PROVIDER=mock`，工厂按名返回实现，加渠道只加文件不改业务。
- Webhook 统一入口：`POST /api/v1/payments/webhook/{provider}`；各渠道各自验签；`(provider, event_id)` 唯一约束保证幂等；回调保存原始报文便于审计。
- 主动补偿：未回调的订单定时轮询 `query_payment` 对账。

### 5.6 购买记录导出

- 范围：管理员导出**全体用户**购买记录（订单维度）；用户也能在个人中心导出自己的。
- 筛选：时间范围 / 用户 / 商品 / 订单状态。
- 格式：`CSV`（流式生成、UTF-8 BOM，Excel 直开）、`XLSX`（openpyxl 临时文件）。
- 权限：`admin` JWT 专用接口；`GET /api/v1/admin/export/orders?...&format=csv`，`StreamingResponse` 下发。
- 大数据量（>5 万行）后续可升级为后台任务异步导出，首版流式已够用。
- 审计：每次导出记录操作者、条件、行数到 `export_logs`。

### 5.7 管理后台（admin SPA）

| 菜单   | 功能                              |
| ---- | ------------------------------- |
| 仪表盘  | 销量 / 用户增长等基础统计（可后置）             |
| 商品管理 | 列表 / 新建 / 编辑 / **上架 / 下架**      |
| 订单管理 | 列表 / 详情 / 状态流转（发货、退款）           |
| 用户管理 | 列表 / 搜索 / 禁用启用 / 角色调整           |
| 邀请码  | **邀请注册开关** / 生成（含批量）/ 作废 / 用量查看 |
| 导出中心 | **购买记录导出**（§5.6），含导出历史审计        |

后台登录：`users.role=admin` 账号；与商城共用 JWT 方案但分离登录入口（`/admin` 独立页面）；后台会话要求刷新频率更高。

---


## 6. 数据库设计（PostgreSQL）

```mermaid
erDiagram
    users ||--o{ oauth_accounts : "google绑定"
    users ||--o{ refresh_tokens : "会话"
    users ||--o{ cart_items : "购物车"
    users ||--o{ orders : "下单"
    orders ||--o{ order_items : "明细"
    orders ||--o{ payments : "支付单"
    products ||--o{ cart_items : ""
    products ||--o{ order_items : ""
    admin_users ||--o{ invite_codes : "生成"
    invite_codes ||--o{ users : "被使用"
```

| 表                 | 关键字段                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `users`           | id, email(唯一), password_hash(可空,OAuth用户无), username, avatar_url, **role(user/admin)**, status, **invite_code_id**, created_at |
| `oauth_accounts`  | id, user_id, provider(google), provider_user_id(唯一), created_at                                                               |
| `refresh_tokens`  | id, user_id, token_hash, expires_at, revoked_at                                                                               |
| `invite_codes`    | id, code(唯一), **max_uses, used_count, expires_at, status, created_by, remark**                                                |
| `system_settings` | key(唯一), value(jsonb) —— 存 `invite_required` 等开关                                                                              |
| `products`        | id, name, slug(唯一), description, **price_cents**, stock, images(jsonb), **status(draft/active/retired)**, created_at          |
| `cart_items`      | user_id + product_id 唯一, qty                                                                                                  |
| `orders`          | id, order_no(唯一), user_id, **status**, total_cents, paid_at, created_at                                                       |
| `order_items`     | order_id, product_id, title快照, unit_price_cents, qty                                                                          |
| `payments`        | id, order_id, provider, provider_trade_no, amount_cents, status, raw_payload(jsonb)                                           |
| `export_logs`     | who, filters(jsonb), format, row_count, created_at                                                                            |

迁移用 **Alembic**，首个版本即建全表 + 种子数据（管理员账号、初始开关）。

---


## 7. API 设计（`/api/v1`，REST）

**认证**

```
POST /auth/register              email+password+invite_code? -> 发验证码
POST /auth/verify-email          验证码校验 -> 建号+JWT
POST /auth/login                 邮箱密码登录 -> JWT
POST /auth/google                Google code 换会话（invite_required 时须带 invite_code）
POST /auth/refresh | /auth/logout 刷新 / 登出
GET  /auth/me                    当前用户信息
```

**商品（公共）**

```
GET /products?search=&page=&sort=    分页列表（仅 active）
GET /products/{slug}                 商品详情
```

**购物车 / 订单（需登录）**

```
GET/POST/PATCH/DELETE /cart/items
POST /orders                          购物车结算下单（乐观锁扣库存）
GET  /orders / GET /orders/{id}        我的订单
POST /orders/{id}/pay                  选渠道发起支付 -> 返回支付跳转/二维码链接
GET  /me/export/orders                 导出自己的购买记录
```

**支付回调（无鉴权，验签）**

```
POST /payments/webhook/{provider}      mock/stripe/alipay/wechat_pay
```

**管理后台（role=admin）**

```
GET/POST/PATCH/DELETE /admin/products       商品 CRUD
POST  /admin/products/{id}/publish|unpublish 上架 / 下架
GET/POST/PATCH/DELETE /admin/invite-codes      邀请码生成/批量/作废
GET/PATCH /admin/settings                      读写 invite_required 等开关
GET /admin/users  PATCH /admin/users/{id}      用户管理
GET /admin/orders ...                          订单查看与流转
GET /admin/export/orders                       ★ 购买记录导出 csv|xlsx
```

> FastAPI 自动产出 Swagger：开发期 `http://localhost:8000/docs` 直接调试。

---

## 8. 安全设计

- **反篡改（首要原则）**：前端回传的任何字段不作为业务依据——订单金额服务端按商品表现价重算；角色/权限只认服务端 JWT claims + 数据库；库存与状态以数据库为准；结算数量服务端校验。
- 所有入参经 **Pydantic 严格校验**（白名单字段 + 类型/长度/范围），多余字段直接拒绝。
- 密码 **Argon2id**；任何接口不回传 password_hash。
- JWT HS256 强随机密钥（`python -c "import secrets;print(secrets.token_hex(32))"` 生成，入 `.env`）。
- **限流（KV 层，默认进程内 + PG）**：登录/注册/发码按 `IP + 邮箱` 双维度滑动窗口。
- CORS 白名单仅放行商城与后台两个域名（独立域名即 `WEB_ORIGIN` / `ADMIN_ORIGIN`）。
- 管理接口依赖注入校验 `role=admin`；admin 与普通用户共库但后台独立登录、独立 token TTL；**后台支持独立域名部署**，默认隔离部署（§5.7）。
- webhook：保留原始 body 验签、事件唯一键幂等、来源 IP 不作唯一凭据。
- SQL 全部走 ORM 参数化，杜绝字符串拼接注入。
- 导出等敏感操作全部落审计日志。
- `.env` 不入库 git；compose 里的默认密码仅限开发，上线全部替换。
- 上线检查单：数据库端口不暴露公网 / HTTPS 强制 / 依赖版本无已知漏洞（`pip-audit`）/ 管理后台加 IP 白名单或 VPN 可选加固。

## 9. 环境变量清单（`.env.example`）

```
# === Core ===
DATABASE_URL=postgresql+asyncpg://shop:PASS@localhost:5432/shop
# KV 层：默认 PG 实现，不装 Redis；将来切换只需下面一行
# KV_BACKEND=redis  REDIS_URL=redis://:PASS@localhost:6379/0
KV_BACKEND=pg
JWT_SECRET=change-me
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=30

# === Google OAuth ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
WEB_ORIGIN=http://localhost:5173      # 商城前端
ADMIN_ORIGIN=http://localhost:5174    # 后台前端

# === Mail (dev -> mailpit) ===
SMTP_HOST=mailpit
SMTP_PORT=1025
MAIL_FROM=no-reply@shop.local

# === Storage ===
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY= MINIO_SECRET_KEY= MINIO_BUCKET=products

# === Payment adapter ===
PAYMENT_PROVIDER=mock                 # mock|stripe|alipay|wechat_pay
# 以下接入时才填
STRIPE_API_KEY=
ALIPAY_APP_ID= ALIPAY_PRIVATE_KEY=
WECHAT_PAY_MCH_ID= WECHAT_PAY_KEY=

# === Business ===
INVITE_REQUIRED_DEFAULT=false
```

## 10. 目录结构与里程碑

```
shop/                       # 仓库名待定（见 §11 命名建议）→ GitHub 仓库根
├─ docs/                    # 设计文档（本文件）
├─ backend/                 # 后端 FastAPI
│  ├─ app/
│  │  ├─ api/v1/            # 路由：auth, products, cart, orders, payments, admin
│  │  ├─ core/              # 配置、安全(JWT/argon2)、依赖注入
│  │  ├─ models/            # SQLAlchemy 模型
│  │  ├─ schemas/           # Pydantic DTO
│  │  ├─ services/          # 业务逻辑（金额重算、库存锁）
│  │  └─ payments/          # ★ 支付适配器：base.py, mock.py, stripe.py...
│  ├─ alembic/              # 数据库迁移
│  └─ requirements.txt
├─ web/                     # 商城前端 React SPA
├─ admin/                   # 管理后台 React SPA
├─ site/                    # ★ GitHub Pages 演示门面（纯静态，§11）
├─ docker-compose.yml       # 基础设施（pg + minio + mailpit）
├─ .github/workflows/pages.yml   # Pages 自动部署
├─ .env.example
└─ README.md
```

里程碑：M1 基建+docker-compose+骨架 → M2 认证注册（含邀请码）→ M3 商品+购物车 → M4 订单+Mock 支付闭环+webhook → M5 管理后台（上下架/开关/邀请码/导出）→ M6 演示站点上线 Pages。

## 11. GitHub Pages 演示站点（site/）

**用途**：项目门面页。仓库推上 GitHub 后，访客通过 `https://<user>.github.io/<repo>/` 直接看到"这项目是什么、长什么样、怎么跑"，无需克隆。

**形态约束（必须纯静态）**

- GitHub Pages 只能托管静态文件——**没有数据库、没有后端**。演示页只做展示，不连真实 API。
- 生产环境真实功能仍部署在你自己的服务器（pg + api + nginx），Pages 只负责"给人看"。

**页面内容**

1. **Hero**：一句话介绍 + 技术徽章（FastAPI / React / PostgreSQL / MinIO / Docker）
2. **功能卡片**：邮箱+Google 注册 / 邀请注册开关+邀请码 / 商品上下架 / Mock 支付流程 / 订单记录导出（CSV·XLSX）
3. **模拟商城预览**：内置假数据（静态 JSON）渲染商品卡片、购物车样式、订单状态流转图——**纯前端动画演示，不发任何请求**
4. **架构图**：即 §4 的图（构建时内联进 bundle）
5. **快速开始**：克隆 → `docker compose up` → 访问的命令块
6. **路线图**：M1–M6 里程碑进度条（从 README 同步）

**技术要点**

- React 18 + Vite 独立构建（与 web/admin 同栈但独立目录 `site/`），产物 `site/dist`
- **`base` 配置**：Vite `base: '/<repo>/'`——Pages 是子路径部署（`user.github.io/repo/`），不改 base 会出现资源 404；若你后续绑独立域名，改回 `base: '/'`
- **路由**：单页无路由（或 hash 路由），因为 Pages 子路径 + browser router 需要 404.html hack
- **部署**：`.github/workflows/pages.yml`——push 到 main 时自动 `npm run build` 并把 `site/dist` 发布到 Pages（官方 actions/deploy-pages 流程）
- 假数据集中在 `site/src/mock/`，与真实 web 前端的 API 层完全隔离，不产生混淆

## 12. GitHub 仓库命名建议

| 仓库命名选项 | 适合场景 |
|------------|---------|
| **`swift-shop`** ✅ 推荐 | 朗朗上口，"swift" 暗合快速交付 |
| `E-Commerce-FastAPI-React` | SEO 直白，方便检索技术栈组合 |
| `ShopFlow` | 简洁品牌感，无技术栈耦合 |
| `shop-platform` | 中性名，适合以后扩展多租户 |

推荐 Repo 描述（可直接复制）：

> 全栈电商解决方案：FastAPI + React 前后端分离，支持 Google/邮箱注册、邀请码开关、商品上下架、订单记录导出，支付网关接口已预留。附 GitHub Pages 演示站点。
