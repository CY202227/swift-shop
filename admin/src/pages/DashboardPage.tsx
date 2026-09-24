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
import type { Dashboard } from "../types";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    get<Dashboard>("/api/v1/admin/dashboard")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Alert type="error" message={err} showIcon />;
  if (!data) return <Card loading />;

  const cards: { title: string; value: number | string; icon: React.ReactNode; color?: string }[] = [
    { title: "用户总数", value: data.users_total, icon: <TeamOutlined />, color: "#4f6ef7" },
    { title: "商品总数", value: data.products_total, icon: <AppstoreOutlined /> },
    { title: "在售商品", value: data.products_active, icon: <ShoppingOutlined />, color: "#2e9e5b" },
    { title: "订单总数", value: data.orders_total, icon: <PayCircleOutlined /> },
    { title: "已支付订单", value: data.orders_paid, icon: <PayCircleOutlined />, color: "#2e9e5b" },
    { title: "待支付订单", value: data.pending_payment, icon: <HourglassOutlined />, color: "#b4760a" },
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
              title="累计收入（已支付）"
              value={yuan(data.revenue_cents)}
              prefix={<span style={{ color: "#d9534f", marginRight: 6 }}><DollarOutlined /></span>}
              valueStyle={{ color: "#d9534f" }}
            />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary">
        提示：数据为全站实时统计；收入仅统计状态为「已支付」的订单。
      </Typography.Paragraph>
    </div>
  );
}
