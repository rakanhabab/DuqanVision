
#!/usr/bin/env python3
"""
session_tester.py
Small utility to simulate /sessions/update calls to your FastAPI backend.

Features:
- Build random carts from a fixed product catalog (supplied below).
- Set exact carts from a comma list: "galaxy:2, oreos, kit_kat:3".
- Update status only (processing/paid/unpaid/etc.).
- Demo mode to create multiple sessions and send timed updates.

USAGE EXAMPLES
--------------
# 1) Create one random session with 3–6 items and random qty 1–3
python session_tester.py random --min-items 3 --max-items 6 --min-qty 1 --max-qty 3

# 2) Create 5 random sessions, 2 updates each, mark them paid at the end
python session_tester.py demo --count 5 --updates 2 --every 1.0 --final-status paid

# 3) Set a specific cart for a known session id
python session_tester.py set --sid S-123 --items "galaxy:2, oreos, kit_kat:3"

# 4) Update only the status
python session_tester.py status --sid S-123 --status paid

# 5) Point to a different API base URL (env or flag)
SESSIONS_API_BASE="http://192.168.1.50:8000" python session_tester.py random
python session_tester.py random --base-url http://192.168.1.50:8000
"""
from __future__ import annotations

import argparse
import os
import random
import string
import time
from typing import Dict, List, Tuple

import requests


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

DEFAULT_BASE = os.environ.get("SESSIONS_API_BASE", "http://127.0.0.1:8000")

PRODUCTS: List[str] = [
    "alrabie_juice",
    "barni",
    "biskrem",
    "galaxy",
    "green_skittles",
    "kit_kat",
    "loacker",
    "Nadec_Mlik",
    "oreos",
    "pink_skittles",
    "protein_bar",
    "Sun_top",
    "Lays_chips",
    "pringles_barbeque",
    "Almarai_juice",
]


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _url(base: str, path: str) -> str:
    return f"{base.rstrip('/')}{path}"

def gen_session_id(prefix: str = "S") -> str:
    # Example: S-20250901-AB12
    stamp = time.strftime("%Y%m%d-%H%M%S")
    rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{stamp}-{rand}"

def random_cart(
    names: List[str] = PRODUCTS,
    n: int | None = None,
    min_items: int = 1,
    max_items: int = 5,
    min_qty: int = 1,
    max_qty: int = 3,
) -> Dict[str, int]:
    if not names:
        return {}
    if n is None:
        n = random.randint(max(1, min_items), max(min_items, max_items))
    n = min(n, len(names))
    chosen = random.sample(names, n)
    cart = {name: random.randint(max(1, min_qty), max(min_qty, max_qty)) for name in chosen}
    return cart

def parse_items_arg(items_str: str, default_qty: int = 1) -> Dict[str, int]:
    """
    Parse strings like: "galaxy:2, oreos, kit_kat:3"
    into {"galaxy":2, "oreos":1, "kit_kat":3}
    """
    cart: Dict[str, int] = {}
    for raw in items_str.split(","):
        part = raw.strip()
        if not part:
            continue
        if ":" in part:
            name, qty_s = part.split(":", 1)
            try:
                qty = int(qty_s.strip())
            except Exception:
                qty = default_qty
        else:
            name, qty = part, default_qty
        name = name.strip()
        if not name:
            continue
        if qty > 0:
            cart[name] = qty
    return cart

def send_update(
    base_url: str,
    session_id: str,
    cart: Dict[str, int] | None = None,
    status: str | None = None,
    customer_name: str | None = None,
    customer_id: str | None = None,
    timeout: float = 5.0,
) -> Tuple[bool, dict]:
    payload = {
        "session_id": session_id,
    }
    if cart is not None:
        payload["cart"] = cart
    if status:
        payload["status"] = status
    if customer_name:
        payload["customer_name"] = customer_name
    if customer_id:
        payload["customer_id"] = customer_id

    url = _url(base_url, "/sessions/update")
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        ok = 200 <= resp.status_code < 300
        data = {}
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}
        return ok, data
    except requests.RequestException as e:
        return False, {"error": str(e)}


# ----------------------------------------------------------------------------
# Command handlers
# ----------------------------------------------------------------------------

def cmd_random(args: argparse.Namespace) -> int:
    base = args.base_url
    sid = args.sid or gen_session_id()
    cart = random_cart(
        names=PRODUCTS,
        n=args.n_items,
        min_items=args.min_items,
        max_items=args.max_items,
        min_qty=args.min_qty,
        max_qty=args.max_qty,
    )
    ok, data = send_update(
        base, sid, cart=cart, status=args.status,
        customer_name=args.customer_name, customer_id=args.customer_id
    )
    print(f"[random] POST /sessions/update  sid={sid}")
    print("request.cart =", cart)
    print("response.ok  =", ok)
    print("response.body=", data)
    return 0 if ok else 2

