from fastapi import FastAPI, HTTPException, Query
from supabase import get_connection
from pydantic import BaseModel, Field, constr
from typing import List
from psycopg2.extras import Json
from datetime import datetime

app = FastAPI()

@app.get("/users")
def get_all_users():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users;")
        rows = cur.fetchall()
        colnames = [desc[0] for desc in cur.description]
        cur.close()
        conn.close()
        return [dict(zip(colnames, row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/name")
def get_first_name(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT first_name FROM users WHERE id = %s;", (user_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {row[0]}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/products/{name}")
def get_product_by_name(name: str):
    """
    Retrieve a single product by its unique name.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, price, shelf, category, calories
            FROM products
            WHERE name = %s
            """,
            (name,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Product not found")

        colnames = ["id", "name", "price", "shelf", "category", "calories"]
        return dict(zip(colnames, row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# Invoices
# =========================
class InvoiceItem(BaseModel):
    # Using product name as requested; quantity must be positive integer
    name: constr(strip_whitespace=True, min_length=1)
    quantity: int = Field(..., gt=0)


class InvoiceCreate(BaseModel):
    user_id: constr(strip_whitespace=True, min_length=1)
    items: List[InvoiceItem] = Field(..., min_items=1)


@app.post("/invoices")
def create_invoice(payload: InvoiceCreate):
    """
        Create an invoice:
        - Looks up each product by name
        - Computes line totals and overall total_amount
        - Inserts a row into `invoices` with products_and_quantites (JSONB)

        Table schema reminder:
        invoices(
            id, user_id, branch_id, payment_id, timestamp,
            total_amount, products_and_quantites JSONB, status
        )
    """
    try:
        conn = get_connection()
        cur = conn.cursor()

        # 1) Fetch product data for all requested names in one query
        names = [it.name for it in payload.items]
        cur.execute(
            """
            SELECT id, name, price
            FROM products
            WHERE name = ANY(%s)
            """,
            (names,),
        )
        rows = cur.fetchall()
        if not rows:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="None of the products were found")

        # Build a lookup: name -> (id, price)
        found = {r[1]: {"id": r[0], "price": float(r[2])} for r in rows}

        # Ensure all requested names exist
        missing = [n for n in names if n not in found]
        if missing:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=404,
                detail=f"Products not found: {', '.join(missing)}"
            )

        # 2) Build products_and_quantites JSON structure & compute totals
        items_detailed = []
        total_amount = 0.0
        for it in payload.items:
            info = found[it.name]
            line_total = info["price"] * it.quantity
            total_amount += line_total
            items_detailed.append({
                "product_id": info["id"],
                "name": it.name,
                "quantity": it.quantity,
                "unit_price": info["price"],
                "line_total": line_total,
            })
        
        # 3) Insert invoice
        # payment_id left NULL here; timestamp assumed default NOW() in DB

        cur.execute(
            """
            SELECT id
            FROM payment_methods
            WHERE user_id = %s AND is_default = TRUE
            """,
            (payload.user_id,),
        )
        payment_row = cur.fetchone()
        
        payment_id = payment_row[0] if payment_row and payment_row[0] is not None else None
        status = "paid" if payment_id else "unpaid"

        cur.execute(
            """
            INSERT INTO invoices (user_id, branch_id, payment_id, total_amount, products_and_quantities, status, branch_num)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, branch_id, payment_id, timestamp, total_amount, products_and_quantities, status, branch_num, invoice_num
            """,
            (
                payload.user_id,
                "130df862-b9e2-4233-8d67-d87a3d3b8323",
                payment_id,
                total_amount,
                Json(items_detailed),
                status,
                "BR001"
            ),
        )
        created = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        colnames = ["id", "user_id", "branch_id", "payment_id", "timestamp", "total_amount", "products_and_quantities", "status"]
        return dict(zip(colnames, created))

    except HTTPException:
        raise
    except Exception as e:
        # rollback if something goes wrong after BEGIN (implicit)
        try:
            conn.rollback()
        except Exception:
            pass
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

""" normalize_invoice_or_ticket_items
DECLARE
  out_items jsonb := '[]'::jsonb
BEGIN
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'products_and_quantities must be a JSON array of objects';
  END IF;

  -- Build a deduped, validated set
  WITH raw AS (
    SELECT
      elem ->> 'product_id' AS product_id,
      COALESCE( (elem ->> 'qty')::int, NULL ) AS qty
    FROM jsonb_array_elements(_items) AS elem
  ),
  cleaned AS (
    SELECT
      product_id,
      SUM(qty) AS qty
    FROM raw
    WHERE product_id IS NOT NULL
      AND qty IS NOT NULL
      AND qty >= 1
    GROUP BY product_id
  ),
  validated AS (
    SELECT c.product_id, c.qty
    FROM cleaned c
    JOIN products p ON p.id = c.product_id
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty)),
    '[]'::jsonb
  )
  INTO out_items
  FROM validated;

  IF jsonb_array_length(out_items) = 0 THEN
    -- allow empty arrays if you want; otherwise uncomment next line
    -- RAISE EXCEPTION 'products_and_quantities cannot be empty after validation';
    RETURN out_items;
  END IF;

  RETURN out_items;
END
"""

# ---------------------------------------------------------------------------
# Additional endpoints for live sessions, events and MJPEG video streaming
# ---------------------------------------------------------------------------
# The operations dashboard and motion tracking subsystem need a simple way to
# exchange session information and event log messages. Instead of storing
# these in a database, we keep them in memory here. This section augments
# the existing FastAPI application with new routes and middleware. It should
# not interfere with the existing invoice endpoints above.

from fastapi.responses import StreamingResponse  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
import cv2  # type: ignore
import threading
from typing import Dict, Any

import time

# Enable CORS so the front‑end can call this API from any origin
try:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception:
    # Ignore if middleware has already been added
    pass

# In‑memory store of sessions and events
sessions_state: Dict[str, Dict[str, Any]] = {}
event_log: List[Dict[str, str]] = []


class SessionUpdate(BaseModel):
    """Payload schema for updating or creating a session."""
    session_id: constr(strip_whitespace=True, min_length=1)
    cart: Dict[str, int] | None = None
    status: constr(strip_whitespace=True, min_length=1) | None = None
    customer_name: str | None = None
    customer_id: str | None = None


class EventIn(BaseModel):
    """Payload schema for posting a new event message."""
    message: constr(strip_whitespace=True, min_length=1)


@app.get("/sessions")
def api_get_sessions() -> List[Dict[str, Any]]:
    """Return a list of all current sessions."""
    return list(sessions_state.values())


@app.post("/sessions/update")
def api_update_session(update: SessionUpdate) -> Dict[str, Any]:
    """Create or update a session with cart and status information.

    Each session is identified by a unique `session_id`. Providing a `cart`
    replaces the existing items list. Status, customer_name and customer_id
    are updated if present. A timestamp is always updated on each call.
    """
    sid = update.session_id
    session = sessions_state.get(sid) or {
        "id": sid,
        "customerId": update.customer_id or sid,
        "customerName": update.customer_name or "",
        "status": "processing",
        "timestamp": datetime.utcnow().isoformat(),
        "items": []
    }
    # Update identity
    if update.customer_id:
        session["customerId"] = update.customer_id
    if update.customer_name:
        session["customerName"] = update.customer_name
    # Update cart
    if update.cart is not None:
        items: List[Dict[str, Any]] = []
        for name, qty in update.cart.items():
            try:
                q = int(qty)
            except Exception:
                q = 0
            if q <= 0:
                continue
            items.append({
                "name": name,
                "sku": name,
                "quantity": q,
                "price": 0.0
            })
        session["items"] = items
    # Update status if provided
    if update.status:
        session["status"] = update.status
    # Always update timestamp
    session["timestamp"] = datetime.utcnow().isoformat()
    sessions_state[sid] = session
    return {"ok": True, "session": session}


@app.get("/events")
def api_get_events(limit: int = Query(default=100, ge=1, le=1000)) -> List[Dict[str, str]]:
    """Return the most recent event messages up to `limit`."""
    return event_log[-limit:]


@app.post("/events")
def api_post_event(event: EventIn) -> Dict[str, str]:
    """Append a new event message to the in‑memory log."""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "message": event.message
    }
    event_log.append(entry)
    # Keep only last 100 events
    if len(event_log) > 100:
        del event_log[:-100]
    return {"ok": True}


# Video feed globals and helpers
_cap_lock = threading.Lock()
_cap: cv2.VideoCapture | None = None


def _get_cap() -> cv2.VideoCapture:
    """Get or create a global VideoCapture object. Throws on failure."""
    global _cap
    with _cap_lock:
        if _cap is None or not _cap.isOpened():
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                raise RuntimeError("Could not open camera for video feed")
            _cap = cap
        return _cap


@app.get("/video_feed")
def api_video_feed():
    """Serve an MJPEG stream of frames from the default camera."""
    def gen():
        try:
            cap = _get_cap()
        except Exception as exc:
            # yield empty frames in error state to avoid connection drop
            print(f"[video_feed] camera error: {exc}")
            while True:
                time.sleep(1.0)
                yield b''
        while True:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                continue
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return StreamingResponse(gen(), media_type='multipart/x-mixed-replace; boundary=frame')