import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Space, Typography, Tag } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import type { AdminUser } from "../types";

const { Header, Sider, Content } = Layout;

// role-gated menu: dashboard/orders/users open to both roles; the rest super-only
const ALL_MENU = [
  { key: "dashboard", label: "仪表盘", roles: ["admin", "super_admin"] },
  { key: "orders", label: "订单 / 导出", roles: ["admin", "super_admin"] },
  { key: "users", label: "用户管理", roles: ["admin", "super_admin"] },
  { key: "products", label: "商品管理", roles: ["admin", "super_admin"] },
  { key: "promotions", label: "活动管理", roles: ["super_admin"] },
  { key: "invites", label: "邀请码 / 注册设置", roles: ["super_admin"] },
  { key: "revenue", label: "收入统计", roles: ["super_admin"] },
];

export default function AdminLayout({ user, onLogout }: { user: object; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const u = user as AdminUser;
  const isSuper = u.role === "super_admin";
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
          🃏 PTCG Shop 后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menu.map(({ key, label }) => ({ key, label }))}
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
            <Typography.Text>
              {u.username}
            </Typography.Text>
            <Tag color={isSuper ? "gold" : "blue"}>
              {isSuper ? "超级管理员" : "管理员"}
            </Tag>
            <Button icon={<LogoutOutlined />} onClick={onLogout}>
              退出登录
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
