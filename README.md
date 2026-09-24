# PTCG Shop 🃏

宝可梦集换式卡牌（PTCG）在线商城：**FastAPI + React 前后端分离**，支持邮箱注册、Google 登录、邀请码开关、三级角色权限、折扣/全场活动引擎、卡牌商品上下架、营收统计、订单导出，支付网关接口已预留（内置 Mock 支付闭环）。商城页与管理后台均支持 **中英双语切换**。

> 🌐 **在线演示门面**：<https://YOUR_NAME.github.io/swift-shop/>（`site/` 构建产物，纯静态展示）
> 📖 **设计文档**：[docs/DESIGN.md](docs/DESIGN.md)

## 技术栈

| 层 | 技术 |
| --- | --- |
| 商城前端 `web/` | React 18 + TypeScript + Vite |
| 管理后台 `admin/` | React 18 + TypeScript + **Ant Design 5** |
| 演示门面 `site/` | React 18 + Vite（纯静态 → GitHub Pages） |
| 后端 `backend/` | **FastAPI** + SQLAlchemy 2.0 (async) + Pydantic v2 |
| 数据库 | PostgreSQL 16（开发默认 SQLite，零基建启动） |
| 对象存储 | MinIO / 本地磁盘（同一个接口抽象，配置切换） |
| 认证 | JWT (access + refresh 旋转) + argon2 + Google OAuth |
| 基础设施 | docker-compose：pg + minio + mailpit |

## 功能一览

- 📧 邮箱验证码注册 / 登录 / Google OAuth（§ 设计 5.1）
- 🌍 **i18n 中英双语**：web / admin / site 三端 `navigator.language` 自动检测 + 一键切换（localStorage 持久化）
- 👥 **三级角色权限**：`user / admin / super_admin`
  - **admin**：查看订单与用户、设置商品/会员折扣、导出 CSV；后台菜单自动裁剪（活动/邀请码/营收不可见）
  - **super_admin**：商品增删改与上下架、发起/结束全场活动、邀请码、营收统计、封禁、角色分配、商城名设置
- 🏷️ **定价引擎（服务端单一事实，整数 floor）**：商品折扣% × 全场活动%（或买N送1）× 会员个人折扣%，订单快照留存小计/折扣/活动名
- 🎉 全场活动：`percent_off` / `buy_n_get_1` 两种，同一时间仅一个生效；商城页横幅实时展示
- 📈 营收统计：已实现（已支付）/ 预计（待支付）+ 近 30 天逐日曲线（内联 SVG）
- 🎟️ 管理员可随时开关「邀请注册」，邀请码支持次数/有效期/批量生成/作废
- 📦 商品上架（draft → active → retired 状态机），有订单史的商品只可下架不可删除
- 🛒 购物车 → 下单（服务端重算金额、原子扣库存、幂等支付回调）→ Mock 收银台闭环（HMAC 签名 webhook）
- 📊 管理后台：仪表盘 / 商品 / 邀请码 / 用户（禁用/角色/折扣）/ 订单（按状态/用户筛选）
- 🔒 安全：金额服务端重算、refresh 旋转 + 重放吊销、管理员自我锁死保护、最后一名 super 不可降级
- ✅ 集成测试：`backend/tests/integration_smoke.py`（28 项：权限矩阵 / 定价 / 下单支付闭环全过）

## 快速开始

```bash
# 1) 基础设施（可选；开发默认 SQLite + 本地盘存储，可不启动）
docker compose up -d          # pg + minio + mailpit

# 2) 后端（:8010，首次启动自动建表 + 种子管理员 + 4 张 PTCG 演示卡牌）
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows；macOS/Linux 用 .venv/bin/pip
cp .env.example .env                                # 开箱即用，无需修改
.venv/Scripts/python -m uvicorn app.main:app --port 8010

# 3) 商城前端（:5173）
cd web && npm install && npm run dev

# 4) 管理后台（:5174）
cd admin && npm install && npm run dev

# 5) 演示门面（本地预览）
cd site && npm install && npm run dev
```

**默认账号**（首次启动种子生成；`u1` 为演示普通管理员而设，生产环境请删除）：

- 超级管理员：`admin@shop-dev.com / Admin#12345`
- 普通管理员：`u1@test.com / Passw0rd123`（菜单自动裁剪，可对比两种角色视角）
- 验证码：开发环境（未启动 Mailpit 时）打印在后端控制台 `[mail:dev] verification code for <email>: 123456`

**实验数据**（首次启动种子）：喷火龙 ex·SSP 带商品折扣 10%；全场活动「opening 10% off」生效中；`u1` 等会员账号带 5% 个人折扣——三折叠加即可演示完整定价链（¥299 → ¥242.19 单价，下单再减 5%）。

## 目录结构

```
shop/
├─ docs/DESIGN.md        # 总体设计（选型/架构/接口/数据库）
├─ backend/              # FastAPI + SQLAlchemy async
│  └─ app/
│     ├─ api/v1/         # auth, products, cart, orders, payments, admin_*
│     ├─ core/           # config / security(JWT+argon2) / kv 抽象 / deps
│     ├─ schemas.py      # Pydantic DTO（出入参即文档）
│     ├─ models.py       # 12 张表 ORM
│     ├─ services/       # mailer / settings / storage(local|s3)
│     └─ payments/       # 支付适配器：base / mock（stripe 可插拔扩展）
├─ web/                  # 商城 SPA（React 18 + TS + Vite）
├─ admin/                # 管理后台 SPA（React 18 + AntD 5）
├─ site/                 # GitHub Pages 演示门面（纯静态）
├─ docker-compose.yml    # pg + minio + mailpit
└─ .github/workflows/pages.yml   # Pages 自动部署
```

## 里程碑

- [x] **M1** 基建：docker-compose + 仓库骨架
- [x] **M2** 认证注册：邮箱验证码 / JWT 双令牌 / Google OAuth 接口 / 邀请码（开关+原子消耗）
- [x] **M3** 商品 + 购物车：上架状态机、加改删、库存校验
- [x] **M4** 订单 + Mock 支付闭环：服务端重算、原子扣库存、签名 webhook、取消回库存
- [x] **M5** 管理后台：仪表盘 / 商品 / 邀请码 / 用户 / 订单（CSV + 审计）
- [x] **M6** 演示门面：site/ + GitHub Pages workflow
- [x] **M7** 角色分级 + 定价引擎：三级权限矩阵、商品/活动/会员折扣叠加（整数 floor）、营收统计、三端 i18n、Google 登录入口、管理后台复刻展示

## 生产部署提示

- 反代 Nginx 托管 `web/dist`、`admin/dist`，`/api` 与 `/uploads` 反代 FastAPI
- 必改：`JWT_SECRET`、`DATABASE_URL`(PostgreSQL)、`ADMIN_DEFAULT_PASSWORD`、真实 SMTP
- 支付：实现 `app/payments/base.py` 的 `PaymentProvider` 接口即可接入 stripe/alipay/wechat
