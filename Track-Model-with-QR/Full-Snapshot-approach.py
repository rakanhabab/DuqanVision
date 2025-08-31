import os
os.environ["ULTRALYTICS_LAP"] = "scipy"
import cv2
import numpy as np
from ultralytics import YOLO
from collections import defaultdict, Counter
from api import *
import requests
from typing import List
import torch
import threading
import time

# ---------------------------------------------------------------------------
# Helpers to integrate with the FastAPI backend
# ---------------------------------------------------------------------------
def log_event(message: str) -> None:
    """
    Send a human‑readable event message to the API's /events endpoint. This
    function is non‑blocking and will silently ignore network errors so as
    not to disrupt the motion tracking loop.
    """
    try:
        requests.post("http://127.0.0.1:8000/events", json={"message": message}, timeout=0.5)
    except Exception:
        pass


def push_session_update(track_id: int, cart_items_list: list, status: str = "processing", user_name: str | None = None) -> None:
    """
    Push the current cart for a track to the API's /sessions/update endpoint.

    :param track_id: The integer track identifier used as session_id.
    :param cart_items_list: A list of items (objects with .name and .quantity).
    :param status: The status of the session (processing, paid, unpaid).
    :param user_name: Optional human‑readable name linked to this track.
    """
    cart_dict: dict[str, int] = {}
    for it in cart_items_list:
        name = getattr(it, 'name', None)
        qty = getattr(it, 'quantity', None)
        if name and qty:
            cart_dict[name] = int(qty)
    payload = {
        "session_id": str(track_id),
        "cart": cart_dict,
        "status": status
    }
    if user_name:
        payload["customer_name"] = user_name
    try:
        requests.post("http://127.0.0.1:8000/sessions/update", json=payload, timeout=0.5)
    except Exception:
        pass

INVOICE_API_URL = "http://127.0.0.1:8000/invoices"

MOTION_CAM_INDEX = 0        # YOLO tracking camera
QR_CAM_INDEX = 1            # QR scanning camera
TABLE_A_CAM_INDEX = 2       # snapshot camera for Table A (unused; replaced by snapshot requests)
TABLE_B_CAM_INDEX = 3       # snapshot camera for Table B (unused; replaced by snapshot requests)

MODEL_WEIGHTS = "yolov8n.pt"
PERSON_CLASS_ID = 0
NEAR_MARGIN_PX = 10

# Hard-coded table zones by pixel
# Note: Table A coordinates should match the area in the motion frame corresponding
# to shelf A. Table B coordinates have been left as zero initially but should
# be updated to cover the physical location of shelf B in the motion feed.
TABLES = {
    "Table A": (460, 215, 520, 366),
    "Table B": (127, 134, 190, 250),
}

# Define a separate zone for QR updates. If a person's centre is inside this
# rectangle, any detected QR code will automatically update their identity
# without requiring a manual selection. Adjust coordinates as needed.
QR_UPDATE_ZONE = (280, 60, 330,180)  # x1, y1, x2, y2; update to match your setup

CLEAR_LATEST_ON_EXIT = False

# Maps (track_id, zone) → baseline snapshot list
baseline_snapshots: dict[tuple[int, str], list[str]] = {}

# Snapshot configuration
# IP address of the Raspberry Pi providing snapshot endpoints. Update if different.
PI_IP = "192.168.1.7"

# URL templates to fetch current shelf snapshots for each table. These endpoints
# should return a JPEG image of the shelf. For example, the Raspberry Pi may
# expose /snap/camA and /snap/camB as in run_yolo_snapshot.py. You can
# customise the resolution and quality via query parameters.
SNAPSHOT_URLS = {
    "Table A": f"http://{PI_IP}:8080/snap/camA",
    "Table B": f"http://{PI_IP}:8080/snap/camB",
}

