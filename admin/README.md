# Swift Shop 管理后台（admin）

React 18 + TypeScript + Vite + Ant Design 5 中后台 SPA，对接 `../backend` FastAPI。

## 开发

```bash
npm install
npm run dev        # http://localhost:5174，/api 与 /uploads 代理到 http://localhost:8010
```

管理员账号：`u1@test.com / Passw0rd123`（可自行在数据库改）。

## 页面

| 菜单 | 功能 | 后端接口 |
| --- | --- | --- |
| 仪表盘 | 用户/商品/订单/收入统计卡片 | GET /admin/dashboard |
| 商品管理 | 列表搜索筛选、新建、编辑、上架/下架、删除（有订单史只能下架） | /admin/products |
| 邀请码 / 注册设置 | invite_required 开关（即时生效）、批量生成（次数/有效期/备注）、作废 | /admin/settings、/admin/invite-codes |
| 用户管理 | 搜索、角色调整（自锁保护）、禁用/启用 | /admin/users |
| 订单 / 导出 | 状态/用户筛选、明细展开、CSV 导出（审计日志） | /admin/orders |

安全：JWT 与 web 前端独立存储（admin_access/admin_refresh 前缀）；
非 admin 角色 403 拦截；自家账号无法自我降级（后端硬保护）。
