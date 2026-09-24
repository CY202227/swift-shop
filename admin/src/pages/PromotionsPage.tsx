import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { get, post } from "../api";
import type { Promotion } from "../types";
import dayjs from "dayjs";

interface PromoValues {
  name: string;
  kind: "percent_off" | "buy_n_get_1";
  value: number;
  ends_days?: number;
}

const KIND_TEXT: Record<string, string> = {
  percent_off: "全场折扣",
  buy_n_get_1: "买 N 送 1",
};

export default function PromotionsPage() {
  const [list, setList] = useState<Promotion[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<PromoValues>();
  const [msgApi, msgHolder] = message.useMessage();

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
      msgApi.success("活动已创建（旧活动自动结束）");
      setOpen(false);
      form.resetFields();
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "创建失败");
    }
  };

  const endPromo = async (row: Promotion) => {
    try {
      await post(`/api/v1/admin/promotions/${row.id}/end`);
      msgApi.success(`已结束「${row.name}」`);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          发起活动
        </Button>
        <Typography.Text type="secondary">
          同一时间只有一个活动生效；新活动自动结束旧活动
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
          { title: "活动名", dataIndex: "name" },
          {
            title: "类型",
            dataIndex: "kind",
            width: 120,
            render: (k: string) => <Tag color={k === "percent_off" ? "purple" : "cyan"}>{KIND_TEXT[k] ?? k}</Tag>,
          },
          {
            title: "力度",
            dataIndex: "value",
            width: 100,
            render: (v: number, r) => (r.kind === "percent_off" ? `${100 - v}% 折扣` : `买 ${v} 送 1`),
          },
          {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (s: string) => <Tag color={s === "active" ? "green" : "default"}>{s === "active" ? "进行中" : "已结束"}</Tag>,
          },
          {
            title: "时间",
            key: "time",
            width: 220,
            render: (_, r) => (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(r.starts_at).format("MM-DD HH:mm")} ~ {r.ends_at ? dayjs(r.ends_at).format("MM-DD HH:mm") : "无限期"}
              </Typography.Text>
            ),
          },
          {
            title: "操作",
            key: "act",
            width: 100,
            render: (_, r) =>
              r.status === "active" ? (
                <Popconfirm title={`结束「${r.name}」？之后恢复原价。`} onConfirm={() => endPromo(r)}>
                  <Button size="small" danger>结束</Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />

      <Modal
        title="发起全场活动"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={create} initialValues={{ kind: "percent_off", value: 10 }}>
          <Form.Item name="name" label="活动名" rules={[{ required: true, max: 128 }]}>
            <Input placeholder="如：开业全场9折" />
          </Form.Item>
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "percent_off", label: "全场折扣（如 value=10 表示全场 9 折）" },
                { value: "buy_n_get_1", label: "买 N 送 1（value 为 N）" },
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
                  label={kind === "percent_off" ? "折扣（减免百分比）" : "买 N 送 1 的 N"}
                  rules={[{ required: true, type: "number", min: 1, max: kind === "percent_off" ? 95 : 99 }]}
                >
                  {kind === "percent_off" ? (
                    <InputNumber min={1} max={95} style={{ width: 180 }} addonAfter="% OFF" />
                  ) : (
                    <InputNumber min={1} max={99} style={{ width: 180 }} addonAfter="买N送1" />
                  )}
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="ends_days" label="持续天数（留空 = 无限期）">
            <InputNumber min={1} max={365} style={{ width: 180 }} addonAfter="天" />
          </Form.Item>
        </Form>
        <Card size="small" style={{ background: "#fafafa", fontSize: 13 }}>
          折扣可叠加：活动折扣 × 商品折扣 × 会员折扣，下单时服务端统一计算。
        </Card>
      </Modal>
    </div>
  );
}
