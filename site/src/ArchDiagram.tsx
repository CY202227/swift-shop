// Inline architecture diagram (same shape as docs/DESIGN.md §4) so it ships
// inside the single-page bundle without any external asset.
export default function ArchDiagram() {
  return (
    <svg viewBox="0 0 860 330" className="arch-svg" role="img" aria-label="系统架构图">
      {/* Client */}
      <rect x="10" y="40" width="120" height="52" rx="8" className="box" />
      <text x="70" y="70" textAnchor="middle" className="txt">浏览器</text>

      {/* Nginx */}
      <rect x="180" y="40" width="120" height="52" rx="8" className="box" />
      <text x="240" y="62" textAnchor="middle" className="txt">Nginx</text>
      <text x="240" y="80" textAnchor="middle" className="txt sub">反代 + 静态托管</text>

      {/* SPAs */}
      <rect x="360" y="10" width="130" height="52" rx="8" className="box spa" />
      <text x="425" y="32" textAnchor="middle" className="txt">商城 web</text>
      <text x="425" y="50" textAnchor="middle" className="txt sub">React 18 SPA · :5173</text>

      <rect x="360" y="80" width="130" height="52" rx="8" className="box spa" />
      <text x="425" y="102" textAnchor="middle" className="txt">后台 admin</text>
      <text x="425" y="120" textAnchor="middle" className="txt sub">React 18 + AntD · :5174</text>

      {/* API */}
      <rect x="560" y="45" width="150" height="52" rx="8" className="box api" />
      <text x="635" y="67" textAnchor="middle" className="txt">FastAPI :8010</text>
      <text x="635" y="85" textAnchor="middle" className="txt sub">JWT · argon2 · /api/v1</text>

      {/* Infra row */}
      <rect x="360" y="190" width="150" height="52" rx="8" className="box infra" />
      <text x="435" y="212" textAnchor="middle" className="txt">PostgreSQL 16</text>
      <text x="435" y="230" textAnchor="middle" className="txt sub">SQLite(dev) 切换</text>

      <rect x="550" y="190" width="140" height="52" rx="8" className="box infra" />
      <text x="620" y="212" textAnchor="middle" className="txt">MinIO / 本地盘</text>
      <text x="620" y="230" textAnchor="middle" className="txt sub">同一存储接口</text>

      <rect x="180" y="190" width="140" height="52" rx="8" className="box infra" />
      <text x="250" y="212" textAnchor="middle" className="txt">Mailpit</text>
      <text x="250" y="230" textAnchor="middle" className="txt sub">开发邮件捕获</text>

      {/* Payments + Pages */}
      <rect x="740" y="10" width="110" height="52" rx="8" className="box ext" />
      <text x="795" y="32" textAnchor="middle" className="txt">支付渠道</text>
      <text x="795" y="50" textAnchor="middle" className="txt sub">Mock / 预留</text>

      <rect x="740" y="80" width="110" height="52" rx="8" className="box ext" />
      <text x="795" y="102" textAnchor="middle" className="txt">Google</text>
      <text x="795" y="120" textAnchor="middle" className="txt sub">OAuth 2.0</text>

      {/* Pages badge */}
      <rect x="10" y="140" width="150" height="40" rx="20" className="pages-pill" />
      <text x="85" y="165" textAnchor="middle" className="txt small">GitHub Pages 静态门面</text>

      {/* Connectors */}
      <line x1="130" y1="66" x2="180" y2="66" className="wire" />
      <line x1="300" y1="66" x2="360" y2="36" className="wire" />
      <line x1="300" y1="66" x2="360" y2="106" className="wire" />
      <line x1="490" y1="36" x2="560" y2="60" className="wire" />
      <line x1="490" y1="106" x2="560" y2="82" className="wire" />
      <line x1="635" y1="97" x2="460" y2="190" className="wire" />
      <line x1="635" y1="97" x2="630" y2="190" className="wire" />
      <line x1="250" y1="120" x2="250" y2="140" className="wire dashed" />
      <line x1="250" y1="180" x2="250" y2="190" className="wire" />
      <line x1="710" y1="30" x2="740" y2="30" className="wire" />
      <line x1="710" y1="70" x2="740" y2="106" className="wire" />

      {/* Legend */}
      <text x="10" y="300" className="txt tiny">
        admin/* 路由要求 role=admin 的 JWT；订单金额一律服务端按商品表重算，前端数字仅作展示。
      </text>
    </svg>
  );
}
