import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Alert } from "antd";
import {
  TeamOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  PayCircleOutlined,
  DollarOutlined,
  HourglassOutlined,
} from "@ant-design/icons";
import { get } from "../api";
import { useAdminI18n } from "../i18n";
import type { Dashboard } from "../types";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");
  const { t } = useAdminI18n();

  useEffect(() => {
    get<Dashboard>("/api/v1/admin/dashboard")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Alert type="error" message={err} showIcon />;
  if (!data) return <Card loading />;

  const cards: { title: string; value: number | string; icon: React.ReactNode; color?: string }[] = [
    { title: t("dash_users_total"), value: data.users_total, icon: <TeamOutlined />, color: "#4f6ef7" },
    { title: t("dash_products_total"), value: data.products_total, icon: <AppstoreOutlined /> },
    { title: t("dash_products_active"), value: data.products_active, icon: <ShoppingOutlined />, color: "#2e9e5b" },
    { title: t("dash_orders_total"), value: data.orders_total, icon: <PayCircleOutlined /> },
    { title: t("dash_orders_paid"), value: data.orders_paid, icon: <PayCircleOutlined />, color: "#2e9e5b" },
    { title: t("dash_orders_pending"), value: data.pending_payment, icon: <HourglassOutlined />, color: "#b4760a" },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <Col key={c.title} xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic
                title={c.title}
                value={c.value}
                prefix={<span style={{ color: c.color ?? "#555", marginRight: 6 }}>{c.icon}</span>}
              />
            </Card>
          </Col>
        ))}
        <Col xs={24} md={12} lg={8}>
          <Card size="small">
            <Statistic
              title={t("dash_revenue_total")}
              value={yuan(data.revenue_cents)}
              prefix={<span style={{ color: "#d9534f", marginRight: 6 }}><DollarOutlined /></span>}
              valueStyle={{ color: "#d9534f" }}
            />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary">
        {t("dash_hint")}
      </Typography.Paragraph>
    </div>
  );
}
