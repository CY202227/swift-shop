import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadCsv, get } from "../api";
import type { Order, OrderPage } from "../types";
import dayjs from "dayjs";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

const STATUS: Record<string, { color: string; text: string }> = {
  pending_payment: { color: "gold", text: "待支付" },
  paid: { color: "green", text: "已支付" },
  cancelled: { color: "default", text: "已取消" },
  completed: { color: "blue", text: "已完成" },
};

export default function OrdersPage() {
  const [data, setData] = useState<OrderPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [userFilter, setUserFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [msgApi, msgHolder] = message.useMessage();

  const qs = useCallback((p: number) => {
    const q = new URLSearchParams({ page: String(p), size: "10" });
    if (statusFilter) q.set("status_filter", statusFilter);
    if (userFilter.trim()) q.set("user_id", userFilter.trim());
    return q.toString();
  }, [statusFilter, userFilter]);

  const reload = useCallback(() => {
    get<OrderPage>(`/api/v1/admin/orders?${qs(page)}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [page, qs]);

  useEffect(reload, [reload]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status_filter", statusFilter);
      if (userFilter.trim()) q.set("user_id", userFilter.trim());
      const stamp = dayjs().format("YYYYMMDD");
      await downloadCsv(`/api/v1/admin/orders/export?${q}`, `orders_${stamp}.csv`);
      msgApi.success("CSV 已导出（此次导出已记录审计日志）");
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 130 }}
          onChange={(v) => { setPage(1); setStatusFilter(v); }}
          options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.text }))}
        />
        <Input.Search
          placeholder="按用户 ID 筛选"
          allowClear
          onSearch={(v) => { setPage(1); setUserFilter(v); }}
          style={{ width: 180 }}
        />
        <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
          导出 CSV（购买记录）
        </Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        导出内容包括订单号、用户邮箱、状态、商品明细、金额与支付时间；每次导出都会写入审计日志。
      </Typography.Paragraph>
      <Table<Order>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={!data}
        pagination={{ current: page, pageSize: 10, total: data?.total ?? 0, onChange: setPage, showTotal: (t) => `共 ${t} 单` }}
        expandable={{
          expandedRowRender: (r) => (
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888" }}>
                  <th>商品</th><th>单价</th><th>数量</th><th>小计</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((i) => (
                  <tr key={i.product_id}>
                    <td>{i.title}</td>
                    <td>{yuan(i.unit_price_cents)}</td>
                    <td>×{i.qty}</td>
                    <td>{yuan(i.unit_price_cents * i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
        columns={[
          { title: "订单号", dataIndex: "order_no", render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
          { title: "用户", key: "user", render: (_, r) => r.user_email ?? `#${r.user_id ?? "?"}` },
          { title: "金额", dataIndex: "total_cents", width: 100, render: (c: number) => yuan(c) },
          {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (s: string) => <Tag color={STATUS[s]?.color}>{STATUS[s]?.text ?? s}</Tag>,
          },
          {
            title: "支付时间",
            dataIndex: "paid_at",
            width: 160,
            render: (v: string | null) => (v ? dayjs(v).format("MM-DD HH:mm") : "—"),
          },
          {
            title: "创建时间",
            dataIndex: "created_at",
            width: 160,
            render: (v: string) => dayjs(v).format("MM-DD HH:mm"),
          },
        ]}
      />
    </div>
  );
}
