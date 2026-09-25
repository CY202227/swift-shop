import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { get, post } from "../api";
import { useAdminI18n } from "../i18n";
import type { Promotion } from "../types";
import dayjs from "dayjs";

interface PromoValues {
  name: string;
  kind: "percent_off" | "buy_n_get_1";
  value: number;
  ends_days?: number;
}

export default function PromotionsPage() {
  const [list, setList] = useState<Promotion[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<PromoValues>();
  const [msgApi, msgHolder] = message.useMessage();
  const { t } = useAdminI18n();

  const kindText = (k: string) =>
    k === "percent_off" ? t("promo_kind_percent") : k === "buy_n_get_1" ? t("promo_kind_bng1") : k;

  const reload = useCallback(() => {
    get<Promotion[]>("/api/v1/admin/promotions")
      .then(setList)
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(reload, [reload]);

  const create = async (values: PromoValues) => {
    try {
      const body: Record<string, unknown> = { name: values.name, kind: values.kind, value: values.value };
      if (values.ends_days) body.ends_days = values.ends_days;
      await post("/api/v1/admin/promotions", body);
      msgApi.success(t("msg_promo_created"));
      setOpen(false);
      form.resetFields();
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_promo_create_fail"));
    }
  };

  const endPromo = async (row: Promotion) => {
    try {
      await post(`/api/v1/admin/promotions/${row.id}/end`);
      msgApi.success(t("msg_promo_ended", { name: row.name }));
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_operate_failed"));
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          {t("promo_new")}
        </Button>
        <Typography.Text type="secondary">
          {t("promo_single_note")}
        </Typography.Text>
      </Space>
      <Table<Promotion>
        rowKey="id"
        size="small"
        dataSource={list ?? []}
        loading={!list}
        pagination={false}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          { title: t("col_name"), dataIndex: "name" },
          {
            title: t("col_kind"),
            dataIndex: "kind",
            width: 120,
            render: (k: string) => <Tag color={k === "percent_off" ? "purple" : "cyan"}>{kindText(k)}</Tag>,
          },
          {
            title: t("promo_strength"),
            dataIndex: "value",
            width: 100,
            render: (v: number, r) => (r.kind === "percent_off" ? t("promo_percent_tag", { p: 100 - v }) : t("promo_bng1", { n: v })),
          },
          {
            title: t("col_status"),
            dataIndex: "status",
            width: 90,
            render: (s: string) => <Tag color={s === "active" ? "green" : "default"}>{s === "active" ? t("promo_active") : t("promo_ended_tag")}</Tag>,
          },
          {
            title: t("col_time"),
            key: "time",
            width: 220,
            render: (_, r) => (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(r.starts_at).format("MM-DD HH:mm")} ~ {r.ends_at ? dayjs(r.ends_at).format("MM-DD HH:mm") : t("promo_no_end")}
              </Typography.Text>
            ),
          },
          {
            title: t("col_action"),
            key: "act",
            width: 100,
            render: (_, r) =>
              r.status === "active" ? (
                <Popconfirm title={t("confirm_end_promo", { name: r.name })} onConfirm={() => endPromo(r)}>
                  <Button size="small" danger>{t("promo_end")}</Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />

      <Modal
        title={t("promo_modal_title")}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={t("confirm")}
        cancelText={t("cancel")}
      >
        <Form form={form} layout="vertical" onFinish={create} initialValues={{ kind: "percent_off", value: 10 }}>
          <Form.Item name="name" label={t("col_name")} rules={[{ required: true, max: 128 }]}>
            <Input placeholder={t("promo_name_ph")} />
          </Form.Item>
          <Form.Item name="kind" label={t("col_kind")} rules={[{ required: true }]}>
            <Select
              options={[
                { value: "percent_off", label: t("promo_kind_percent_label") },
                { value: "buy_n_get_1", label: t("promo_kind_bng1_label") },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(a, b) => a.kind !== b.kind}
          >
            {({ getFieldValue }) => {
              const kind = getFieldValue("kind") as string;
              return (
                <Form.Item
                  name="value"
                  label={kind === "percent_off" ? t("promo_percent_label") : t("promo_bng1_n_label")}
                  rules={[{ required: true, type: "number", min: 1, max: kind === "percent_off" ? 95 : 99 }]}
                >
                  {kind === "percent_off" ? (
                    <InputNumber min={1} max={95} style={{ width: 180 }} addonAfter="% OFF" />
                  ) : (
                    <InputNumber min={1} max={99} style={{ width: 180 }} addonAfter="Buy N" />
                  )}
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="ends_days" label={t("promo_days_label")}>
            <InputNumber min={1} max={365} style={{ width: 180 }} addonAfter={t("promo_days_unit")} />
          </Form.Item>
        </Form>
        <Card size="small" style={{ background: "#fafafa", fontSize: 13 }}>
          {t("promo_stack_note")}
        </Card>
      </Modal>
    </div>
  );
}
