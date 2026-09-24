import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { del, get, post, ApiError } from "../api";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { Order, OrderPage, PayOut } from "../types";

export default function OrdersPage() {
  const [data, setData] = useState<OrderPage | null>(null);
  const [msg, setMsg] = useState("");
  const location = useLocation() as { state: { newOrder?: Order } | null };
  const { lang, t } = useI18n();
  const newOrder = location.state?.newOrder;

  const statusText = (s: string) =>
    ({
      pending_payment: t("status_pending_payment"),
      paid: t("status_paid"),
      cancelled: t("status_cancelled"),
      completed: t("status_completed"),
    })[s] ?? s;

  const reload = () => {
    get("/api/v1/orders")
      .then((d) => setData(d as OrderPage))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : t("load_failed")));
  };

  useEffect(reload, []);

  const pay = async (orderId: number) => {
    setMsg("");
    try {
      const out = (await post(`/api/v1/orders/${orderId}/pay`, { provider: "mock" })) as PayOut;
      if (out.pay_url) {
        // Mock cashier page is backend-rendered; open then return here after paying
        window.location.href = out.pay_url;
      } else {
        setMsg(t("err_no_pay_url"));
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_pay"));
    }
  };

  const cancel = async (orderId: number) => {
    setMsg("");
    try {
      await post(`/api/v1/orders/${orderId}/cancel`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_cancel"));
    }
  };

  if (!data) return <div className="empty">{msg || t("loading")}</div>;

  return (
    <div>
      <h1 className="page-title">{t("my_orders")}</h1>
      {newOrder && (
        <div className="banner">
          {t("order_created_banner", { no: newOrder.order_no })}
        </div>
      )}
      {msg && <div className="form-error">{msg}</div>}
      {data.items.length === 0 ? (
        <div className="empty">{t("no_orders_yet")}</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("order_no")}</th>
              <th>{t("order_items")}</th>
              <th>{t("order_amount")}</th>
              <th>{t("order_status")}</th>
              <th>{t("order_created_at")}</th>
              <th>{t("order_action")}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.order_no}</td>
                <td>
                  {o.items.map((i) => (
                    <div key={i.product_id} className="order-item">
                      {i.title} × {i.qty}
                    </div>
                  ))}
                  {o.promotion_name && (
                    <div className="order-promo">🎉 {o.promotion_name}</div>
                  )}
                </td>
                <td>
                  ¥{yuan(o.total_cents)}
                  {(o.discount_cents ?? 0) > 0 && (
                    <div className="order-discount">
                      -¥{yuan(o.discount_cents ?? 0)}
                    </div>
                  )}
                </td>
                <td>
                  <span className={"badge " + o.status}>{statusText(o.status)}</span>
                  {o.paid_at && <div className="paid-at">{fmtTimeSafe(o.paid_at)}</div>}
                </td>
                <td>{fmtTimeSafe(o.created_at)}</td>
                <td>
                  {o.status === "pending_payment" && (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => pay(o.id)}>
                        {t("go_pay")}
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => cancel(o.id)}>
                        {t("cancel_order")}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function fmtTimeSafe(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}
