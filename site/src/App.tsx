import { useState } from "react";
import { dict, SiteI18nCtx, useI18n, type Lang, type SiteKey } from "./i18n";
import { features, milestones, quickStart } from "./mock";
import StoreDemo from "./StoreDemo";
import StoreReplica from "./StoreReplica";
import AdminReplica from "./AdminReplica";
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

function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const t = (k: SiteKey) => dict[lang][k];
  return (
    <SiteI18nCtx.Provider value={{ lang, t, setLang }}>
      {children}
    </SiteI18nCtx.Provider>
  );
}

export default function App() {
  const [view, setView] = useState<"facade" | "store" | "admin">("facade");

  return (
    <I18nProvider>
      <Shell view={view} setView={setView} />
    </I18nProvider>
  );
}

function Shell({ view, setView }: { view: "facade" | "store" | "admin"; setView: (v: "facade" | "store" | "admin") => void }) {
  const { lang, t, setLang } = useI18n();
  const en = lang === "en";

  if (view === "store") {
    return <StoreReplica onExit={() => setView("facade")} lang={lang} />;
  }
  if (view === "admin") {
    return <AdminReplica onExit={() => setView("facade")} lang={lang} />;
  }

  return (
    <div className="page">
      {/* ---------- Hero ---------- */}
      <header className="hero">
        <nav className="nav">
          <span className="brand">🃏 PTCG Shop</span>
          <div className="nav-links">
            <a href="#features">{t("nav_features")}</a>
            <a
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                setView("store");
              }}
            >
              {t("nav_demo")}
            </a>
            <a
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                setView("admin");
              }}
            >
              {t("nav_admin")}
            </a>
            <a href="#arch">{t("nav_arch")}</a>
            <a href="#quickstart">{t("nav_quickstart")}</a>
            <a href="#roadmap">{t("nav_roadmap")}</a>
            <button className="btn-link lang-toggle" onClick={() => setLang(en ? "zh" : "en")}>
              {t("lang_toggle")}
            </button>
          </div>
        </nav>
        <div className="hero-body">
          <h1>{t("hero_title")}</h1>
          <p>{t("hero_sub")}</p>
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
                setView("store");
              }}
            >
              {t("cta_browse")}
            </a>
            <a
              className="cta primary-ghost"
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                setView("admin");
              }}
            >
              {t("cta_admin")}
            </a>
            <a
              className="cta ghost"
              href="https://github.com/YOUR_NAME/swift-shop"
              target="_blank"
              rel="noreferrer"
            >
              {t("cta_source")}
            </a>
          </div>
        </div>
      </header>

      {/* ---------- Features ---------- */}
      <Section id="features" kicker={t("features_kicker")} title={t("features_title")}>
        <div className="feature-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{en ? f.title_en : f.title}</h3>
              <p>{en ? f.desc_en : f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- Store demo ---------- */}
      <Section id="demo" kicker={t("demo_kicker")} title={t("demo_title")}>
        <p className="note" style={{ marginBottom: 18 }}>
          {t("demo_note")}
        </p>
        <div className="cta-row" style={{ justifyContent: "flex-start", marginBottom: 22 }}>
          <a
            className="cta primary"
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              setView("store");
            }}
          >
            🃏 {t("cta_browse")}
          </a>
          <a
            className="cta primary-ghost"
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              setView("admin");
            }}
          >
            🧑‍💼 {t("cta_admin")}
          </a>
        </div>
        <StoreDemo />
      </Section>

      {/* ---------- Architecture ---------- */}
      <Section id="arch" kicker={t("arch_kicker")} title={t("arch_title")}>
        <div className="arch-wrap">
          <ArchDiagram />
        </div>
      </Section>

      {/* ---------- Quick start ---------- */}
      <Section id="quickstart" kicker={t("quickstart_kicker")} title={t("quickstart_title")}>
        <pre className="code">
          {quickStart.map((line) => (
            <div key={line} className={line.startsWith("cd ") || line.includes("docker") ? "cmd" : ""}>
              <code>$ {line}</code>
            </div>
          ))}
        </pre>
        <p className="note">{t("quickstart_note")}</p>
      </Section>

      {/* ---------- Roadmap ---------- */}
      <Section id="roadmap" kicker={t("roadmap_kicker")} title={t("roadmap_title")}>
        <div className="roadmap">
          {milestones.map((m, i) => (
            <div key={m.name} className={"milestone" + (m.done ? " done" : "")}>
              <div className="ms-dot">{m.done ? "✓" : i + 1}</div>
              <div className="ms-name">{en ? m.name_en : m.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <footer className="footer">{t("footer_text")}</footer>
    </div>
  );
}
