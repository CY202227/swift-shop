import { createContext, useContext } from "react";

// Lightweight i18n for the static Pages facade: a single dictionary keyed by
// zh/en, with a React context so every section/component can localize without
// prop-drilling. Default language is Chinese (the site's primary audience).

export type Lang = "zh" | "en";

export const dict = {
  zh: {
    nav_features: "功能",
    nav_demo: "商城浏览",
    nav_admin: "管理后台",
    nav_arch: "架构",
    nav_quickstart: "快速开始",
    nav_roadmap: "路线图",
    hero_title: "PTCG 卡牌商城，一套跑通",
    hero_sub: "宝可梦集换式卡牌在线店 · FastAPI + React 前后端分离 · 邮箱注册 · 邀请码 · Mock 支付闭环 · 订单导出",
    cta_browse: "进入商城浏览",
    cta_admin: "进入管理后台",
    cta_source: "查看源码",
    features_kicker: "六大核心能力",
    features_title: "这不是截图，是跑得动的代码",
    demo_kicker: "商城真实界面复刻",
    demo_title: "与前端一模一样 · 点击进入浏览",
    demo_note: "点击下方按钮进入商城复刻视图：注册 → 验证 → 登录 → 加购 → 购物车改数量 → 结算 → 模拟支付 → 订单变「已支付」。界面与真实 web 前端（React 18）完全一致，数据为页面内置假数据，不发任何网络请求。",
    arch_kicker: "总体架构",
    arch_title: "三个前端 + 一个 API + 可插拔基础设施",
    quickstart_kicker: "快速开始",
    quickstart_title: "从 clone 到下单，六条命令",
    quickstart_note: "首次启动自动建表并写入种子：管理员 admin@shop-dev.com / Admin#12345 + 4 件演示商品。开发环境验证码会打印在后端控制台（Mailpit 未启动时）。",
    roadmap_kicker: "路线图",
    roadmap_title: "M1 – M6 全部交付",
    footer_text: "PTCG Shop · 本页为 GitHub Pages 静态门面，真实系统为前后端分离部署 · 设计文档见仓库 docs/DESIGN.md",
    exit_facade: "← 返回门面",
    lang_toggle: "EN",
  },
  en: {
    nav_features: "Features",
    nav_demo: "Storefront",
    nav_admin: "Backoffice",
    nav_arch: "Architecture",
    nav_quickstart: "Quick Start",
    nav_roadmap: "Roadmap",
    hero_title: "A full PTCG card shop, one repo",
    hero_sub: "Pokémon TCG online store · FastAPI + React split stack · Email signup · Invite codes · Mock payment loop · Order export",
    cta_browse: "Browse the store",
    cta_admin: "Open the backoffice",
    cta_source: "View source",
    features_kicker: "Six core capabilities",
    features_title: "Not screenshots — running code",
    demo_kicker: "Pixel-accurate storefront replica",
    demo_title: "Identical to the real frontend · Click to browse",
    demo_note: "Enter the replica view: register → verify → login → add to cart → change quantity → checkout → mock pay → order flips to Paid. The UI matches the real web frontend (React 18); data is in-page mock with zero network calls.",
    arch_kicker: "Architecture",
    arch_title: "Three frontends + one API + pluggable infra",
    quickstart_kicker: "Quick start",
    quickstart_title: "Clone to checkout in six commands",
    quickstart_note: "First boot auto-creates tables and seeds: admin admin@shop-dev.com / Admin#12345 + 4 demo products. Dev verification codes print to the backend console (when Mailpit is off).",
    roadmap_kicker: "Roadmap",
    roadmap_title: "M1 – M6 all delivered",
    footer_text: "PTCG Shop · This page is a static GitHub Pages facade; the real system is a split deployment · Design doc: docs/DESIGN.md",
    exit_facade: "← Back to facade",
    lang_toggle: "中文",
  },
} as const;

export type SiteKey = keyof typeof dict.zh;

export const SiteI18nCtx = createContext<{
  lang: Lang;
  t: (k: SiteKey) => string;
  setLang: (l: Lang) => void;
}>({ lang: "zh", t: (k) => dict.zh[k], setLang: () => {} });

export const useI18n = () => useContext(SiteI18nCtx);
