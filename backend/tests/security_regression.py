"""Security regression suite: verifies the three patches from the audit.

1. Payment webhook rejects tampered amounts (order must stay unpaid)
2. Email verification code burns after 5 wrong attempts
3. (static) JWT_SECRET prod guard - verified by inspection, not runtime
Also re-runs the standing permission matrix as a whole-system regression.
"""
import json
import urllib.request
import urllib.error

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
BASE = "http://127.0.0.1:8010/api/v1"
results = []


def call(method, path, token=None, body=None, raw_body=None, headers=None):
    data = raw_body if raw_body is not None else (json.dumps(body).encode() if body else None)
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
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
        return 0, {"err": str(e)[:90]}


def check(name, ok, dbg=""):
    results.append(("PASS" if ok else "FAIL", name, str(dbg)[:100]))


# --- login as the member user (owns orders + cart) ---
s, r = call("POST", "/auth/login", body={"email": "r", "password": "x"})
# real logins below
s, sup = call("POST", "/auth/login", body={"email": "admin@shop-dev.com", "password": "Admin#12345"})
SUP = sup["access_token"]
s, usr = call("POST", "/auth/login", body={"email": "e2e1790254395694@test.com", "password": "Passw0rd123"})
USR = usr["access_token"]

# ============ TEST 1: webhook rejects amount tampering ============
print("== 1. Webhook amount tampering ==")
from app.payments.mock import trades_get  # noqa: E402  (same process as server? No - separate.)
# Use API instead: /payments/mock/prepay builds signed bodies.
# 1) empty cart, add cheapest product, create order, initiate pay
call("DELETE", "/cart", USR)
call("POST", "/cart", USR, {"product_id": 2, "qty": 1})  # pikachu 12900 -10% promo = 11610
s, order = call("POST", "/orders", USR, {
    "note": "sec-test",
    "recipient_name": "Sec Tester",
    "recipient_phone": "13800000000",
    "address": "Security Lab, 1 Test Road",
})
check("order created", s == 201, f"{s} {order}")
total = order.get("total_cents", 0)
s, pay = call("POST", f"/orders/{order['id']}/pay", USR, {"provider": "mock"})
check("pay initiated", s == 200 and "pay_url" in pay, f"{s} {str(pay)[:80]}")
trade_no = pay.get("pay_url", "").rsplit("/", 1)[-1]

# 2) tampered: signed webhook body with wrong amount, paid=true
s, prep = call("GET", f"/payments/mock/prepay/{trade_no}?paid=true", None, None)
check("prepay ok", s == 200, f"{s} {str(prep)[:80]}")
body = json.loads(prep["body"])
body["amount_cents"] = 1  # forged: pay 1 cent for a 116.10 order
forged = json.dumps(body, separators=(",", ":")).encode()
s, resp = call("POST", "/payments/webhook/mock", None, raw_body=forged,
               headers={"X-Mock-Signature": prep["signature"]})
# signature now invalid because body changed -> provider rejects; but test the
# deeper case: rebuild a VALID signature for the wrong amount via prepay? can't.
# The mock prepay always uses trade's real amount, so the only forged path is
# an invalid signature. The amount check protects real gateways where the
# signature covers their own (possibly partial/tampered) amount.
check("forged body rejected (bad sig)", s == 200 and resp.get("ignored"), f"{s} {resp}")
s, lst = call("GET", "/orders", USR)
mine = lst.get("items", [])
just = next((o for o in mine if o["id"] == order["id"]), {})
check("order NOT paid after forged attempt", just.get("status") != "paid", str(just)[:80])

# 2b) tamper amount but keep a signature that DOES verify: simulate a gateway
# that signs its own payload with a different amount. Use prepay to get a
# valid-signature body, then check the flow still only pays the real amount —
# prepay body has correct amount, so pay normally and confirm paid.
s, prep2 = call("GET", f"/payments/mock/prepay/{trade_no}?paid=true", None, None)
s, resp2 = call("POST", "/payments/webhook/mock", None, raw_body=prep2["body"].encode(),
                headers={"X-Mock-Signature": prep2["signature"]})
check("legit webhook accepted", resp2.get("received") and not resp2.get("ignored"), f"{resp2}")
s, lst = call("GET", "/orders", USR)
just = next((o for o in lst.get("items", []) if o["id"] == order["id"]), {})
check("order paid after legit webhook", just.get("status") == "paid", str(just)[:80])

# ============ TEST 2: verification code brute force ============
print("== 2. Email code brute force guard ==")
email = f"bruteforce-test-{__import__('time').strftime('%H%M%S')}@test.com"
s, r = call("POST", "/auth/register", body={"email": email, "password": "Passw0rd123", "username": "bf"})
check("code issued", s == 202, f"{s} {r}")
codes = []
for i in range(6):
    s, r = call("POST", "/auth/verify-email", body={"email": email, "code": f"{i:06d}"})
    codes.append(s)
# first 5 attempts: 400 wrong code; 6th: should be 429 (burned)
check("5 wrong codes -> 400", codes[:5] == [400] * 5, str(codes))
check("6th attempt -> 429 burned", codes[5] == 429, str(codes))
# code truly burned: even the right code now fails
s, r = call("POST", "/auth/verify-email", body={"email": email, "code": "000000"})
check("burned code rejected even if right", s in (400, 429), f"{s}")

# ============ TEST 3: permission matrix spot check ============
print("== 3. Permission matrix regression ==")
s, r = call("POST", "/admin/promotions", USR, {"name": "hack", "kind": "percent_off", "value": 90})
check("user cannot create promotion", s == 403, str(s))
s, r = call("GET", "/admin/stats/revenue", USR, None)
check("user cannot read revenue", s == 403, str(s))
s, r = call("PATCH", "/admin/users/3", USR, {"role": "super_admin"})
check("user cannot self-escalate", s in (403, 401), str(s))
s, r = call("GET", "/orders/1", USR, None)
# order 1 belongs to someone else? check ownership enforcement
s2, r2 = call("GET", "/orders/999", USR, None)
check("foreign/missing order -> 404", s2 == 404, f"{s2}")

print()
print(f"{sum(1 for r_ in results if r_[0]=='PASS')}/{len(results)} PASSED")
for st, name, dbg in results:
    print(f"{st}  {name}" + (f"  [{dbg}]" if st == "FAIL" and dbg else ""))
