"""XFF (X-Forwarded-For) resolution unit tests — spoofing scenarios.

Matrix:
- depth=0 (default, direct): XFF ignored -> TCP peer
- depth=1, honest proxy:     XFF "<real>"              -> <real>
- depth=1, spoof attempt:    XFF "1.2.3.4, <real>"     -> <real>  (spoof at left is skipped)
- depth=2 (nginx+CDN):       XFF "spoof, real, cdn"    -> real    (rightmost-2 rule)
"""
import sys
sys.path.insert(0, ".")

from app.core.config import settings
from app.core.netutil import real_client_ip


class FakeClient:
    def __init__(self, host):
        self.host = host


class FakeHeaders:
    def __init__(self, d):
        self._d = d

    def get(self, k, default=""):
        return self._d.get(k.lower(), default)


class FakeRequest:
    def __init__(self, ip, xff=None):
        self.client = FakeClient(ip)
        self.headers = FakeHeaders({"x-forwarded-for": xff} if xff else {})


def run(depth, xff, peer, expected, name):
    settings.TRUST_PROXY_DEPTH = depth
    got = real_client_ip(FakeRequest(peer, xff))
    ok = got == expected
    print(("PASS" if ok else "FAIL"), name, f"depth={depth} xff={xff!r} -> {got}" + ("" if ok else f" (want {expected})"))
    return ok


results = [
    run(0, "6.6.6.6", "10.0.0.9", "10.0.0.9", "direct: XFF ignored"),
    run(0, None, "10.0.0.9", "10.0.0.9", "direct: no XFF"),
    run(1, "203.0.113.7", "10.0.0.9", "203.0.113.7", "one proxy: real IP passed"),
    run(1, "1.2.3.4, 203.0.113.7", "10.0.0.9", "203.0.113.7", "spoof-left ignored (depth 1)"),
    run(1, "1.2.3.4, 5.6.7.8, 203.0.113.7", "10.0.0.9", "203.0.113.7", "multi-spoof ignored"),
    run(2, "1.2.3.4, 203.0.113.7, 198.51.100.2", "10.0.0.9", "203.0.113.7", "nginx+CDN: rightmost-2"),
    run(2, None, "10.0.0.9", "10.0.0.9", "proxy mode, no XFF header -> peer"),
    run(2, "onlyspoof", "10.0.0.9", "10.0.0.9", "fewer hops than depth -> fallback safe"),
    # depth=1 with exactly 1 entry IS the honest single-proxy path (see case 3);
    # trusting it is correct — with depth=1 the rightmost entry is always
    # written by our own proxy. The unsafe variant is depth > entry count.
    run(1, "203.0.113.99", "10.0.0.9", "203.0.113.99", "depth=1 single entry = honest path"),
]

passed = sum(results)
print(f"\n{passed}/{len(results)} PASSED")
sys.exit(0 if passed == len(results) else 1)