# Default snapshot request parameters. Use width/height/quality if supported
# by your snapshot server. These help ensure consistent input size for YOLO.
SNAP_PARAMS = {"w": 640, "h": 480, "q": 2}

# Maximum seconds to wait for snapshot HTTP response
SNAP_TIMEOUT = 6.0

# Hold the most recent annotated snapshots for each table, updated
# periodically by snapshot threads.
last_snapshot_annotated = {"Table A": None, "Table B": None}

# Event to signal snapshot threads to stop
stop_snapshot_event = threading.Event()

# Create separate model for item detection (same weights)
device = "cuda" if torch.cuda.is_available() else "cpu"
item_model = YOLO(r"Track-Model-with-QR\weights.pt")
print(device)
item_model.to("cuda")

def fetch_snapshot_for_table(table_name: str) -> np.ndarray | None:
    """
    Fetch a snapshot image for the given table via HTTP. The Raspberry Pi is
    expected to provide an endpoint that returns a JPEG image of the shelf.

    The function appends a timestamp parameter to bust caches and uses
    SNAP_PARAMS for resolution/quality if defined. Returns a decoded
    BGR image or None on error.
    """
    url = SNAPSHOT_URLS.get(table_name)
    if not url:
        return None
    # Build query parameters: include timestamp to avoid caching
    params = {"t": str(int(time.time() * 1000))}
    params.update(SNAP_PARAMS or {})
    try:
        r = requests.get(url, params=params, timeout=SNAP_TIMEOUT,
                         headers={"Cache-Control": "no-cache"})
        r.raise_for_status()
        arr = np.frombuffer(r.content, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"[snapshot {table_name}] failed: {e}")
        return None

def _to_dict(model):
    # Pydantic v2 uses model_dump(); v1 uses dict()
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def capture_snapshot(table_name: str) -> list[str]:
    """
    Fetch a snapshot for the specified table, run object detection on it,
    and return a list of class names. Supports duplicates; if two identical
    items are present, both names will appear in the output list.
    """
    img = fetch_snapshot_for_table(table_name)
    if img is None:
        print(f"[snapshot] Failed to fetch snapshot for {table_name}.")
        return []
    # Run detection on the snapshot frame
    results = item_model(
        img,
        conf=0.30,
        iou=0.45,
        agnostic_nms=True,
        verbose=False
    )
    if results and results[0].boxes is not None:
        return [item_model.names[int(box.cls[0])] for box in results[0].boxes]
    return []

def compute_missing_and_returned(baseline: list[str], current: list[str]) -> tuple[list[str], list[str]]:
    """
    Compare baseline and current lists and return two lists:
      * missing: items present in baseline but not in current (duplicates preserved).
      * returned: items present in current but not in baseline (duplicates preserved).

    Using collections.Counter allows for multiset subtraction in O(n) time. If a
    customer returns an item to the shelf, the returned items list contains
    those names; they can be cross‑referenced with the cart to remove items.
    """
    b_counter = Counter(baseline)
    c_counter = Counter(current)
    missing_counter = b_counter - c_counter
    returned_counter = c_counter - b_counter
    missing: list[str] = []
    returned: list[str] = []
    for name, count in missing_counter.items():
        missing.extend([name] * count)
    for name, count in returned_counter.items():
        returned.extend([name] * count)
    return missing, returned

def on_zone_enter(track_id: int, zone: str):
    """
    Fired when a person ENTERS a zone (including switching from another zone).
    Captures a baseline snapshot of items on that table.
    """
    print(f"[enter] track {track_id} -> {zone} | LatestA={TableALatestID} LatestB={TableBLatestID}")
    if zone in ["Table A", "Table B"]:
        # Take snapshot at moment of entering
        baseline = capture_snapshot(zone)
        baseline_snapshots[(track_id, zone)] = baseline
        print(f"[snapshot] Baseline for {zone}, track {track_id}: {baseline}")

