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
import { useAdminI18n } from "../i18n";
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
  const { t } = useAdminI18n();

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
      msgApi.success(checked ? t("msg_invite_on") : t("msg_invite_off"));
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_toggle_failed"));
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
      msgApi.success(t("msg_invites_generated", { n: created.length }));
      setGenOpen(false);
      form.resetFields();
      setPage(1);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_invites_gen_fail"));
    }
  };

  const revoke = async (row: Invite) => {
    try {
      await patch(`/api/v1/admin/invite-codes/${row.id}`, { status: "revoked" });
      msgApi.success(t("msg_revoked", { code: row.code }));
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_revoke_failed"));
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Card size="small" title={t("invites_signup_settings")} style={{ marginBottom: 16 }}>
        <Space>
          <Switch
            checked={settings?.invite_required ?? false}
            loading={switchLoading || !settings}
            onChange={toggleInviteRequired}
          />
          <Typography.Text>
            {t("invites_mode_note")}
          </Typography.Text>
        </Space>
      </Card>

      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenOpen(true)}>
          {t("invites_generate_btn")}
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
          { title: t("col_code"), dataIndex: "code", render: (c: string) => <Typography.Text code copyable>{c}</Typography.Text> },
          { title: t("invites_uses"), key: "uses", width: 110, render: (_, r) => `${r.used_count} / ${r.max_uses}` },
          {
            title: t("invites_valid_until"),
            dataIndex: "expires_at",
            width: 170,
            render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : t("invites_forever")),
          },
          {
            title: t("col_status"),
            dataIndex: "status",
            width: 90,
            render: (s: string, r: Invite) => {
              const exhausted = r.used_count >= r.max_uses;
              const expired = !!r.expires_at && dayjs(r.expires_at).isBefore(dayjs());
              const tag = s === "active" ? (!expired && !exhausted ? "green" : "default") : "red";
              const label = s !== "active" ? t("invites_revoked") : expired ? t("invites_expired") : exhausted ? t("invites_exhausted") : t("invites_in_effect");
              return <Tag color={tag}>{label}</Tag>;
            },
          },
          { title: t("col_remark"), dataIndex: "remark", ellipsis: true, render: (v) => v ?? "—" },
          {
            title: t("col_created_at"),
            dataIndex: "created_at",
            width: 170,
            render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
          },
          {
            title: t("col_action"),
            key: "act",
            width: 90,
            render: (_, r) =>
              r.status === "active" ? (
                <Popconfirm title={t("confirm_revoke", { code: r.code })} onConfirm={() => revoke(r)}>
                  <Button size="small" danger>{t("invites_revoke_btn")}</Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />

      <Modal
        title={t("invites_generate_title")}
        open={genOpen}
        onCancel={() => setGenOpen(false)}
        onOk={() => form.submit()}
        okText={t("invites_generate_ok")}
        cancelText={t("cancel")}
      >
        <Form form={form} layout="vertical" onFinish={generate} initialValues={{ count: 1, max_uses: 1 }}>
          <Space size="large">
            <Form.Item name="count" label={t("invites_count_label")} rules={[{ required: true, type: "number", min: 1, max: 100 }]}>
              <InputNumber min={1} max={100} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="max_uses" label={t("invites_max_uses_label")} rules={[{ required: true, type: "number", min: 1, max: 10000 }]}>
              <InputNumber min={1} max={10000} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="expires_days" label={t("invites_days_label")}>
              <InputNumber min={1} max={365} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label={t("invites_remark_label")}>
            <Input maxLength={255} placeholder={t("invites_remark_ph")} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
