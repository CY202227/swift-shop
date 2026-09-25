import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Space, Typography, Tag } from "antd";
import { LogoutOutlined, ShoppingOutlined } from "@ant-design/icons";
import type { AdminUser } from "../types";
import { useAdminI18n } from "../i18n";

const { Header, Sider, Content } = Layout;

// storefront URL: separate SPA in dev (5173); override for deployments
const STORE_URL =
  (import.meta as any).env?.VITE_STORE_URL ?? "http://127.0.0.1:5173";

// role-gated menu: dashboard/orders/users/products open to both roles; rest super-only
const ALL_MENU = [
  { key: "dashboard", labelKey: "menu_dashboard", roles: ["admin", "super_admin"] },
  { key: "orders", labelKey: "menu_orders", roles: ["admin", "super_admin"] },
  { key: "users", labelKey: "menu_users", roles: ["admin", "super_admin"] },
  { key: "products", labelKey: "menu_products", roles: ["admin", "super_admin"] },
  { key: "promotions", labelKey: "menu_promotions", roles: ["super_admin"] },
  { key: "invites", labelKey: "menu_invites", roles: ["super_admin"] },
  { key: "revenue", labelKey: "menu_revenue", roles: ["super_admin"] },
];

export default function AdminLayout({ user, onLogout }: { user: object; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const u = user as AdminUser;
  const isSuper = u.role === "super_admin";
  const { lang, setLang, t } = useAdminI18n();
  const menu = ALL_MENU.filter((m) => m.roles.includes(u.role));
  const selected = location.pathname.split("/")[1] || "dashboard";

  // A regular admin landing on a super-only page gets kicked to the dashboard
  if (!isSuper && ["promotions", "invites", "revenue"].includes(selected)) {
    navigate("/dashboard", { replace: true });
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220}>
        <div style={{ color: "#fff", padding: "18px 16px", fontSize: 17, fontWeight: 700 }}>
          {t("brand")}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menu.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
          onClick={({ key }) => navigate(`/${key}`)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingInline: 24,
          }}
        >
          <Space>
            <Button
              icon={<ShoppingOutlined />}
              href={STORE_URL}
              target="_blank"
              title="Storefront"
            >
              {t("visit_store")}
            </Button>
            <Button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              title={lang === "zh" ? "Switch to English" : "切换到中文"}
            >
              {t("lang_toggle")}
            </Button>
            <Typography.Text>
              {u.username}
            </Typography.Text>
            <Tag color={isSuper ? "gold" : "blue"}>
              {isSuper ? t("role_super") : t("role_admin")}
            </Tag>
            <Button icon={<LogoutOutlined />} onClick={onLogout}>
              {t("logout")}
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
