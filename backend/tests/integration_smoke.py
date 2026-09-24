"""Task 27 final integration suite: roles, pricing, order lifecycle.

Runs against the live dev backend on 127.0.0.1:8010. Verifies the complete
matrix added in this work package: three-tier permissions, discount /
promotion / member pricing math, and the order pending->paid flow.
"""
import json
import urllib.error
import urllib.request

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
BASE = "http://127.0.0.1:8010/api/v1"
results: list[tuple[bool, str, str]] = []


def call(method: str, path: str, token: str | None = None, body: dict | None = None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        r = opener.open(req, timeout=10)
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"err": str(e)[:80]}


def check(name: str, ok: bool, detail: str = ""):
    results.append((ok, name, detail))
    print(("PASS" if ok else "FAIL"), name, ("[" + detail + "]") if not ok and detail else "")


def login(email: str, pwd: str) -> str:
    s, r = call("POST", "/auth/login", None, {"email": email, "password": pwd})
    assert s == 200, f"login {email} -> {s}"
    return r["access_token"]


SUP = login("admin@shop-dev.com", "Admin#12345")     # super admin
ADM = login("u1@test.com", "Passw0rd123")            # regular admin
USR = login("e2e1790254395694@test.com", "Passw0rd123")  # member with 5%

print("== 1. Permission matrix ==")
cases = [
    ("user cannot view admin users", "GET", "/admin/users", USR, None, 403),
    ("admin CAN view users", "GET", "/admin/users", ADM, None, 200),
    ("admin CANNOT create product", "POST", "/admin/products", ADM,
     {"name": "x", "slug": "x-test", "price_cents": 100, "stock": 1}, 403),
    ("super CAN view invites", "GET", "/admin/invite-codes", SUP, None, 200),
    ("admin CANNOT view invites", "GET", "/admin/invite-codes", ADM, None, 403),
    ("admin CANNOT view revenue", "GET", "/admin/stats/revenue", ADM, None, 403),
    ("super CAN view revenue", "GET", "/admin/stats/revenue", SUP, None, 200),
    ("admin CANNOT create promotion", "POST", "/admin/promotions", ADM,
     {"name": "x", "kind": "percent_off", "value": 5}, 403),
    ("admin CAN list products", "GET", "/admin/products", ADM, None, 200),
    ("anon CANNOT admin", "GET", "/admin/users", None, None, 401),
]
for name, m, p, tok, body, exp in cases:
    s, r = call(m, p, tok, body)
    check(name, s == exp, f"{s}!={exp} {str(r)[:60]}")

print("== 2. Pricing engine (charizard 10% + active promo 10% + member 5%) ==")
s, p = call("GET", "/products/charizard-ex-ssp-black-star")
check("product detail 200", s == 200, str(s))
s, cart = call("GET", "/cart", USR)
check("cart readable", s == 200, str(s))
s, settings = call("GET", "/public/settings")
promo = (settings or {}).get("promotion") or {}
check("public settings exposes promo", bool(promo), str(settings)[:80])
check("promo is percent_off 10", promo.get("kind") == "percent_off" and promo.get("value") == 10, str(promo))

print("== 3. Order lifecycle (create -> pay) ==")
# start from a clean cart for deterministic math
s, cart = call("DELETE", "/cart", USR, None)
s, cart = call("GET", "/cart", USR)
check("cart emptied", len(cart.get("items", [])) == 0, str(cart)[:80])
s, r = call("POST", "/cart", USR, {"product_id": 1, "qty": 1})
check("add to cart", s in (200, 201), f"{s} {str(r)[:60]}")
s, cart = call("GET", "/cart", USR)
items = cart.get("items", [])
check("cart has item", len(items) == 1, str(cart)[:120])
# expected (integer floor math, mirrors pricing.py '// 100'):
#   29900 -10%-> 26910 -10%-> 24219 effective unit
check("cart unit effective 242.19", items and items[0].get("effective_unit_cents") == 24219,
      str(items[0] if items else cart)[:100])
# ordering: create (body must exist; note is the only field)
s, order = call("POST", "/orders", USR, {"note": "integration-test"})
if s not in (200, 201):
    check("order created", False, f"{s} {str(order)[:80]}")
else:
    check("order created", True)
    # floor: 24219 * 5 // 100 = 1210 member discount; total = 24219 - 1210 = 23009
    check("order subtotal 242.19", order.get("subtotal_cents") == 24219, str(order.get("subtotal_cents")))
    check("member discount 12.10", order.get("discount_cents") == 1210, str(order.get("discount_cents")))
    check("order total 230.09", order.get("total_cents") == 23009, str(order.get("total_cents")))
    oid = order.get("id")
    s2, pay = call("POST", f"/orders/{oid}/pay", USR, {"provider": "mock"})
    check("mock pay returns pay url", s2 == 200 and "pay_url" in pay, f"{s2} {str(pay)[:60]}")
    if s2 == 200 and pay.get("pay_url"):
        # Full closed loop, same as the cashier page does:
        # 1) dev handshake returns a signed webhook body + signature
        trade_no = pay["pay_url"].rstrip("/").split("/")[-1]
        s3, pre = call("GET", f"/payments/mock/prepay/{trade_no}?paid=true", None, None)
        check("prepay handshake", s3 == 200 and "signature" in pre, f"{s3} {str(pre)[:60]}")
        if s3 == 200 and pre.get("signature"):
            req2 = urllib.request.Request(
                BASE + "/payments/webhook/mock",
                data=pre["body"].encode() if isinstance(pre["body"], str) else json.dumps(pre["body"]).encode(),
                method="POST",
            )
            req2.add_header("Content-Type", "application/json")
            req2.add_header("X-Mock-Signature", pre["signature"])
            try:
                resp2 = opener.open(req2, timeout=10)
                s4, ack = resp2.status, json.load(resp2)
            except urllib.error.HTTPError as e2:
                s4, ack = e2.code, {}
            check("webhook accepted", s4 == 200 and ack.get("received"), f"{s4} {str(ack)[:60]}")
        # order should now be paid
        s5, mine = call("GET", "/orders", USR)
        just = next((o for o in mine.get("items", []) if o.get("id") == oid), {})
        check("order paid end-to-end", just.get("status") == "paid", str(just)[:100])

print("== 4. Admin views the order + revenue ==")
s, rev = call("GET", "/admin/stats/revenue", SUP)
check("revenue has series", s == 200 and len(rev.get("series", [])) >= 1, str(rev)[:80])
check("revenue realized > 0", rev.get("realized_cents", 0) > 0, str(rev.get("realized_cents")))

# summary
ok = sum(1 for x in results if x[0])
print(f"\n{ok}/{len(results)} PASSED")
raise SystemExit(0 if ok == len(results) else 1)
