import { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { get, patch } from "../api";
import { AuthCtx } from "../auth";
import { useAdminI18n } from "../i18n";
import { isSuperAdmin, type UserPage, type UserRow } from "../types";
import dayjs from "dayjs";

export default function UsersPage() {
  const [data, setData] = useState<UserPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [msgApi, msgHolder] = message.useMessage();
  const { user: me } = useContext(AuthCtx);
  const { t } = useAdminI18n();
  const isSuper = isSuperAdmin(me);

  const reload = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), size: "10" });
    if (search.trim()) q.set("search", search.trim());
    get<UserPage>(`/api/v1/admin/users?${q}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [page, search]);

  useEffect(reload, [reload]);

  const patchUser = async (row: UserRow, body: Record<string, unknown>, okMsg: string) => {
    try {
      await patch(`/api/v1/admin/users/${row.id}`, body);
      msgApi.success(okMsg);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_operate_failed"));
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Input.Search
        placeholder={t("users_search_ph")}
        allowClear
        onSearch={(v) => { setPage(1); setSearch(v); }}
        style={{ width: 260, marginBottom: 12 }}
      />
      <Table<UserRow>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={!data}
        pagination={{ current: page, pageSize: 10, total: data?.total ?? 0, onChange: setPage, showTotal: (n) => t("users_total", { n }) }}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          { title: t("col_username"), dataIndex: "username" },
          { title: t("col_email"), dataIndex: "email" },
          {
            // super admin can assign roles; regular admin sees read-only tag
            title: t("users_role"),
            dataIndex: "role",
            width: 140,
            render: (role: string, r) =>
              isSuper ? (
                <Select
                  size="small"
                  value={role}
                  style={{ width: 120 }}
                  disabled={r.id === me?.id}
                  onChange={(v) => patchUser(r, { role: v }, v === "super_admin" ? t("msg_role_super") : v === "admin" ? t("msg_role_admin") : t("msg_role_user"))}
                  options={[
                    { value: "user", label: t("role_user") },
                    { value: "admin", label: t("role_admin") },
                    { value: "super_admin", label: t("role_super") },
                  ]}
                />
              ) : (
                <Tag color={role === "super_admin" ? "gold" : role === "admin" ? "blue" : undefined}>
                  {role === "super_admin" ? t("role_super") : role === "admin" ? t("role_admin") : t("role_user")}
                </Tag>
              ),
          },
          {
            // member discount: every admin role can grant this (0-99%)
            title: t("users_set_discount"),
            dataIndex: "discount_percent",
            width: 110,
            render: (d: number | undefined, r) => (
              <Space size={4}>
                <InputNumber
                  size="small"
                  min={0}
                  max={99}
                  value={d ?? 0}
                  style={{ width: 64 }}
                  onChange={(v) => {
                    if (v !== (d ?? 0) && v !== null && v !== undefined) {
                      patchUser(r, { discount_percent: v }, t("msg_discount_set", { name: r.username, v }));
                    }
                  }}
                />
                %
              </Space>
            ),
          },
          {
            title: t("users_status"),
            dataIndex: "status",
            width: 90,
            render: (s: string) => (
              <Tag color={s === "active" ? "green" : "red"}>{s === "active" ? t("status_user_active") : t("status_user_disabled")}</Tag>
            ),
          },
          {
            title: t("users_joined"),
            dataIndex: "created_at",
            width: 170,
            render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
          },
          {
            // banning is a super_admin action (封号)
            title: t("col_action"),
            key: "act",
            width: 100,
            render: (_, r) =>
              isSuper ? (
                r.status === "active" ? (
                  <Popconfirm title={t("confirm_disable_user", { name: r.username })} onConfirm={() => patchUser(r, { status: "disabled" }, t("msg_disabled"))}>
                    <Button size="small" danger>{t("users_disable")}</Button>
                  </Popconfirm>
                ) : (
                  <Button size="small" onClick={() => patchUser(r, { status: "active" }, t("msg_enabled"))}>
                    {t("users_enable")}
                  </Button>
                )
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t("users_super_only")}</Typography.Text>
              ),
          },
        ]}
      />
    </div>
  );
}
