import { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { get, patch } from "../api";
import { AuthCtx } from "../auth";
import { isSuperAdmin, type UserPage, type UserRow } from "../types";
import dayjs from "dayjs";

export default function UsersPage() {
  const [data, setData] = useState<UserPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [msgApi, msgHolder] = message.useMessage();
  const { user: me } = useContext(AuthCtx);
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
      msgApi.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Input.Search
        placeholder="搜索邮箱或用户名"
        allowClear
        onSearch={(v) => { setPage(1); setSearch(v); }}
        style={{ width: 260, marginBottom: 12 }}
      />
      <Table<UserRow>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={!data}
        pagination={{ current: page, pageSize: 10, total: data?.total ?? 0, onChange: setPage, showTotal: (t) => `共 ${t} 人` }}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          { title: "用户名", dataIndex: "username" },
          { title: "邮箱", dataIndex: "email" },
          {
            // super admin can assign roles; regular admin sees read-only tag
            title: "角色",
            dataIndex: "role",
            width: 140,
            render: (role: string, r) =>
              isSuper ? (
                <Select
                  size="small"
                  value={role}
                  style={{ width: 120 }}
                  disabled={r.id === me?.id}
                  onChange={(v) => patchUser(r, { role: v }, v === "super_admin" ? "已设为超级管理员" : v === "admin" ? "已提权为管理员" : "已降级为普通用户")}
                  options={[
                    { value: "user", label: "用户" },
                    { value: "admin", label: "管理员" },
                    { value: "super_admin", label: "超级管理员" },
                  ]}
                />
              ) : (
                <Tag color={role === "super_admin" ? "gold" : role === "admin" ? "blue" : undefined}>
                  {role === "super_admin" ? "超级管理员" : role === "admin" ? "管理员" : "用户"}
                </Tag>
              ),
          },
          {
            // member discount: every admin role can grant this (0-99%)
            title: "折扣",
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
                      patchUser(r, { discount_percent: v }, `已设置 ${r.username} 折扣 ${v}%`);
                    }
                  }}
                />
                %
              </Space>
            ),
          },
          {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (s: string) => (
              <Tag color={s === "active" ? "green" : "red"}>{s === "active" ? "正常" : "已禁用"}</Tag>
            ),
          },
          {
            title: "注册时间",
            dataIndex: "created_at",
            width: 170,
            render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
          },
          {
            // banning is a super_admin action (封号)
            title: "操作",
            key: "act",
            width: 100,
            render: (_, r) =>
              isSuper ? (
                r.status === "active" ? (
                  <Popconfirm title={`禁用 ${r.username}？该用户将无法登录。`} onConfirm={() => patchUser(r, { status: "disabled" }, "已禁用")}>
                    <Button size="small" danger>禁用</Button>
                  </Popconfirm>
                ) : (
                  <Button size="small" onClick={() => patchUser(r, { status: "active" }, "已启用")}>
                    启用
                  </Button>
                )
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>仅超管可操作</Typography.Text>
              ),
          },
        ]}
      />
    </div>
  );
}