def on_zone_exit(track_id: int, zone: str):
    """
    Fired when a person LEAVES a zone (including switching to another zone).
    Captures current snapshot, computes missing items, and queues them.
    """
    global TableALatestID, TableBLatestID

    # Process item differences if we have a baseline for this track in this zone
    baseline = baseline_snapshots.pop((track_id, zone), None)
    if baseline is not None:
        # Defer snapshot and diff processing by 3 seconds to allow any latency
        # in the shelf snapshot feed to catch up. Use a separate thread so the
        # main loop remains responsive.
        def _process_exit(track_id=track_id, zone=zone, baseline=baseline):
            current_items = capture_snapshot(zone)
            # Compute missing (items taken) and returned (items put back)
            missing, returned = compute_missing_and_returned(baseline, current_items)
            # Queue missing items
            if missing:
                print(f"[snapshot] Missing items for {zone}, track {track_id}: {missing}")
                for item_name in missing:
                    queue_invoice_item(track_id, item_name, 1)
            # Handle returned items: remove from cart if the user had them
            if returned:
                print(f"[snapshot] Returned items for {zone}, track {track_id}: {returned}")
                cart_list = cart_items.get(track_id, [])
                for item_name in returned:
                    for it in list(cart_list):
                        if getattr(it, "name", None) == item_name:
                            if getattr(it, "quantity", 1) > 1:
                                it.quantity -= 1
                                print(f"[cart] track {track_id}: -1 {item_name} (new qty {it.quantity})")
                            else:
                                cart_list.remove(it)
                                print(f"[cart] track {track_id}: removed {item_name}")
                            # Log and push update
                            try:
                                log_event(f"track {track_id}: returned {item_name}")
                                user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
                                push_session_update(track_id, cart_items[track_id], status="processing", user_name=user_name)
                            except Exception:
                                pass
                            break
        # Schedule the processing after 3 seconds
        threading.Timer(2.0, _process_exit).start()

    # Maintain last user ID logic
    user_id = identity_map.get(track_id, (str(track_id), ""))[0]
    if zone == "Table A":
        TableALatestID = user_id
    elif zone == "Table B":
        TableBLatestID = user_id

    print(f"[leave] track {track_id} <- {zone} | LatestA={TableALatestID} LatestB={TableBLatestID}")

def on_zone_change(track_id: int, new_zone: str | None, old_zone: str | None):
    # No movement
    if new_zone == old_zone:
        return

    # Left all zones
    if old_zone is not None and new_zone is None:
        on_zone_exit(track_id, old_zone)
        return

    # Entered from no zone
    if old_zone is None and new_zone is not None:
        on_zone_enter(track_id, new_zone)
        return

    # Switched zones (treat as exit then enter)
    if old_zone is not None and new_zone is not None:
        on_zone_exit(track_id, old_zone)
        on_zone_enter(track_id, new_zone)
        return

def on_identity_linked(track_id: int, user_id: str, user_name: str):
    print(f"[identity] track {track_id} linked to {user_name} ({user_id})")

# ----------------------------
# UTILS
# ----------------------------

def queue_invoice_item(track_id: int, name: str, quantity: int):
    """
    Call this whenever your shelf logic decides the person took an item.
    Example: queue_invoice_item(track_id, "Pepsi 330ml", 1)
    """
    try:
        items = cart_items[track_id]  # defaultdict(list) ensures a list exists
        for it in items:
            if it.name == name:
                it.quantity += quantity
                print(f"[cart] track {track_id}: updated {name} by +{quantity} (new qty {it.quantity})")
                break
        else:
            items.append(InvoiceItem(name=name, quantity=quantity))
            print(f"[cart] track {track_id}: +{quantity} x {name} (total items now {len(items)})")
        # Notify API about the updated cart and log the event
        try:
            # Log event
            log_event(f"track {track_id}: added {quantity} × {name}")
            # Push session update with current cart state
            user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
            push_session_update(track_id, cart_items[track_id], status="processing", user_name=user_name)
        except Exception:
            pass
    except Exception as e:
        print(f"[cart] Failed to queue item for track {track_id}: {e}")

