# Swift Shop 商城前端（web）

React 18 + TypeScript + Vite SPA，对接 `../backend` FastAPI。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173，/api 代理到 http://localhost:8010
```

要求后端已在 8010 端口运行（本机 8000 被其他进程占用）。

## 功能

- 邮箱注册 + 验证码验证 / 密码登录 / 退出
- JWT Bearer 注入 + 401 自动刷新重试（单飞刷新，防并发刷新旋转）
- 商品列表 / 详情 / 加购
- 购物车（改数量 / 删除 / 结算下单）
- 我的订单（Mock 支付跳转收银台 / 取消订单 / 状态徽标）
- 个人中心

验证码在开发环境（Mailpit 未启动时）会回退打印到后端控制台，
形如 `[mail:dev] verification code for <email>: 123456`。
