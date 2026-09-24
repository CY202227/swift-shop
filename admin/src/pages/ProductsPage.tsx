import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { del, get, patch, post } from "../api";
import type { Product, ProductPage } from "../types";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  draft: { color: "default", text: "草稿" },
  active: { color: "green", text: "在售" },
  retired: { color: "orange", text: "已下架" },
};

interface FormValues {
  name: string;
  slug: string;
  description?: string;
  price_yuan: number;
  stock: number;
}

// Create/Edit modal shared by create & edit flows; images handled via uploads API
function ProductModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [existingImgs, setExistingImgs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msgApi, msgHolder] = message.useMessage();

  useEffect(() => {
    if (open) {
      form.resetFields();
      setErr("");
      setFileList([]);
      if (initial) {
        form.setFieldsValue({
          name: initial.name,
          slug: initial.slug,
          description: initial.description ?? "",
          price_yuan: initial.price_cents / 100,
          stock: initial.stock,
        });
        setExistingImgs(initial.images);
      } else {
        setExistingImgs([]);
      }
    }
  }, [open, initial, form]);

  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const out = await post<{ url: string }>("/api/v1/admin/uploads/image", fd);
    return out.url;
  };

  const submit = async (values: FormValues) => {
    setSaving(true);
    setErr("");
    try {
      const body = {
        name: values.name,
        slug: values.slug,
        description: values.description || null,
        price_cents: Math.round(values.price_yuan * 100),
        stock: values.stock,
      };
      if (initial) {
        await patch(`/api/v1/admin/products/${initial.id}`, body);
      } else {
        await post("/api/v1/admin/products", body);
      }
      msgApi.success(initial ? "已保存" : "已创建（草稿状态，请上架）");
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? `编辑商品 #${initial.id}` : "新建商品"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={560}
    >
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="name" label="商品名" rules={[{ required: true, min: 1, max: 128 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="slug"
          label="URL Slug"
          rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "仅小写字母、数字、连字符" }]}
        >
          <Input disabled={!!initial} placeholder="mech-keyboard-87" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space size="large">
          <Form.Item
            name="price_yuan"
            label="价格（元）"
            rules={[{ required: true, type: "number", min: 0.01 }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true, type: "number", min: 0 }]}>
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
        </Space>
      </Form>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        图片上传（可选，最多 9 张，≤5MB；支持 jpg/png/webp/gif）
      </Typography.Paragraph>
      <Upload
        listType="picture-card"
        fileList={fileList}
        accept="image/*"
        beforeUpload={(file) => {
          // Upload immediately to the backend; collect returned URLs
          uploadImage(file)
            .then((url) => {
              setFileList((prev) => [
                ...prev,
                { uid: `${Date.now()}-${file.name}`, name: file.name, status: "done", thumbUrl: url, url } as UploadFile,
              ]);
              msgApi.success(`已上传：${file.name}`);
            })
            .catch((e) => msgApi.error(`上传失败：${e.message}`));
          return false; // prevent default auto-upload
        }}
        onRemove={(file) => setFileList((prev) => prev.filter((f) => f.uid !== file.uid))}
      >
        <div>
          <UploadOutlined />
          <div style={{ marginTop: 8 }}>上传</div>
        </div>
      </Upload>
      {existingImgs.length + fileList.length > 0 && (
        <Image.PreviewGroup>
          <Space wrap>
            {existingImgs.map((u) => (
              <Image key={u} src={u} width={64} height={64} style={{ objectFit: "cover" }} />
            ))}
            {fileList.map((f) => (
              <Image key={f.uid} src={f.url} width={64} height={64} style={{ objectFit: "cover" }} />
            ))}
          </Space>
        </Image.PreviewGroup>
      )}
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        注：当前弹窗为元信息保存；如需将上传图片应用到商品，请保存后在编辑中更新 images 字段（简化演示）。
      </Typography.Paragraph>
    </Modal>
  );
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [msgApi, msgHolder] = message.useMessage();

  const reload = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), size: "10" });
    if (statusFilter) q.set("status_filter", statusFilter);
    if (search.trim()) q.set("search", search.trim());
    get<ProductPage>(`/api/v1/admin/products?${q}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [page, statusFilter, search]);

  useEffect(reload, [reload]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      msgApi.success(ok);
      reload();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          placeholder="按名称搜索"
          allowClear
          onSearch={(v) => { setPage(1); setSearch(v); }}
          style={{ width: 220 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 140 }}
          onChange={(v) => { setPage(1); setStatusFilter(v); }}
          options={[
            { value: "draft", label: "草稿" },
            { value: "active", label: "在售" },
            { value: "retired", label: "已下架" },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          新建商品
        </Button>
      </Space>
      <Table<Product>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={!data}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 件`,
        }}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          {
            title: "商品",
            dataIndex: "name",
            render: (name: string, r: Product) => (
              <Space>
                {r.images[0] ? <Image src={r.images[0]} width={40} height={40} style={{ objectFit: "cover" }} /> : null}
                {name}
              </Space>
            ),
          },
          { title: "Slug", dataIndex: "slug", width: 140, ellipsis: true },
          { title: "价格", dataIndex: "price_cents", width: 100, render: (c: number) => yuan(c) },
          { title: "库存", dataIndex: "stock", width: 80 },
          {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.text ?? s}</Tag>,
          },
          {
            title: "操作",
            key: "actions",
            width: 280,
            render: (_, r: Product) => (
              <Space size={4} wrap>
                <Button size="small" onClick={() => { setEditing(r); setModalOpen(true); }}>
                  编辑
                </Button>
                {r.status !== "active" ? (
                  <Button size="small" type="primary" ghost onClick={() => act(() => post(`/api/v1/admin/products/${r.id}/publish`), "已上架")}>
                    上架
                  </Button>
                ) : (
                  <Button size="small" danger ghost onClick={() => act(() => post(`/api/v1/admin/products/${r.id}/unpublish`), "已下架")}>
                    下架
                  </Button>
                )}
                <Popconfirm title="确认删除该商品？" onConfirm={() => act(() => del(`/api/v1/admin/products/${r.id}`), "已删除")}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <ProductModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} onSaved={reload} />
    </div>
  );
}
