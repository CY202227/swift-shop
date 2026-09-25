import { ConfigProvider } from "antd";
import antdEn from "antd/locale/en_US";
import antdZh from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AdminI18nContext, detectLang, saveLang, translateAdmin, type AdminLang } from "./i18n";

// i18n provider shell: holds the backoffice language and keeps antd's own
// locale (component texts like pagination/table) in sync with it
function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>(() => detectLang());

  const setLang = useCallback((l: AdminLang) => {
    setLangState(l);
    saveLang(l);
    document.documentElement.lang = l;
    dayjs.locale(l === "zh" ? "zh-cn" : "en");
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translateAdmin(lang, key, params),
    [lang]
  );

  return (
    <AdminI18nContext.Provider value={{ lang, setLang, t }}>
      <ConfigProvider
        locale={lang === "zh" ? antdZh : antdEn}
        theme={{ token: { colorPrimary: "#4f6ef7" } }}
      >
        {children}
      </ConfigProvider>
    </AdminI18nContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminI18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AdminI18nProvider>
  </StrictMode>
);
