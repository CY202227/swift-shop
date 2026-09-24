import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { get, patch } from "../api";
import type { UserPage, UserRow } from "../types";
import dayjs from "dayjs";

export default function UsersPage() {
  const [data, setData] = useState<UserPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [msgApi, msgHolder] = message.useMessage();

  const reload = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), size: "10" });
    if (search.trim()) q.set("search", search.trim());
    get<UserPage>(`/api/v1/admin/users?${q}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [page, search]);

  useEffect(reload, [reload]);

  const patchUser = async (row: UserRow, body: Record<string, string>, okMsg: string) => {
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
            title: "角色",
            dataIndex: "role",
            width: 130,
            render: (role: string, r) => (
              <Select
                size="small"
                value={role}
                style={{ width: 110 }}
                onChange={(v) => patchUser(r, { role: v }, v === "admin" ? "已提权为管理员" : "已降级为普通用户")}
                options={[
                  { value: "user", label: "用户" },
                  { value: "admin", label: "管理员" },
                ]}
              />
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
            title: "操作",
            key: "act",
            width: 100,
            render: (_, r) =>
              r.status === "active" ? (
                <Popconfirm title={`禁用 ${r.username}？该用户将无法登录。`} onConfirm={() => patchUser(r, { status: "disabled" }, "已禁用")}>
                  <Button size="small" danger>禁用</Button>
                </Popconfirm>
              ) : (
                <Button size="small" onClick={() => patchUser(r, { status: "active" }, "已启用")}>
                  启用
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}