def _get_user_id_for_track(track_id: int) -> str | None:
    """
    Extract user_id previously linked via QR. Returns None if not linked.
    """
    if track_id in identity_map:
        return identity_map[track_id][0]  # (user_id, user_name)
    return None

def _flush_invoice_for_track(track_id: int):
    """
    Build and POST InvoiceCreate for this track if possible.
    Clears the cart on success (or leaves it intact on failure).
    """
    user_id = _get_user_id_for_track(track_id)
    items = cart_items.get(track_id, [])

    if not user_id:
        print(f"[invoice] track {track_id}: no user_id bound; skipping invoice.")
        # If the user ID is unknown, mark the session unpaid and notify API
        try:
            log_event(f"track {track_id}: left without user ID; invoice skipped")
            user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
            push_session_update(track_id, cart_items.get(track_id, []), status="unpaid", user_name=user_name)
        except Exception:
            pass
        return

    if not items:
        print(f"[invoice] track {track_id}: no items; nothing to invoice.")
        # Clear the cart and mark unpaid
        try:
            log_event(f"track {track_id}: no items to invoice")
            user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
            push_session_update(track_id, [], status="unpaid", user_name=user_name)
        except Exception:
            pass
        return

    # Build pydantic model then POST as JSON. Use a background thread to avoid
    # blocking the main loop while waiting for the HTTP response.
    def _post_invoice(payload, track_id=track_id):
        try:
            resp = requests.post(INVOICE_API_URL, json=_to_dict(payload))
            if 200 <= resp.status_code < 300:
                print(f"[invoice] track {track_id}: SUCCESS {resp.status_code}")
                print(_to_dict(payload))
                # Successful invoice: mark session paid and clear cart
                try:
                    log_event(f"track {track_id}: invoice created (paid)")
                    user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
                    push_session_update(track_id, [], status="paid", user_name=user_name)
                except Exception:
                    pass
                cart_items.pop(track_id, None)
            else:
                print(f"[invoice] track {track_id}: FAILED {resp.status_code} - {resp.text}")
                # Failure: mark session unpaid
                try:
                    log_event(f"track {track_id}: invoice creation failed")
                    user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
                    push_session_update(track_id, cart_items.get(track_id, []), status="unpaid", user_name=user_name)
                except Exception:
                    pass
        except Exception as e:
            print(f"[invoice] track {track_id}: ERROR posting invoice: {e}")
            try:
                log_event(f"track {track_id}: invoice creation error")
                user_name = identity_map.get(track_id, (None, None))[1] if track_id in identity_map else None
                push_session_update(track_id, cart_items.get(track_id, []), status="unpaid", user_name=user_name)
            except Exception:
                pass

    try:
        payload = InvoiceCreate(user_id=user_id, items=items)
        print(_to_dict(payload))
        threading.Thread(target=_post_invoice, args=(payload,track_id), daemon=True).start()
    except Exception as e:
        print(f"[invoice] track {track_id}: ERROR preparing invoice: {e}")

def on_person_left(track_id: int):
    """
    Called when a track disappears from the frame.
    """
    print(f"[leave] track {track_id} left the frame; attempting to flush invoice.")
    _flush_invoice_for_track(track_id)

    # Clean up identity map and last_zone to avoid growth
    identity_map.pop(track_id, None)
    last_zone.pop(track_id, None)

def point_in_rect_with_margin(pt, rect, margin=0):
    x, y = pt
    x1, y1, x2, y2 = rect
    return (x1 - margin) <= x <= (x2 + margin) and (y1 - margin) <= y <= (y2 + margin)

