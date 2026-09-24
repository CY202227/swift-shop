import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { del, get, patch, post, ApiError } from "../api";
import { yuan } from "../format";
import type { Cart } from "../types";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const reload = () => {
    get("/api/v1/cart")
      .then((d) => setCart(d as Cart))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : "加载失败"));
  };

  useEffect(reload, []);

  const changeQty = async (itemId: number, qty: number) => {
    try {
      setCart(await patch(`/api/v1/cart/${itemId}`, { qty }) as Cart);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "更新失败");
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      setCart(await del(`/api/v1/cart/${itemId}`) as Cart);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "删除失败");
    }
  };

  const checkout = async () => {
    try {
      const order = await post("/api/v1/orders", {});
      navigate("/orders", { state: { newOrder: order } });
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "下单失败");
    }
  };

  if (!cart) return <div className="empty">{msg || "加载中…"}</div>;

  return (
    <div>
      <h1 className="page-title">购物车</h1>
      {cart.items.length === 0 ? (
        <div className="empty">购物车是空的，去逛逛吧</div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>单价</th>
                <th>数量</th>
                <th>小计</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td>¥{yuan(it.price_cents)}</td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={1}
                      max={Math.min(it.stock, 99)}
                      value={it.qty}
                      onChange={(e) =>
                        changeQty(it.id, Math.max(1, Math.min(Number(e.target.value) || 1, Math.min(it.stock, 99))))
                      }
                    />
                  </td>
                  <td>¥{yuan(it.subtotal_cents)}</td>
                  <td>
                    <button className="btn-link danger" onClick={() => removeItem(it.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-foot">
            <span>
              共 <b>{cart.items.reduce((s, i) => s + i.qty, 0)}</b> 件，合计{" "}
              <b className="price">¥{yuan(cart.total_cents)}</b>
            </span>
            <button className="btn btn-primary" onClick={checkout}>
              结算下单
            </button>
          </div>
        </>
      )}
      {msg && <div className="form-error">{msg}</div>}
    </div>
  );
}
