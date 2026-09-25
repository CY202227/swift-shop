import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadCsv, get } from "../api";
import type { Order, OrderPage } from "../types";
import dayjs from "dayjs";
import { useAdminI18n } from "../i18n";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export default function OrdersPage() {
  const [data, setData] = useState<OrderPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [userFilter, setUserFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [msgApi, msgHolder] = message.useMessage();
  const { t } = useAdminI18n();

  const STATUS: Record<string, { color: string; key: string }> = {
    pending_payment: { color: "gold", key: "status_pending_payment" },
    paid: { color: "green", key: "status_paid" },
    cancelled: { color: "default", key: "status_cancelled" },
    completed: { color: "blue", key: "status_completed" },
  };

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
      msgApi.success(t("orders_export_done"));
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("orders_export_fail"));
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
          placeholder={t("orders_filter_status")}
          allowClear
          style={{ width: 140 }}
          onChange={(v) => { setPage(1); setStatusFilter(v); }}
          options={Object.entries(STATUS).map(([value, s]) => ({ value, label: t(s.key) }))}
        />
        <Input.Search
          placeholder={t("orders_filter_user")}
          allowClear
          onSearch={(v) => { setPage(1); setUserFilter(v); }}
          style={{ width: 180 }}
        />
        <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
          {t("orders_export")}
        </Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {t("orders_export_note")}
      </Typography.Paragraph>
      <Table<Order>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={!data}
        pagination={{ current: page, pageSize: 10, total: data?.total ?? 0, onChange: setPage, showTotal: (n) => t("total_n", { n }) }}
        expandable={{
          expandedRowRender: (r) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* shipping snapshot — what fulfilment actually needs */}
              <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                <Typography.Text strong>{t("col_recipient")}:</Typography.Text> {r.recipient_name || "—"}
                <span style={{ margin: "0 14px" }} />
                <Typography.Text strong>{t("col_phone")}:</Typography.Text> {r.recipient_phone || "—"}
                <div style={{ marginTop: 4 }}>
                  <Typography.Text strong>{t("col_address")}:</Typography.Text> {r.address || "—"}
                </div>
              </div>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#888" }}>
                    <th>{t("detail_product")}</th><th>{t("detail_unit_price")}</th><th>{t("detail_qty")}</th><th>{t("detail_line_total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((i) => (
                    <tr key={i.product_id}>
                      <td>{i.title}</td>
                      <td>{yuan(i.unit_price_cents)}</td>
                      <td>×{i.qty}</td>
                      {/* snapshot line total honours buy-N-get-1; fallback for older rows */}
                      <td>{yuan(i.line_total_cents || i.unit_price_cents * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        }}
        columns={[
          { title: t("col_order_no"), dataIndex: "order_no", render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
          { title: t("col_user"), key: "user", render: (_, r) => r.user_email ?? `#${r.user_id ?? "?"}` },
          {
            title: t("col_recipient"),
            dataIndex: "recipient_name",
            width: 120,
            render: (v: string) => v ? <Typography.Text>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
          },
          { title: t("col_phone"), dataIndex: "recipient_phone", width: 130,
            render: (v: string) => v || "—" },
          {
            title: t("col_address"),
            dataIndex: "address",
            width: 200,
            ellipsis: true,
            render: (v: string) => v || "—",
          },
          { title: t("col_amount"), dataIndex: "total_cents", width: 100, render: (c: number) => yuan(c) },
          {
            title: t("col_status"),
            dataIndex: "status",
            width: 100,
            render: (s: string) => <Tag color={STATUS[s]?.color}>{t(STATUS[s]?.key ?? "") ?? s}</Tag>,
          },
          {
            title: t("col_paid_at"),
            dataIndex: "paid_at",
            width: 140,
            render: (v: string | null) => (v ? dayjs(v).format("MM-DD HH:mm") : "—"),
          },
        ]}
      />
    </div>
  );
}