def rect_center(rect):
    x1, y1, x2, y2 = rect
    return ((x1 + x2) // 2, (y1 + y2) // 2)

def choose_zone_for_point(pt):
    candidates = []
    for name, rect in TABLES.items():
        if point_in_rect_with_margin(pt, rect, NEAR_MARGIN_PX):
            cx, cy = rect_center(rect)
            dist2 = (pt[0] - cx) ** 2 + (pt[1] - cy) ** 2
            candidates.append((dist2, name))
    if not candidates:
        return None
    candidates.sort(key=lambda t: t[0])
    return candidates[0][1]

# ---- OpenCV QR helpers (version-safe)
def decode_multi(detector, frame):
    try:
        out = detector.detectAndDecodeMulti(frame)
    except cv2.error:
        return False, [], None
    
    if isinstance(out, tuple):
        if len(out) == 3:
            decoded_info, points, _ = out
            ok = points is not None and len(decoded_info) > 0
            return ok, decoded_info, points
        elif len(out) == 4:
            retval, decoded_info, points, _ = out
            ok = bool(retval) and points is not None and len(decoded_info) > 0
            return ok, decoded_info, points
    return False, [], None

def decode_single(detector, frame):
    try:
        out = detector.detectAndDecode(frame)
    except cv2.error:
        return "", None

    if isinstance(out, tuple):
        if len(out) == 3:
            text, points, _ = out
            return text, points
        elif len(out) == 4:
            retval, text, points, _ = out
            return text, points
    return str(out) if out is not None else "", None

clicked_points_qr = []            # show clicks on QR window
selected_track_id = [None]        
last_zone = defaultdict(lambda: None)
identity_map = {}                 # track_id -> (user_id, user_name)
TableALatestID = ""
TableBLatestID = ""
cart_items = defaultdict(list) 
_active_ids_prev = set()

# Tracks whose center falls within QR_UPDATE_ZONE on the current frame. Any QR
# detection will update identities for these tracks automatically.
tracks_in_qr_zone: set[int] = set()

# mouse: QR window
def mouse_qr(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN:
        print(f"[QR window] Clicked at: x={x}, y={y}")
        clicked_points_qr.append((x, y))

# motion window select nearest track under click
def mouse_motion_factory(current_tracks_ref):
    # current_tracks_ref(): returns list of (track_id, cx, cy, bbox)
    def cb(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            tracks = current_tracks_ref()
            if not tracks:
                print("[motion] No tracks to select.")
                return
            # choose nearest center
            best = None
            best_d2 = 1e18
            for tid, cx, cy, bbox in tracks:
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if d2 < best_d2:
                    best_d2 = d2
                    best = tid
            selected_track_id[0] = int(best)
            print(f"[motion] Selected track ID: {selected_track_id[0]}")
    return cb

def main():

    # prepare QR camera (1)
    cap_qr = cv2.VideoCapture(QR_CAM_INDEX, cv2.CAP_DSHOW)
    if not cap_qr.isOpened():
        raise RuntimeError("Could not open QR camera (index 1).")

    # Create windows for displaying motion tracking and QR scanning
    table_a_win = "Table A Snapshot"
    table_b_win = "Table B Snapshot"
    cv2.namedWindow(table_a_win)
    cv2.namedWindow(table_b_win)

    # prepare windows
    motion_win = "Proximity Tracker (click to select track, q to quit)"
    qr_win = "QR Scanner (click shows x,y)"
    cv2.namedWindow(motion_win)
    cv2.namedWindow(qr_win)
    cv2.setMouseCallback(qr_win, mouse_qr)

    # the motion window needs current track data for selection:
    current_tracks = []  # list of (track_id, cx, cy, (x1,y1,x2,y2))
    def get_current_tracks():
        return list(current_tracks)
    
    cv2.setMouseCallback(motion_win, mouse_motion_factory(get_current_tracks))

    # Start snapshot threads for table A and B. Each thread fetches a snapshot
    # periodically and annotates it using the item detector. This reduces GPU
    # load compared to running detection every frame. Threads run until
    # stop_snapshot_event is set.
    def _snapshot_worker(table_name: str, interval: float = 5.0):

        while not stop_snapshot_event.is_set():
            img = fetch_snapshot_for_table(table_name)
            if img is not None:
                res = item_model(
                    img,
                    conf=0.30,
                    iou=0.45,
                    agnostic_nms=True,
                    verbose=False
                )
                if res and res[0].boxes is not None:
                    last_snapshot_annotated[table_name] = res[0].plot(line_width=2, labels=True, conf=True)
                else:
                    last_snapshot_annotated[table_name] = img
            time.sleep(interval)

    # Launch snapshot threads for each table
    for tn in ["Table A", "Table B"]:
        threading.Thread(target=_snapshot_worker, args=(tn,), daemon=True).start()

    # YOLO model & stream from motion cam (0)
    model = YOLO(MODEL_WEIGHTS)
    model.to("cpu")
    results_stream = model.track(
        source=MOTION_CAM_INDEX,
        stream=True,
        persist=True,
        classes=[PERSON_CLASS_ID],
        tracker="bytetrack.yaml",
        verbose=False,
        imgsz=640,      # add this
        vid_stride=2 
    )

    detector = cv2.QRCodeDetector()

    print("Running. In the motion window, click a person to select their track.\n"
          "In the QR window, click to see (x,y). Press 'q' in any window to quit.")

    global _active_ids_prev
    for result in results_stream:
        # motion (cam 0) 
        frame_motion = result.orig_img 
        h0, w0 = frame_motion.shape[:2]
        current_tracks.clear()

        # draw zones
        for name, (x1, y1, x2, y2) in TABLES.items():
            cv2.rectangle(frame_motion, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.rectangle(frame_motion, (x1 - NEAR_MARGIN_PX, y1 - NEAR_MARGIN_PX),
                          (x2 + NEAR_MARGIN_PX, y2 + NEAR_MARGIN_PX), (0, 255, 0), 1)
            cv2.putText(frame_motion, name, (x1, max(20, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)

        boxes = result.boxes
        if boxes is not None and boxes.id is not None:
            ids = boxes.id.cpu().numpy().astype(int)
            xyxy = boxes.xyxy.cpu().numpy().astype(int)
            cls = boxes.cls.cpu().numpy().astype(int)

            for i, box in enumerate(xyxy):
                if cls[i] != PERSON_CLASS_ID:
                    continue
                track_id = int(ids[i])
                x1, y1, x2, y2 = box
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                current_tracks.append((track_id, cx, cy, (x1, y1, x2, y2)))

                zone = choose_zone_for_point((cx, cy))
                if zone != last_zone[track_id]:
                    on_zone_change(track_id, zone, last_zone[track_id])
                    last_zone[track_id] = zone

                # Update QR zone membership: if the track center falls within
                # QR_UPDATE_ZONE, add to tracks_in_qr_zone; else remove.
                x1_q, y1_q, x2_q, y2_q = QR_UPDATE_ZONE
                if x1_q <= cx <= x2_q and y1_q <= cy <= y2_q:
                    tracks_in_qr_zone.add(track_id)
                else:
                    tracks_in_qr_zone.discard(track_id)

                # draw bbox
                color = (255, 255, 255)
                if selected_track_id[0] == track_id:
                    color = (0, 255, 255) 
                cv2.rectangle(frame_motion, (x1, y1), (x2, y2), color, 2)

                # label show linked identity
                if track_id in identity_map:
                    user_id, user_name = identity_map[track_id]
                    id_text = f"{user_name} ({user_id})"
                else:
                    id_text = f"ID {track_id}"
                label = f"{id_text} | {zone or 'No table'}"
                cv2.putText(frame_motion, label, (x1, max(20, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2, cv2.LINE_AA)

                cv2.circle(frame_motion, (cx, cy), 4, color, -1)

        # Update active ID tracking
        current_ids = {tid for (tid, cx, cy, box) in current_tracks}
        left_ids = _active_ids_prev - current_ids
        for tid in left_ids:
            on_person_left(tid)
        _active_ids_prev = current_ids

        # QR (cam 1)
        ok_qr, frame_qr = cap_qr.read()
        if not ok_qr or frame_qr is None or frame_qr.size == 0:
            frame_qr = np.zeros((360, 480, 3), dtype=np.uint8)
            cv2.putText(frame_qr, "QR cam read failed", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # decode multi QR first
        success, decoded_info, pts_list = decode_multi(detector, frame_qr)
        if success:
            for text, pts in zip(decoded_info, pts_list):
                if pts is None:
                    continue
                pts = pts.astype(int).reshape(-1, 2)
                for i in range(len(pts)):
                    cv2.line(frame_qr, tuple(pts[i]), tuple(pts[(i+1) % len(pts)]), (0, 255, 0), 2)

                if text:
                    x, y = pts[0]
                    cv2.putText(frame_qr, text, (x, max(y - 10, 0)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    payload = text.strip()
                    user_id, user_name = payload, payload
                    # Update identity for manually selected track
                    if selected_track_id[0] is not None:
                        identity_map[selected_track_id[0]] = (user_id, user_name)
                        on_identity_linked(selected_track_id[0], user_id, user_name)
                    # Update identity for any track currently in the QR update zone
                    if tracks_in_qr_zone:
                        for tid in list(tracks_in_qr_zone):
                            identity_map[tid] = (user_id, user_name)
                            on_identity_linked(tid, user_id, user_name)
        else:
            text, pts = decode_single(detector, frame_qr)
            if pts is not None and text:
                pts = pts.astype(int).reshape(-1, 2)
                for i in range(len(pts)):
                    cv2.line(frame_qr, tuple(pts[i]), tuple(pts[(i+1) % len(pts)]), (0, 255, 0), 2)
                x, y = pts[0]
                cv2.putText(frame_qr, text, (x, max(y - 10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                payload = text.strip()
                user_id, user_name = payload, payload
                # Update identity for manually selected track
                if selected_track_id[0] is not None:
                    identity_map[selected_track_id[0]] = (user_id, user_name)
                    on_identity_linked(selected_track_id[0], user_id, user_name)
                # Update identity for any track in the QR update zone
                if tracks_in_qr_zone:
                    for tid in list(tracks_in_qr_zone):
                        identity_map[tid] = (user_id, user_name)
                        on_identity_linked(tid, user_id, user_name)

        # draw markers
        for (qx, qy) in clicked_points_qr:
            cv2.circle(frame_qr, (qx, qy), 4, (0, 0, 255), -1)
            cv2.putText(frame_qr, f"({qx},{qy})", (qx + 5, qy - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            
        # Display the latest annotated snapshot for Table A
        annot_a = last_snapshot_annotated.get("Table A")
        if annot_a is not None:
            cv2.imshow(table_a_win, annot_a)
        else:
            placeholder_a = np.zeros((360, 480, 3), dtype=np.uint8)
            cv2.putText(placeholder_a, "Snapshot A unavailable", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.imshow(table_a_win, placeholder_a)

        # Display the latest annotated snapshot for Table B
        annot_b = last_snapshot_annotated.get("Table B")
        if annot_b is not None:
            cv2.imshow(table_b_win, annot_b)
        else:
            placeholder_b = np.zeros((360, 480, 3), dtype=np.uint8)
            cv2.putText(placeholder_b, "Snapshot B unavailable", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.imshow(table_b_win, placeholder_b)

        cv2.imshow(motion_win, frame_motion)
        cv2.imshow(qr_win, frame_qr)

        if (cv2.waitKey(1) & 0xFF) == ord('q'):
            break

    cap_qr.release()
    # Release snapshot threads (stop event) and windows
    stop_snapshot_event.set()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()