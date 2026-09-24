import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Space, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import type { AdminUser } from "../types";

const { Header, Sider, Content } = Layout;

const MENU = [
  { key: "dashboard", label: "仪表盘" },
  { key: "products", label: "商品管理" },
  { key: "invites", label: "邀请码 / 注册设置" },
  { key: "users", label: "用户管理" },
  { key: "orders", label: "订单 / 导出" },
];

export default function AdminLayout({ user, onLogout }: { user: object; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const u = user as AdminUser;
  const selected = location.pathname.split("/")[1] || "dashboard";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220}>
        <div style={{ color: "#fff", padding: "18px 16px", fontSize: 17, fontWeight: 700 }}>
          🛒 Swift Shop 后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={MENU}
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
              {u.username}（{u.role === "admin" ? "管理员" : u.role}）
            </Typography.Text>
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
