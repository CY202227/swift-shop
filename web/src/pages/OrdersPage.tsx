import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { del, get, post, ApiError } from "../api";
import { fmtTime, STATUS_TEXT, yuan } from "../format";
import type { Order, OrderPage, PayOut } from "../types";

export default function OrdersPage() {
  const [data, setData] = useState<OrderPage | null>(null);
  const [msg, setMsg] = useState("");
  const location = useLocation() as { state: { newOrder?: Order } | null };
  const newOrder = location.state?.newOrder;

  const reload = () => {
    get("/api/v1/orders")
      .then((d) => setData(d as OrderPage))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : "加载失败"));
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
        setMsg("支付渠道未返回支付链接");
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "发起支付失败");
    }
  };

  const cancel = async (orderId: number) => {
    setMsg("");
    try {
      await post(`/api/v1/orders/${orderId}/cancel`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "取消失败");
    }
  };

  if (!data) return <div className="empty">{msg || "加载中…"}</div>;

  return (
    <div>
      <h1 className="page-title">我的订单</h1>
      {newOrder && (
        <div className="banner">
          订单 <b>{newOrder.order_no}</b> 已创建，请尽快支付（状态流转见下表）
        </div>
      )}
      {msg && <div className="form-error">{msg}</div>}
      {data.items.length === 0 ? (
        <div className="empty">还没有订单</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>商品</th>
              <th>金额</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
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
                </td>
                <td>¥{yuan(o.total_cents)}</td>
                <td>
                  <span className={"badge " + o.status}>{STATUS_TEXT[o.status] ?? o.status}</span>
                  {o.paid_at && (
                    <div className="paid-at">{fmtTime(o.paid_at)}</div>
                  )}
                </td>
                <td>{fmtTime(o.created_at)}</td>
                <td>
                  {o.status === "pending_payment" && (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => pay(o.id)}>
                        去支付
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => cancel(o.id)}>
                        取消
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
