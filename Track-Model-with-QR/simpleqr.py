# simpleqr_preview_threaded.py
import os, cv2, time, threading

# Make FFmpeg RTSP more robust/low-latency (set BEFORE VideoCapture)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
    "rtsp_transport;tcp|stimeout;5000000|buffer_size;102400|max_delay;0|reorder_queue_size;0"
)

URL = "rtsp://192.168.1.7:8554/unicast"  # <- your Pi

def open_cap():
    cap = cv2.VideoCapture(URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
    return cap

cap = open_cap()
det = cv2.QRCodeDetector()
cv2.namedWindow("RTSP Preview (q to quit)", cv2.WINDOW_NORMAL)

latest = None
stop = False

def reader():
    global cap, latest, stop
    failures = 0
    while not stop:
        ok, frame = cap.read()
        if ok and frame is not None:
            latest = frame  # always keep only the newest frame
            failures = 0
        else:
            failures += 1
            time.sleep(0.01)
            if failures >= 100:        # reconnect if the stream stalls
                try: cap.release()
                except: pass
                cap = open_cap()
                failures = 0

t = threading.Thread(target=reader, daemon=True)
t.start()

try:
    last_print = ""
    while True:
        if latest is None:
            # keep window responsive during startup/hiccups
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            time.sleep(0.01)
            continue

        frame = latest

        # --- QR decode (no drawings, just print) ---
        # grayscale is slightly faster/more stable for the detector
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            found, infos, _, _ = det.detectAndDecodeMulti(gray)
            if found:
                for text in infos:
                    if text and text != last_print:
                        print(text, flush=True)
                        last_print = text
            else:
                text, _, _ = det.detectAndDecode(gray)
                if text and text != last_print:
                    print(text, flush=True)
                    last_print = text
        except Exception:
            pass  # ignore decode hiccups

        # --- Preview ---
        #cv2.imshow("RTSP Preview (q to quit)", frame)
        #if cv2.waitKey(1) & 0xFF == ord('q'):
        #    break
except KeyboardInterrupt:
    pass
finally:
    stop = True
    t.join(timeout=1.0)
    cap.release()
    cv2.destroyAllWindows()
