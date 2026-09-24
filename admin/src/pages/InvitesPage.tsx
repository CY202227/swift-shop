import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { get, patch, post } from "../api";
import type { Invite, InvitePage, Settings } from "../types";
import dayjs from "dayjs";

interface GenValues {
  count: number;
  max_uses: number;
  expires_days?: number;
  remark?: string;
}

export default function InvitesPage() {
  const [list, setList] = useState<InvitePage | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [genOpen, setGenOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [form] = Form.useForm<GenValues>();
  const [msgApi, msgHolder] = message.useMessage();

  const reload = useCallback(() => {
    get<InvitePage>(`/api/v1/admin/invite-codes?page=${page}&size=10`)
      .then(setList)
      .catch((e) => setErr(e.message));
    get<Settings>("/api/v1/admin/settings")
      .then(setSettings)
      .catch((e) => setErr(e.message));
  }, [page]);

  useEffect(reload, [reload]);

  const toggleInviteRequired = async (checked: boolean) => {
    setSwitchLoading(true);
    try {
      const out = await patch<Settings>("/api/v1/admin/settings", { invite_required: checked });
      setSettings(out);
      msgApi.success(checked ? "已开启邀请注册：新用户注册需邀请码" : "已关闭邀请注册");
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "切换失败");
    } finally {
      setSwitchLoading(false);
    }
  };

  const generate = async (values: GenValues) => {
    try {
      const body: Record<string, unknown> = { count: values.count, max_uses: values.max_uses };
      if (values.expires_days) body.expires_days = values.expires_days;
      if (values.remark?.trim()) body.remark = values.remark.trim();
      const created = await post<Invite[]>("/api/v1/admin/invite-codes", body);
      msgApi.success(`已生成 ${created.length} 个邀请码`);
      setGenOpen(false);
      form.resetFields();
      setPage(1);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "生成失败");
    }
  };

  const revoke = async (row: Invite) => {
    try {
      await patch(`/api/v1/admin/invite-codes/${row.id}`, { status: "revoked" });
      msgApi.success(`已作废 ${row.code}`);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "作废失败");
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Card size="small" title="注册设置" style={{ marginBottom: 16 }}>
        <Space>
          <Switch
            checked={settings?.invite_required ?? false}
            loading={switchLoading || !settings}
            onChange={toggleInviteRequired}
          />
          <Typography.Text>
            邀请注册模式：开启后，新用户注册必须填写有效邀请码（已有账号不受影响）
          </Typography.Text>
        </Space>
      </Card>

      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenOpen(true)}>
          批量生成邀请码
        </Button>
      </Space>

      <Table<Invite>
        rowKey="id"
        size="small"
        dataSource={list?.items ?? []}
        loading={!list}
        pagination={{ current: page, pageSize: 10, total: list?.total ?? 0, onChange: setPage }}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          { title: "邀请码", dataIndex: "code", render: (c: string) => <Typography.Text code copyable>{c}</Typography.Text> },
          { title: "已用/上限", key: "uses", width: 110, render: (_, r) => `${r.used_count} / ${r.max_uses}` },
          {
            title: "有效期至",
            dataIndex: "expires_at",
            width: 170,
            render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "永久"),
          },
          {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (s: string, r: Invite) => {
              const exhausted = r.used_count >= r.max_uses;
              const expired = !!r.expires_at && dayjs(r.expires_at).isBefore(dayjs());
              const tag = s === "active" ? (!expired && !exhausted ? "green" : "default") : "red";
              const label = s !== "active" ? "已作废" : expired ? "已过期" : exhausted ? "已用尽" : "生效中";
              return <Tag color={tag}>{label}</Tag>;
            },
          },
          { title: "备注", dataIndex: "remark", ellipsis: true, render: (v) => v ?? "—" },
          {
            title: "创建时间",
            dataIndex: "created_at",
            width: 170,
            render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
          },
          {
            title: "操作",
            key: "act",
            width: 90,
            render: (_, r) =>
              r.status === "active" ? (
                <Popconfirm title={`作废 ${r.code}？`} onConfirm={() => revoke(r)}>
                  <Button size="small" danger>作废</Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />

      <Modal
        title="批量生成邀请码"
        open={genOpen}
        onCancel={() => setGenOpen(false)}
        onOk={() => form.submit()}
        okText="生成"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={generate} initialValues={{ count: 1, max_uses: 1 }}>
          <Space size="large">
            <Form.Item name="count" label="生成数量" rules={[{ required: true, type: "number", min: 1, max: 100 }]}>
              <InputNumber min={1} max={100} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="max_uses" label="每个可用次数" rules={[{ required: true, type: "number", min: 1, max: 10000 }]}>
              <InputNumber min={1} max={10000} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="expires_days" label="有效天数（可选）">
              <InputNumber min={1} max={365} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label="备注（可选）">
            <Input maxLength={255} placeholder="例如：内测用户" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
