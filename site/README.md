# Swift Shop 演示门面（site）

纯静态 React 18 + Vite 单页站点，用于 GitHub Pages 展示。**无任何后端请求**——商城预览、订单流转全部由 `src/mock.ts` 假数据驱动，符合设计文档 §11 约束。

## 区块

1. **Hero**：项目名 + 技术徽章 + GitHub Pages 链接
2. **功能卡片**：邮件验证注册 / JWT 双令牌 / 库存扣减与取消回滚 / Mock 支付签名回调 / 邀请码注册 / Admin 中后台
3. **模拟商城预览**：商品卡 → 加购动画 → 订单状态流转（pending → paid / cancelled），纯前端演示
4. **架构图**：web(5173) / admin(5174) → FastAPI(8010) → SQLite · MinIO · Mailpit，内联 SVG
5. **快速开始**：clone → 后端 venv/uvicorn → web/admin npm dev 三步命令块
6. **路线图**：M1–M6 里程碑进度

## 开发与构建

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → dist/（base 默认 /swift-shop/）
npm run preview  # 本地验证 dist/
```

## GitHub Pages 路径

- 构建基路径 `base: '/swift-shop/'`（仓库名即路径，见 `vite.config.ts`）
- 仓库改名时设置环境变量 `REPO_SLUG=<新名>`；本地根路径预览设 `SITE_BASE=/`
- 部署 workflow：`.github/workflows/pages.yml`（push main 自动 构建 → 上传 → 发布 Pages）
