import { useState } from "react";
import { features, milestones, quickStart } from "./mock";
import StoreDemo from "./StoreDemo";
import StoreReplica from "./StoreReplica";
import ArchDiagram from "./ArchDiagram";

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section">
      <div className="kicker">{kicker}</div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [showReplica, setShowReplica] = useState(false);

  if (showReplica) {
    return <StoreReplica onExit={() => setShowReplica(false)} />;
  }

  return (
    <div className="page">
      {/* ---------- Hero ---------- */}
      <header className="hero">
        <nav className="nav">
          <span className="brand">🃏 PTCG Shop</span>
          <div className="nav-links">
            <a href="#features">功能</a>
            <a
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                setShowReplica(true);
              }}
            >
              商城浏览
            </a>
            <a href="#arch">架构</a>
            <a href="#quickstart">快速开始</a>
            <a href="#roadmap">路线图</a>
          </div>
        </nav>
        <div className="hero-body">
          <h1>PTCG 卡牌商城，一套跑通</h1>
          <p>宝可梦集换式卡牌在线店 · FastAPI + React 前后端分离 · 邮箱注册 · 邀请码 · Mock 支付闭环 · 订单导出</p>
          <div className="badges">
            <span className="chip">FastAPI</span>
            <span className="chip">React 18</span>
            <span className="chip">TypeScript</span>
            <span className="chip">PostgreSQL</span>
            <span className="chip">MinIO</span>
            <span className="chip">Ant Design</span>
            <span className="chip">Docker</span>
            <span className="chip">GitHub Pages</span>
          </div>
          <div className="cta-row">
            <a
              className="cta primary"
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                setShowReplica(true);
              }}
            >
              进入商城浏览
            </a>
            <a
              className="cta ghost"
              href="https://github.com/YOUR_NAME/swift-shop"
              target="_blank"
              rel="noreferrer"
            >
              查看源码
            </a>
          </div>
        </div>
      </header>

      {/* ---------- Features ---------- */}
      <Section id="features" kicker="六大核心能力" title="这不是截图，是跑得动的代码">
        <div className="feature-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- Store demo ---------- */}
      <Section id="demo" kicker="商城真实界面复刻" title="与前端一模一样 · 点击进入浏览">
        <p className="note" style={{ marginBottom: 18 }}>
          点击下方按钮进入商城复刻视图：注册 → 验证 → 登录 → 加购 → 购物车改数量 → 结算 → 模拟支付 → 订单变「已支付」。
          界面与真实 web 前端（React 18）完全一致，数据为页面内置假数据，不发任何网络请求。
        </p>
        <div className="cta-row" style={{ justifyContent: "flex-start", marginBottom: 22 }}>
          <a
            className="cta primary"
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              setShowReplica(true);
            }}
          >
            🃏 进入商城浏览
          </a>
        </div>
        <StoreDemo />
      </Section>

      {/* ---------- Architecture ---------- */}
      <Section id="arch" kicker="总体架构" title="三个前端 + 一个 API + 可插拔基础设施">
        <div className="arch-wrap">
          <ArchDiagram />
        </div>
      </Section>

      {/* ---------- Quick start ---------- */}
      <Section id="quickstart" kicker="快速开始" title="从 clone 到下单，六条命令">
        <pre className="code">
          {quickStart.map((line) => (
            <div key={line} className={line.startsWith("cd ") || line.includes("docker") ? "cmd" : ""}>
              <code>$ {line}</code>
            </div>
          ))}
        </pre>
        <p className="note">
          首次启动自动建表并写入种子：管理员 <code>admin@shop-dev.com / Admin#12345</code> + 4 件演示商品。
          开发环境验证码会打印在后端控制台（Mailpit 未启动时）。
        </p>
      </Section>

      {/* ---------- Roadmap ---------- */}
      <Section id="roadmap" kicker="路线图" title="M1 – M6 全部交付">
        <div className="roadmap">
          {milestones.map((m, i) => (
            <div key={m.name} className={"milestone" + (m.done ? " done" : "")}>
              <div className="ms-dot">{m.done ? "✓" : i + 1}</div>
              <div className="ms-name">{m.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <footer className="footer">
        PTCG Shop · 本页为 GitHub Pages 静态门面，真实系统为前后端分离部署 · 设计文档见仓库 <code>docs/DESIGN.md</code>
      </footer>
    </div>
  );
}
