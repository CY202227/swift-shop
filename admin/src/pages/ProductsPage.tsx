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
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { del, get, patch, post } from "../api";
import { useAuth } from "../auth";
import { useAdminI18n } from "../i18n";
import { isSuperAdmin, type Product, type ProductPage } from "../types";

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

// Inline editable discount cell: admins can tweak per-product %, super sees the same control
function DiscountCell({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [val, setVal] = useState<number>(product.discount_percent);
  const [saving, setSaving] = useState(false);
  const [msgApi, msgHolder] = message.useMessage();
  const { t } = useAdminI18n();

  const save = async (next: number | null) => {
    // Regular admins may only touch discount_percent (backend enforces the same rule)
    const v = Math.max(0, Math.min(100, next ?? 0));
    if (v === product.discount_percent) { setVal(product.discount_percent); return; }
    setSaving(true);
    try {
      await patch(`/api/v1/admin/products/${product.id}`, { discount_percent: v });
      msgApi.success(t("msg_discount_set", { name: product.name, v }));
      onSaved();
    } catch (e) {
      msgApi.error(e instanceof Error ? e.message : t("msg_save_failed"));
      setVal(product.discount_percent);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Space size={6}>
      {msgHolder}
      <InputNumber
        size="small"
        min={0}
        max={100}
        value={val}
        disabled={saving}
        formatter={(v) => `${v ?? 0}%`}
        parser={(s) => Number((s ?? "").replace("%", "")) || 0}
        style={{ width: 74 }}
        onBlur={() => save(val)}
      />
    </Space>
  );
}

interface FormValues {
  name: string;
  slug: string;
  description?: string;
  price_yuan: number;
  stock: number;
  discount_percent?: number;
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
  const { t } = useAdminI18n();

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
          discount_percent: initial.discount_percent,
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
        discount_percent: values.discount_percent ?? 0,
      };
      if (initial) {
        await patch(`/api/v1/admin/products/${initial.id}`, body);
      } else {
        await post("/api/v1/admin/products", body);
      }
      msgApi.success(initial ? t("msg_saved") : t("msg_created"));
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("msg_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? `${t("products_edit_title")} #${initial.id}` : t("products_new_title")}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={t("products_save")}
      cancelText={t("cancel")}
      width={560}
    >
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="name" label={t("products_name_label")} rules={[{ required: true, min: 1, max: 128 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="slug"
          label="URL Slug"
          rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: t("products_slug_rule") }]}
        >
          <Input disabled={!!initial} placeholder="mech-keyboard-87" />
        </Form.Item>
        <Form.Item name="description" label={t("col_description")}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space size="large">
          <Form.Item
            name="price_yuan"
            label={t("products_price_label")}
            rules={[{ required: true, type: "number", min: 0.01 }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="stock" label={t("products_stock_label")} rules={[{ required: true, type: "number", min: 0 }]}>
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
        </Space>
        <Form.Item
          name="discount_percent"
          label={t("products_discount_label")}
          rules={[{ type: "number", min: 0, max: 100 }]}
        >
          <InputNumber min={0} max={100} style={{ width: 140 }} />
        </Form.Item>
      </Form>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {t("products_upload_note")}
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
              msgApi.success(t("msg_uploaded", { name: file.name }));
            })
            .catch((e) => msgApi.error(t("msg_upload_failed", { msg: e.message })));
          return false; // prevent default auto-upload
        }}
        onRemove={(file) => setFileList((prev) => prev.filter((f) => f.uid !== file.uid))}
      >
        <div>
          <UploadOutlined />
          <div style={{ marginTop: 8 }}>{t("products_upload_btn")}</div>
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
        {t("products_images_note")}
      </Typography.Paragraph>
    </Modal>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user);
  const [data, setData] = useState<ProductPage | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [msgApi, msgHolder] = message.useMessage();
  const { t } = useAdminI18n();

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
      msgApi.error(e instanceof Error ? e.message : t("msg_operate_failed"));
    }
  };

  const statusTag = (s: string): { color: string; text: string } => {
    if (s === "draft") return { color: "default", text: t("st_draft") };
    if (s === "active") return { color: "green", text: t("st_active") };
    if (s === "retired") return { color: "orange", text: t("st_retired") };
    return { color: "default", text: s };
  };

  return (
    <div>
      {msgHolder}
      {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
      {!isSuper && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("products_readonly_banner")}
        />
      )}
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          placeholder={t("products_search_ph")}
          allowClear
          onSearch={(v) => { setPage(1); setSearch(v); }}
          style={{ width: 220 }}
        />
        <Select
          placeholder={t("products_status_filter")}
          allowClear
          style={{ width: 140 }}
          onChange={(v) => { setPage(1); setStatusFilter(v); }}
          options={[
            { value: "draft", label: t("st_draft") },
            { value: "active", label: t("st_active") },
            { value: "retired", label: t("st_retired") },
          ]}
        />
        {isSuper && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
            {t("products_create")}
          </Button>
        )}
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
          showTotal: (n) => t("products_total", { n }),
        }}
        columns={[
          { title: "ID", dataIndex: "id", width: 60 },
          {
            title: t("col_product"),
            dataIndex: "name",
            render: (name: string, r: Product) => (
              <Space>
                {r.images[0] ? <Image src={r.images[0]} width={40} height={40} style={{ objectFit: "cover" }} /> : null}
                {name}
              </Space>
            ),
          },
          { title: "Slug", dataIndex: "slug", width: 130, ellipsis: true },
          { title: t("col_price"), dataIndex: "price_cents", width: 95, render: (c: number) => yuan(c) },
          {
            title: t("col_discount"),
            dataIndex: "discount_percent",
            width: 110,
            render: (d: number, r: Product) =>
              isSuper ? (
                d > 0 ? <Tag color="red">{t("products_off_tag", { p: 100 - d })}</Tag> : <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <DiscountCell product={r} onSaved={reload} />
              ),
          },
          { title: t("col_stock"), dataIndex: "stock", width: 70 },
          {
            title: t("col_status"),
            dataIndex: "status",
            width: 90,
            render: (s: string) => {
              const tag = statusTag(s);
              return <Tag color={tag.color}>{tag.text}</Tag>;
            },
          },
          ...(isSuper
            ? [
                {
                  title: t("col_action"),
                  key: "actions",
                  width: 280,
                  render: (_: unknown, r: Product) => (
                    <Space size={4} wrap>
                      <Button size="small" onClick={() => { setEditing(r); setModalOpen(true); }}>
                        {t("products_edit")}
                      </Button>
                      {r.status !== "active" ? (
                        <Button size="small" type="primary" ghost onClick={() => act(() => post(`/api/v1/admin/products/${r.id}/publish`), t("msg_published"))}>
                          {t("products_publish")}
                        </Button>
                      ) : (
                        <Button size="small" danger ghost onClick={() => act(() => post(`/api/v1/admin/products/${r.id}/unpublish`), t("msg_unpublished"))}>
                          {t("products_unpublish")}
                        </Button>
                      )}
                      <Popconfirm title={t("confirm_delete")} onConfirm={() => act(() => del(`/api/v1/admin/products/${r.id}`), t("msg_deleted"))}>
                        <Button size="small" danger>{t("products_delete")}</Button>
                      </Popconfirm>
                    </Space>
                  ),
                } as const,
              ]
            : []),
        ]}
      />
      {isSuper && <ProductModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} onSaved={reload} />}
    </div>
  );
}