def cmd_set(args: argparse.Namespace) -> int:
    base = args.base_url
    if not args.sid:
        print("Error: --sid is required for 'set'")
        return 2
    cart = parse_items_arg(args.items, default_qty=args.default_qty)
    ok, data = send_update(
        base, args.sid, cart=cart, status=args.status,
        customer_name=args.customer_name, customer_id=args.customer_id
    )
    print(f"[set] POST /sessions/update  sid={args.sid}")
    print("request.cart =", cart)
    print("response.ok  =", ok)
    print("response.body=", data)
    return 0 if ok else 2

def cmd_status(args: argparse.Namespace) -> int:
    base = args.base_url
    if not args.sid:
        print("Error: --sid is required for 'status'")
        return 2
    ok, data = send_update(base, args.sid, cart=None, status=args.status)
    print(f"[status] POST /sessions/update  sid={args.sid}  status={args.status}")
    print("response.ok  =", ok)
    print("response.body=", data)
    return 0 if ok else 2

def cmd_demo(args: argparse.Namespace) -> int:
    base = args.base_url
    count = max(1, args.count)
    updates = max(0, args.updates)
    sids: List[str] = []

    # Step 1: create sessions
    print(f"[demo] creating {count} sessions ...")
    for i in range(count):
        sid = gen_session_id()
        sids.append(sid)
        cart = random_cart(
            names=PRODUCTS,
            min_items=args.min_items,
            max_items=args.max_items,
            min_qty=args.min_qty,
            max_qty=args.max_qty,
        )
        ok, data = send_update(base, sid, cart=cart, status=args.initial_status)
        print(f"  created {sid}: ok={ok}")
        if not ok:
            print("   ->", data)
        time.sleep(args.every)

    # Step 2: send updates
    for u in range(updates):
        print(f"[demo] update round {u+1}/{updates}")
        for sid in sids:
            # randomly tweak: add 1–2 items or bump quantities
            tweak = random_cart(
                names=PRODUCTS,
                min_items=1,
                max_items=2,
                min_qty=args.min_qty,
                max_qty=args.max_qty,
            )
            ok, data = send_update(base, sid, cart=tweak, status=args.update_status)
            print(f"  update {sid}: ok={ok}")
            if not ok:
                print("   ->", data)
            time.sleep(args.every)

    # Step 3: final status (optional)
    if args.final_status:
        print(f"[demo] setting final status = {args.final_status}")
        for sid in sids:
            ok, data = send_update(base, sid, cart=None, status=args.final_status)
            print(f"  final {sid}: ok={ok}")
            if not ok:
                print("   ->", data)
            time.sleep(args.every)

    print("[demo] done.")
    return 0


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Simulate /sessions/update traffic.")
    p.add_argument("--base-url", default=DEFAULT_BASE, help=f"API base URL (default: {DEFAULT_BASE})")

    sub = p.add_subparsers(dest="cmd", required=True)

    # random
    pr = sub.add_parser("random", help="Create/update a session with a random cart.")
    pr.add_argument("--sid", help="Explicit session id. If omitted, a new one is generated.")
    pr.add_argument("--n-items", type=int, default=None, help="Exact number of items (overrides min/max).")
    pr.add_argument("--min-items", type=int, default=2)
    pr.add_argument("--max-items", type=int, default=6)
    pr.add_argument("--min-qty", type=int, default=1)
    pr.add_argument("--max-qty", type=int, default=3)
    pr.add_argument("--status", default="processing", help="Optional status to set.")
    pr.add_argument("--customer-name", default=None)
    pr.add_argument("--customer-id", default=None)
    pr.set_defaults(func=cmd_random)

    # set
    ps = sub.add_parser("set", help="Set an exact cart for a session from a comma list.")
    ps.add_argument("--sid", required=True, help="Target session id.")
    ps.add_argument("--items", required=False, help='Comma list: "galaxy:2, oreos, kit_kat:3"')
    ps.add_argument("--default-qty", type=int, default=1)
    ps.add_argument("--status", default=None)
    ps.add_argument("--customer-name", default=None)
    ps.add_argument("--customer-id", default=None)
    ps.set_defaults(func=cmd_set)

    # status
    pst = sub.add_parser("status", help="Update only the status for a session.")
    pst.add_argument("--sid", required=True)
    pst.add_argument("--status", required=True, help="E.g., processing, paid, unpaid")
    pst.set_defaults(func=cmd_status)

    # demo
    pd = sub.add_parser("demo", help="Create many sessions, send timed updates, then finalize status.")
    pd.add_argument("--count", type=int, default=3, help="How many sessions to create.")
    pd.add_argument("--updates", type=int, default=1, help="How many update rounds to send.")
    pd.add_argument("--every", type=float, default=0.7, help="Seconds between posts.")
    pd.add_argument("--min-items", type=int, default=2)
    pd.add_argument("--max-items", type=int, default=6)
    pd.add_argument("--min-qty", type=int, default=1)
    pd.add_argument("--max-qty", type=int, default=3)
    pd.add_argument("--initial-status", default="processing")
    pd.add_argument("--update-status", default=None, help="Optional status to set on updates.")
    pd.add_argument("--final-status", default=None, help="Status to set after all updates, e.g., paid/unpaid")
    pd.set_defaults(func=cmd_demo)

    return p

def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)

if __name__ == "__main__":
    raise SystemExit(main())
