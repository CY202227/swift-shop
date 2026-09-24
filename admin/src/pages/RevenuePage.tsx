import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Col, Row, Statistic, Table, Typography, Empty } from "antd";
import { get } from "../api";
import type { Revenue } from "../types";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

// Lightweight inline SVG line chart (no chart lib dependency):
// draws a revenue polyline + area fill over a 30-day window.
function RevenueCurve({ series }: { series: { date: string; revenue_cents: number }[] }) {
  const W = 860;
  const H = 220;
  const PAD = { l: 56, r: 16, t: 16, b: 28 };

  const chart = useMemo(() => {
    if (series.length === 0) return null;
    const maxY = Math.max(...series.map((p) => p.revenue_cents), 1);
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = (v: number) => PAD.t + innerH - (v / maxY) * innerH;
    const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.revenue_cents).toFixed(1)}`);
    return {
      maxY,
      line: `M${pts.join(" L")}`,
      area: `M${PAD.l},${(PAD.t + innerH).toFixed(1)} L${pts.join(" L")} L${PAD.l + innerW},${(PAD.t + innerH).toFixed(1)} Z`,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: maxY * f, y: y(maxY * f) })),
    };
  }, [series]);

  if (!chart) return <Empty description="近 30 天暂无已支付订单" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* grid + y-axis labels */}
      {chart.ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#eee" strokeWidth="1" />
          <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#888">
            {t.v >= 10000 ? `¥${(t.v / 10000).toFixed(1)}k` : `¥${(t.v / 100).toFixed(0)}`}
          </text>
        </g>
      ))}
      {/* area + line */}
      <path d={chart.area} fill="#e6f4ff" />
      <path d={chart.line} fill="none" stroke="#1677ff" strokeWidth="2" strokeLinejoin="round" />
      {/* points + x labels (show first / last only to avoid crowding) */}
      {series.map((p, i) => (
        <g key={p.date}>
          <circle cx={PAD.l + (series.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (series.length - 1)) * (W - PAD.l - PAD.r))} cy={PAD.t + (H - PAD.t - PAD.b) - (p.revenue_cents / chart.maxY) * (H - PAD.t - PAD.b)} r="3" fill="#1677ff" />
          {(i === 0 || i === series.length - 1 || i === Math.floor(series.length / 2)) && (
            <text
              x={PAD.l + (series.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (series.length - 1)) * (W - PAD.l - PAD.r))}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#888"
            >
              {p.date.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function RevenuePage() {
  const [data, setData] = useState<Revenue | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    get<Revenue>("/api/v1/admin/stats/revenue")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Alert type="error" message={err} showIcon />;
  if (!data) return <Card loading style={{ minHeight: 240 }} />;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="已实现收入（已支付订单）"
              value={yuan(data.realized_cents)}
              precision={2}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Realized revenue
            </Typography.Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="预计收入（待支付订单）"
              value={yuan(data.expected_cents)}
              precision={2}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Expected: pending orders if paid
            </Typography.Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="合计预估"
              value={yuan(data.realized_cents + data.expected_cents)}
              precision={2}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Realized + expected
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card title="收入曲线（近 30 天 · 已支付）" style={{ marginBottom: 16 }}>
        <RevenueCurve series={data.series} />
      </Card>

      <Card title="每日明细" size="small">
        <Table
          rowKey="date"
          size="small"
          dataSource={[...data.series].reverse()}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "日期", dataIndex: "date", width: 140 },
            { title: "收入", dataIndex: "revenue_cents", render: (c: number) => yuan(c) },
          ]}
        />
      </Card>
    </div>
  );
}
