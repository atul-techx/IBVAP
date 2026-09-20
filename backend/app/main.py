"""
IBVAP - Intelligent Border Video Analytics Platform
Step 5: FastAPI REST Endpoints & Real-Time WebSocket Streaming Server

Endpoints:
- GET /api/events         : List security events with query filtering
- GET /api/events/{id}    : Get single security event details
- GET /api/cameras        : Get registered surveillance cameras & status
- GET /api/snapshots/{id} : Stream snapshot JPEG image
- GET /api/stats          : Get summary metric counts for dashboard tiles
- POST /api/pipeline/run  : Trigger video analytics test pipeline run
- WS  /ws/events          : Real-time WebSocket event streaming
- POST /api/internal/broadcast : Internal webhook for CLI detection pipelines
"""

import asyncio
import base64
import os
import subprocess
import sys
import tempfile
import threading
import time
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import cv2
import numpy as np


def get_live_frame_path(camera_id: str) -> Path:
    """Fast OS temp directory path to bypass OneDrive sync locks and latency."""
    temp_dir = Path(tempfile.gettempdir()) / "ibvap_live"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir / f"live_frame_{camera_id}.jpg"
from pydantic import BaseModel
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse

try:
    from backend.app.stream_hub import get_frame_hub
except ImportError:
    try:
        from stream_hub import get_frame_hub
    except ImportError:
        get_frame_hub = lambda: None

try:
    from backend.app.events import (
        compute_event_stats,
        fetch_all_cameras,
        fetch_event_by_id,
        fetch_events_filtered,
        get_snapshots_dir,
        heartbeat_camera,
        init_db,
        log_auth_event,
        purge_expired_events,
        register_event_listener,
        sign_event_block,
        start_event_retention_daemon,
        verify_chain_integrity,
        get_escalation_config,
        update_escalation_config,
    )
    from backend.app.auth import (
        authenticate_user,
        create_access_token,
        get_current_user,
        get_current_user_flexible,
        is_auth_disabled,
        require_admin,
        update_user_last_login,
        verify_token_str,
    )
    from backend.app.admin_management import (
        add_or_update_authorized_vehicle,
        add_or_update_watchlist_person,
        bulk_import_authorized_vehicles,
        bulk_import_watchlist_personnel,
        delete_authorized_vehicle,
        delete_watchlist_person,
        generate_sample_template,
        get_all_authorized_vehicles,
        get_all_watchlist_personnel,
        get_watchlist_dir,
        get_watchlist_person,
        init_admin_tables,
        parse_tabular_file,
        sync_cloud_watchlist_to_disk,
    )
    from backend.app.cloud_storage import (
        upload_watchlist_image,
        is_cloud_storage_configured,
    )
    from backend.app.replay_service import extract_incident_replay_clip, extract_event_target_crop
except ImportError:
    from events import (
        compute_event_stats,
        fetch_all_cameras,
        fetch_event_by_id,
        fetch_events_filtered,
        get_snapshots_dir,
        heartbeat_camera,
        init_db,
        log_auth_event,
        purge_expired_events,
        register_event_listener,
        sign_event_block,
        start_event_retention_daemon,
        verify_chain_integrity,
        get_escalation_config,
        update_escalation_config,
    )
    from auth import (
        authenticate_user,
        create_access_token,
        get_current_user,
        get_current_user_flexible,
        is_auth_disabled,
        require_admin,
        update_user_last_login,
        verify_token_str,
    )
    from admin_management import (
        add_or_update_authorized_vehicle,
        add_or_update_watchlist_person,
        bulk_import_authorized_vehicles,
        bulk_import_watchlist_personnel,
        delete_authorized_vehicle,
        delete_watchlist_person,
        generate_sample_template,
        get_all_authorized_vehicles,
        get_all_watchlist_personnel,
        get_watchlist_dir,
        get_watchlist_person,
        init_admin_tables,
        parse_tabular_file,
        sync_cloud_watchlist_to_disk,
    )
    try:
        from cloud_storage import (
            upload_watchlist_image,
            is_cloud_storage_configured,
        )
    except ImportError:
        upload_watchlist_image = lambda *a, **k: None
        is_cloud_storage_configured = lambda: False
    try:
        from replay_service import extract_incident_replay_clip, extract_event_target_crop
    except ImportError:
        extract_incident_replay_clip = lambda *a, **k: (False, {"error": "unavailable"}, None)
        extract_event_target_crop = lambda *a, **k: (False, None, {"error": "unavailable"})


def get_active_face_recognizer(reload: bool = False):
    """Retrieve shared WatchlistFaceRecognizer from lightweight face_engine."""
    try:
        from backend.app.face_engine import get_watchlist_recognizer
        return get_watchlist_recognizer(reload=reload)
    except ImportError:
        try:
            from face_engine import get_watchlist_recognizer
            return get_watchlist_recognizer(reload=reload)
        except Exception:
            return None


_webcam_plate_voter = None

def get_webcam_plate_voter():
    global _webcam_plate_voter
    if _webcam_plate_voter is None:
        try:
            from backend.app.detection_tracking import MultiFramePlateVoter
        except ImportError:
            try:
                from detection_tracking import MultiFramePlateVoter
            except ImportError:
                return None
        _webcam_plate_voter = MultiFramePlateVoter(history_len=12, min_consensus_votes=2)
    return _webcam_plate_voter

def run_vehicle_anpr(frame: np.ndarray, bbox: tuple, tracker_id: Optional[int] = None):
    """Run ANPR plate reading with multi-frame consensus & Indian format validation for client webcam frames."""
    try:
        from backend.app.detection_tracking import (
            detect_and_read_license_plate,
            get_or_create_easyocr_reader,
            validate_indian_plate_grammar,
        )
    except ImportError:
        try:
            from detection_tracking import (
                detect_and_read_license_plate,
                get_or_create_easyocr_reader,
                validate_indian_plate_grammar,
            )
        except ImportError:
            return None, None, 0.0, False, None
    try:
        from backend.app.admin_management import check_authorized_vehicle
    except ImportError:
        try:
            from admin_management import check_authorized_vehicle
        except ImportError:
            check_authorized_vehicle = lambda plate, db_path=None: None

    reader = get_or_create_easyocr_reader()
    p_bbox, p_text, p_conf = detect_and_read_license_plate(frame, bbox, reader, tracker_id=tracker_id)
    is_auth = False
    owner = None

    # Temporal multi-frame voting consensus across frames
    voter = get_webcam_plate_voter()
    t_id = tracker_id if tracker_id is not None else 1
    if voter and p_text:
        auth_rec = check_authorized_vehicle(p_text)
        voted = voter.add_observation(
            tracker_id=t_id,
            plate_text=p_text,
            confidence=p_conf,
            plate_bbox=p_bbox,
            frame_idx=0,
            is_auth=(auth_rec is not None),
        )
        p_bbox = voted.get("plate_bbox") or p_bbox
        p_text = voted.get("plate_number") or p_text
        p_conf = voted.get("confidence", p_conf)

    if p_text:
        auth_rec = check_authorized_vehicle(p_text)
        if auth_rec:
            is_auth = True
            owner = auth_rec.get("owner_name")
            p_text = auth_rec.get("plate_number", p_text)
    return p_bbox, p_text, p_conf, is_auth, owner


class LoginRequest(BaseModel):
    username: str
    password: str


class VehicleCreateRequest(BaseModel):
    plate_number: str
    owner_name: str
    vehicle_type: str = "Patrol Vehicle"
    purpose: str = "Official Duty"
    expiry_date: Optional[str] = None
    notes: Optional[str] = None


class EscalationConfigRequest(BaseModel):
    siren_webhook_url: Optional[str] = None
    sms_webhook_url: Optional[str] = None
    min_severity: Optional[str] = None
    enabled: Optional[bool] = None


app = FastAPI(
    title="IBVAP - Intelligent Border Video Analytics Platform",
    description="Smart India Hackathon 2026 - Video Analytics API & Real-Time Event Engine",
    version="1.0.0",
)

def sanitize_stream_source(source: Any) -> str:
    """Mask credentials in RTSP / HTTP camera URLs (e.g. rtsp://user:pass@host -> rtsp://user:***@host)."""
    if not isinstance(source, str):
        return str(source) if source is not None else ""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", source)


# Configure Secure CORS policy
raw_cors = os.environ.get("ALLOWED_ORIGINS")
if raw_cors:
    cors_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
else:
    cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.onrender\.com|.*\.up\.railway\.app|.*\.vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# Real-Time WebSocket Connection Manager
# =====================================================================
class ConnectionManager:
    """Manages active WebSocket client connections, keepalive heartbeats, and broadcasts events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[+] WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[-] WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict[str, Any]):
        """Broadcast JSON payload to all active WebSocket clients."""
        if not self.active_connections:
            return

        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)

        for dead_conn in disconnected:
            self.disconnect(dead_conn)

    async def start_heartbeat(self):
        """Send periodic keepalive heartbeat every 15s to keep connections permanently active and detect dead sockets."""
        while True:
            try:
                await asyncio.sleep(15)
                if self.active_connections:
                    await self.broadcast_json({
                        "type": "heartbeat",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    def trigger_in_process_broadcast(self, event_data: dict[str, Any]):
        """Callback for in-process sync event logging."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.broadcast_json(event_data))
        except Exception:
            pass


ws_manager = ConnectionManager()
register_event_listener(ws_manager.trigger_in_process_broadcast)


def is_cloud_environment() -> bool:
    """Detect if running inside constrained cloud container (Railway, Render, Fly) or low-memory mode."""
    return bool(
        os.environ.get("RAILWAY_ENVIRONMENT")
        or os.environ.get("RENDER")
        or os.environ.get("FLY_ALLOC_ID")
        or os.environ.get("DYNO")
        or os.environ.get("LOW_MEMORY_MODE", "0") == "1"
    )


@app.on_event("startup")
async def on_startup():
    """Startup lifecycle: initialize database tables, sync Cloudinary CDN watchlist, and start background workers."""
    print("[*] IBVAP FastAPI Backend booting up...")

    # 1. Initialize SQLite / PostgreSQL Database & Admin Tables
    try:
        init_db()
        print("[+] Primary events database initialized.")
    except Exception as e:
        print(f"[!] Warning during init_db: {e}")

    try:
        init_admin_tables()
        print("[+] Admin management tables initialized.")
    except Exception as e:
        print(f"[!] Warning during init_admin_tables: {e}")

    # 2. Sync Cloudinary CDN Watchlist to local container disk
    try:
        synced = sync_cloud_watchlist_to_disk()
        print(f"[+] Cloud watchlist sync completed: {synced} images synced.")
    except Exception as e:
        print(f"[!] Cloud watchlist sync notice: {e}")

    # 3. Only pre-load face recognizer if NOT in cloud/low-memory mode (saves ~80MB)
    if not is_cloud_environment():
        try:
            rec = get_active_face_recognizer(reload=True)
            if rec and hasattr(rec, "watchlist_embeddings"):
                print(f"[+] Face Recognizer warmed up: {len(rec.watchlist_embeddings)} identities active.")
        except Exception as e:
            print(f"[!] Face recognizer warmup notice: {e}")

    # 4. Start WebSocket Heartbeat task (single instance)
    try:
        asyncio.create_task(ws_manager.start_heartbeat())
        print("[+] WebSocket keepalive heartbeat task started.")
    except Exception as e:
        print(f"[!] WebSocket heartbeat start notice: {e}")

    # 5. Start event retention background cleaner
    try:
        start_event_retention_daemon(interval_seconds=600, max_age_minutes=60)
        print("[+] Event retention daemon started.")
    except Exception as e:
        print(f"[!] Event retention daemon start notice: {e}")

    # 6. Camera stream initialization:
    # In cloud environments (Railway/Render), DO NOT auto-launch heavy inference on boot!
    # This prevents the container from exceeding 512MB RAM and dying with OOM.
    # Streams start on-demand when an operator connects to the live feed.
    if not is_cloud_environment():
        try:
            ensure_default_stream_running(camera_id="CAM_01")
            print("[+] IBVAP Surveillance Pipeline auto-started for CAM_01 (Loop mode).")
        except Exception as e:
            print(f"[!] Warning: Could not auto-start camera stream: {e}")
    else:
        print("[+] Cloud/Low-Memory Mode: Streaming inference will start on-demand when feeds are viewed (RAM protected <= 250MB).")

    import gc
    gc.collect()

# Active background analytics stream processes: camera_id -> subprocess.Popen
ACTIVE_STREAM_PROCESSES: dict[str, subprocess.Popen] = {}
STREAM_PROCESSES_LOCK = threading.Lock()


def kill_all_camera_processes():
    """Forcefully terminate ALL active camera stream processes to guarantee minimal RAM footprint."""
    target_pids = set()

    with STREAM_PROCESSES_LOCK:
        for cam_id, proc in list(ACTIVE_STREAM_PROCESSES.items()):
            if proc:
                target_pids.add(proc.pid)
                try:
                    proc.terminate()
                except Exception:
                    pass
        ACTIVE_STREAM_PROCESSES.clear()

    try:
        import psutil
        current_pid = os.getpid()
        for p in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if p.info['pid'] == current_pid:
                    continue
                cmdline = p.info.get('cmdline') or []
                cmd_str = " ".join(cmdline)
                if "detection_tracking.py" in cmd_str:
                    target_pids.add(p.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as e:
        print(f"[!] Warning inspecting processes for kill_all: {e}")

    for pid in target_pids:
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, timeout=5)
            else:
                import psutil
                p = psutil.Process(pid)
                p.kill()
        except Exception:
            pass


def kill_camera_processes(camera_id: str):
    """Forcefully and reliably terminate all active & orphaned processes for a camera."""
    target_pids = set()

    with STREAM_PROCESSES_LOCK:
        proc = ACTIVE_STREAM_PROCESSES.pop(camera_id, None)
        if proc:
            target_pids.add(proc.pid)
            try:
                proc.terminate()
            except Exception:
                pass

    try:
        import psutil
        current_pid = os.getpid()
        for p in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if p.info['pid'] == current_pid:
                    continue
                cmdline = p.info.get('cmdline') or []
                cmd_str = " ".join(cmdline)
                if "detection_tracking.py" in cmd_str and f"--camera-id {camera_id}" in cmd_str:
                    target_pids.add(p.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as e:
        print(f"[!] Warning inspecting processes for kill: {e}")

    for pid in target_pids:
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, timeout=5)
            else:
                import psutil
                p = psutil.Process(pid)
                p.kill()
        except Exception:
            pass


def launch_analytics_stream(
    camera_id: str = "CAM_01",
    source_type: str = "test_video",
    source: str = "sample.mp4",
    imgsz: int = 480,
    show_zone: bool = True,
):
    """Launch or restart background analytics process for a camera with seamless loop support."""
    app_dir = Path(__file__).resolve().parent
    script_path = app_dir / "detection_tracking.py"
    test_videos_dir = app_dir.parent / "test_videos"

    # Cleanly terminate processes: In cloud/low-memory mode, terminate ALL other streams to enforce strictly ONE stream
    if is_cloud_environment():
        kill_all_camera_processes()
        imgsz = min(imgsz, 320)
    else:
        kill_camera_processes(camera_id)

    cmd = [
        sys.executable,
        str(script_path),
        "--camera-id", camera_id,
        "--imgsz", str(imgsz),
        "--no-display",
    ]

    if not show_zone:
        cmd.append("--no-zone")

    is_network = (
        source_type == "rtsp"
        or (isinstance(source, str) and (
            source.startswith("rtsp://")
            or source.startswith("http://")
            or source.startswith("https://")
        ))
    )

    if is_network:
        cmd.extend(["--input", str(source)])
    elif source_type == "webcam" or source == "0":
        # Fast non-blocking check: Linux cloud containers do not have /dev/video0
        if sys.platform != "win32":
            can_open_webcam = os.path.exists("/dev/video0")
        else:
            try:
                test_cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
                can_open_webcam = test_cap.isOpened()
                test_cap.release()
            except Exception:
                can_open_webcam = False

        if can_open_webcam:
            cmd.extend(["--input", "0", "--no-weather-mode"])
        else:
            sample_file = test_videos_dir / "sample.mp4"
            if sample_file.exists():
                cmd.extend(["--input", str(sample_file), "--loop"])
            else:
                cmd.extend(["--input", "0", "--no-weather-mode"])
    else:
        video_file = None
        if source:
            candidate = test_videos_dir / source
            if candidate.exists():
                video_file = candidate
            elif Path(source).exists():
                video_file = Path(source)
        if not video_file:
            for candidate_name in ["sample.mp4", "tracking_test.mp4", "real_footage_1.mp4"]:
                c = test_videos_dir / candidate_name
                if c.exists():
                    video_file = c
                    break
        if video_file:
            cmd.extend(["--input", str(video_file), "--loop"])
        else:
            cmd.extend(["--input", "0"])

    sub_env = os.environ.copy()
    sub_env["OMP_NUM_THREADS"] = "1"
    sub_env["OPENBLAS_NUM_THREADS"] = "1"
    sub_env["MKL_NUM_THREADS"] = "1"
    sub_env["PYTHONUNBUFFERED"] = "1"
    if is_cloud_environment():
        sub_env["LOW_MEMORY_MODE"] = "1"
        sub_env["DISABLE_EASYOCR"] = "1"
    print(f"[+] Launching stream process for {camera_id}: {' '.join(cmd)}")

    proc = subprocess.Popen(
        cmd,
        stdout=None,
        stderr=None,
        env=sub_env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    with STREAM_PROCESSES_LOCK:
        ACTIVE_STREAM_PROCESSES[camera_id] = proc
    return proc


DEFAULT_CAMERA_FEEDS = {
    "CAM_01": "0",  # Live Webcam by default for Sector 01
    "CAM_02": "suspicious_behavior_test.mp4",
    "CAM_03": "real_footage_1.mp4",
    "CAM_04": "tracking_test.mp4",
}

MANUALLY_STOPPED_CAMERAS: set[str] = set()


def ensure_default_stream_running(camera_id: str = "CAM_01"):
    """Ensure that a persistent surveillance loop is actively feeding the camera."""
    if camera_id in MANUALLY_STOPPED_CAMERAS:
        return None
    with STREAM_PROCESSES_LOCK:
        proc = ACTIVE_STREAM_PROCESSES.get(camera_id)
        if proc and proc.poll() is None:
            return proc
    default_source = DEFAULT_CAMERA_FEEDS.get(camera_id, "0" if camera_id == "CAM_01" else "sample.mp4")
    source_type = "webcam" if default_source == "0" else "test_video"
    imgsz = 320 if is_cloud_environment() else (384 if source_type == "webcam" else 480)
    return launch_analytics_stream(camera_id=camera_id, source_type=source_type, source=default_source, imgsz=imgsz)


@app.on_event("shutdown")
def shutdown_event():
    """Cleanly terminate any active video inference background processes on shutdown."""
    with STREAM_PROCESSES_LOCK:
        for cam_id, proc in list(ACTIVE_STREAM_PROCESSES.items()):
            if proc and proc.poll() is None:
                try:
                    proc.terminate()
                except Exception:
                    pass


# =====================================================================
# REST Endpoints
# =====================================================================
@app.get("/api")
def api_root():
    return {
        "project": "IBVAP - Intelligent Border Video Analytics Platform",
        "status": "online",
        "phase": "Step 5 - React Command Center Dashboard",
        "auth_enabled": not is_auth_disabled(),
        "docs_url": "/docs",
        "ws_events_url": "/ws/events",
    }


# =====================================================================
# Authentication Endpoints
# =====================================================================
@app.get("/api/auth/config")
def get_auth_config():
    """Returns system authentication configuration status (e.g. whether bypass is enabled)."""
    return {
        "auth_disabled": is_auth_disabled(),
        "status": "active",
    }


@app.get("/api/config/escalation")
def get_escalation_settings(current_user: dict = Depends(get_current_user_flexible)):
    """Retrieve current siren and SMS escalation channel configuration (Item 25)."""
    return get_escalation_config()


@app.post("/api/config/escalation")
def update_escalation_settings(
    req: EscalationConfigRequest,
    current_user: dict = Depends(require_admin),
):
    """Update siren and SMS escalation channel endpoints and threshold (Item 25 - Admin only)."""
    updates = req.dict(exclude_unset=True)
    updated = update_escalation_config(updates)
    return {"status": "success", "config": updated}



@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    """
    Validate user credentials against SQLite and return a signed JWT token.
    Logs every authentication event (success and failure) to the tamper-evident audit trail.
    """
    username = req.username.strip()
    client_ip = request.client.host if request.client else "127.0.0.1"

    user = authenticate_user(username=username, password=req.password)
    if not user:
        # Record tamper-evident failed authentication event
        log_auth_event(
            username=username or "unknown",
            role="unknown",
            success=False,
            reason="Invalid username or password",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password. Please check your credentials.",
        )

    # Update last login timestamp
    update_user_last_login(user["username"])

    # Record tamper-evident successful authentication event
    log_auth_event(
        username=user["username"],
        role=user["role"],
        success=True,
        reason="Successful password authentication",
        ip_address=client_ip,
    )

    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "name": user.get("full_name", user["username"]),
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name", user["username"]),
        },
    }


@app.get("/api/auth/me")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Return the profile and role of the currently authenticated user."""
    return {
        "username": current_user["username"],
        "role": current_user.get("role", "operator"),
        "full_name": current_user.get("full_name", current_user["username"]),
        "auth_disabled": current_user.get("auth_disabled", False),
    }


# =====================================================================
# Admin Command Panel Endpoints (Requires 'admin' Role)
# =====================================================================
@app.get("/api/admin/watchlist")
def get_admin_watchlist(current_user: dict = Depends(require_admin)):
    """Retrieve all authorized personnel watchlist profiles (Admin only)."""
    items = get_all_watchlist_personnel()
    return {
        "count": len(items),
        "watchlist": items,
    }


@app.post("/api/admin/watchlist")
async def add_admin_watchlist_person(
    name: str = Form(..., description="Full Name of the authorized person"),
    role: str = Form("SSB Personnel", description="Role/Category (e.g. SSB Personnel, Contractor, Visitor)"),
    expiry_date: Optional[str] = Form(None, description="Optional expiry date YYYY-MM-DD"),
    notes: Optional[str] = Form(None, description="Operational notes"),
    photo: Optional[UploadFile] = File(None, description="Facial portrait reference image"),
    current_user: dict = Depends(require_admin),
):
    """Add or update an authorized person on the facial recognition watchlist (Admin only)."""
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    watchlist_dir = get_watchlist_dir()
    existing_person = get_watchlist_person(clean_name)
    photo_filename = existing_person["photo_filename"] if existing_person else ""

    if photo and photo.filename:
        ext = Path(photo.filename).suffix.lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image format '{ext}'. Supported formats: .jpg, .jpeg, .png, .webp",
            )

        safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", clean_name.lower())
        saved_filename = f"{safe_stem}{ext}"
        target_path = watchlist_dir / saved_filename

        contents = await photo.read()
        if len(contents) < 500:
            raise HTTPException(status_code=400, detail="Uploaded photo is too small or corrupted.")

        with open(target_path, "wb") as f:
            f.write(contents)
        photo_filename = saved_filename

        # Upload immediately to Cloudinary CDN for persistent cross-deployment availability
        cloud_image_url = None
        if is_cloud_storage_configured():
            try:
                cloud_image_url = upload_watchlist_image(contents, public_id=safe_stem)
            except Exception as e:
                print(f"[!] Warning uploading photo to Cloudinary CDN: {e}")

    if not photo_filename:
        safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", clean_name.lower())
        for ext in [".png", ".jpg", ".jpeg"]:
            if (watchlist_dir / f"{safe_stem}{ext}").exists():
                photo_filename = f"{safe_stem}{ext}"
                break

    if not photo_filename:
        raise HTTPException(status_code=400, detail="A photo upload is required for new watchlist profiles.")

    person = add_or_update_watchlist_person(
        name=clean_name,
        role=role,
        photo_filename=photo_filename,
        image_url=cloud_image_url if 'cloud_image_url' in locals() and cloud_image_url else (existing_person.get("image_url") if existing_person else None),
        expiry_date=expiry_date,
        notes=notes,
    )

    # Immediately trigger in-memory watchlist embedding reload
    get_active_face_recognizer(reload=True)

    return {
        "status": "success",
        "message": f"Watchlist profile for '{clean_name}' successfully saved & embeddings re-cached.",
        "person": person,
    }


@app.delete("/api/admin/watchlist/{name}")
def delete_admin_watchlist_person(name: str, current_user: dict = Depends(require_admin)):
    """Delete a person from the watchlist and purge photo/embeddings (Admin only)."""
    success = delete_watchlist_person(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Watchlist person '{name}' not found.")

    # Immediately trigger in-memory watchlist embedding reload
    get_active_face_recognizer(reload=True)

    return {
        "status": "success",
        "message": f"Profile '{name}' deleted from watchlist.",
        "name": name,
    }


@app.post("/api/admin/watchlist/rescan")
def rescan_admin_watchlist(current_user: dict = Depends(require_admin)):
    """Re-scan backend/watchlist/ folder and regenerate all embeddings in memory without restart (Admin only)."""
    watchlist_dir = get_watchlist_dir()
    for p in sorted(watchlist_dir.iterdir()):
        if p.suffix.lower() in [".png", ".jpg", ".jpeg"]:
            stem = p.stem.strip()
            display_name = stem.replace("_", " ").title()
            existing = get_watchlist_person(display_name)
            if not existing:
                add_or_update_watchlist_person(
                    name=display_name,
                    role="SSB Personnel",
                    photo_filename=p.name,
                )

    recog = get_active_face_recognizer(reload=True)
    embeddings_count = len(recog.watchlist_embeddings) if recog else 0
    active_identities = list(recog.watchlist_embeddings.keys()) if recog else []

    return {
        "status": "success",
        "message": f"Successfully reloaded watchlist from disk. {embeddings_count} face embedding profile(s) cached in memory.",
        "profiles_loaded": embeddings_count,
        "identities": active_identities,
    }


@app.post("/api/admin/watchlist/bulk-import")
async def bulk_import_watchlist(
    file: UploadFile = File(..., description="CSV or Excel file containing personnel records"),
    current_user: dict = Depends(require_admin),
):
    """Bulk import authorized personnel from CSV or Excel (.xlsx) file (Admin only)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="A valid CSV or Excel file is required.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".tsv", ".xlsx", ".xlsm"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Please upload a CSV (.csv) or Excel (.xlsx) file.",
        )

    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        rows = parse_tabular_file(contents, file.filename)
        if not rows:
            raise HTTPException(status_code=400, detail="No data records found in uploaded file.")

        result = bulk_import_watchlist_personnel(rows)
        get_active_face_recognizer(reload=True)

        return {
            "status": "success",
            "message": f"Bulk import complete: {result['added']} added, {result['updated']} updated out of {result['total_records']} records.",
            **result,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process bulk import: {str(e)}")


@app.get("/api/admin/watchlist/template")
def get_watchlist_template(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    current_user: dict = Depends(require_admin),
):
    """Download sample CSV or Excel template for bulk importing authorized personnel (Admin only)."""
    try:
        data, media_type, filename = generate_sample_template(target="personnel", format_type=format)
        return Response(
            content=data,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")


@app.get("/api/admin/watchlist/photo/{filename}")
def get_watchlist_photo(
    filename: str,
    current_user: dict = Depends(get_current_user_flexible),
):
    """Serve photo thumbnail for admin watchlist management with fallback to Cloudinary CDN or default avatar."""
    clean_filename = Path(filename).name
    photo_path = get_watchlist_dir() / clean_filename

    # If photo missing locally, attempt on-demand recovery from PostgreSQL photo_base64 or Cloudinary CDN
    if not photo_path.exists() and clean_filename not in ("", "none", "default_avatar.png"):
        try:
            cand_name = clean_filename.rsplit(".", 1)[0].replace("_", " ")
            person = get_watchlist_person(cand_name)
            if person:
                if person.get("photo_base64"):
                    with open(photo_path, "wb") as f:
                        f.write(base64.b64decode(person["photo_base64"]))
                elif person.get("image_url"):
                    download_image_from_url(person["image_url"], photo_path)
        except Exception:
            pass

    if not photo_path.exists() or clean_filename in ("", "none", "default_avatar.png"):
        default_path = get_watchlist_dir() / "default_avatar.png"
        if default_path.exists():
            return FileResponse(path=str(default_path), media_type="image/png")
        raise HTTPException(status_code=404, detail="Photo not found")
    media_type = "image/png" if clean_filename.endswith(".png") else "image/jpeg"
    return FileResponse(path=str(photo_path), media_type=media_type)


@app.get("/api/admin/vehicles")
def get_admin_vehicles(current_user: dict = Depends(require_admin)):
    """Retrieve all authorized vehicles on the whitelist (Admin only)."""
    vehicles = get_all_authorized_vehicles()
    return {
        "count": len(vehicles),
        "vehicles": vehicles,
    }


@app.post("/api/admin/vehicles")
def add_admin_vehicle(req: VehicleCreateRequest, current_user: dict = Depends(require_admin)):
    """Add or update an authorized vehicle on the whitelist (Admin only)."""
    clean_plate = req.plate_number.strip().upper()
    if not clean_plate:
        raise HTTPException(status_code=400, detail="Plate number cannot be empty.")
    if not req.owner_name.strip():
        raise HTTPException(status_code=400, detail="Owner name / unit cannot be empty.")

    vehicle = add_or_update_authorized_vehicle(
        plate_number=clean_plate,
        owner_name=req.owner_name.strip(),
        vehicle_type=req.vehicle_type.strip(),
        purpose=req.purpose.strip(),
        expiry_date=req.expiry_date,
        notes=req.notes,
    )
    return {
        "status": "success",
        "message": f"Vehicle '{clean_plate}' ({req.owner_name}) successfully added to authorized whitelist.",
        "vehicle": vehicle,
    }


@app.post("/api/admin/vehicles/bulk-import")
async def bulk_import_vehicles(
    file: UploadFile = File(..., description="CSV or Excel file containing vehicle records"),
    current_user: dict = Depends(require_admin),
):
    """Bulk import authorized vehicles from CSV or Excel (.xlsx) file (Admin only)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="A valid CSV or Excel file is required.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".tsv", ".xlsx", ".xlsm"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Please upload a CSV (.csv) or Excel (.xlsx) file.",
        )

    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        rows = parse_tabular_file(contents, file.filename)
        if not rows:
            raise HTTPException(status_code=400, detail="No data records found in uploaded file.")

        result = bulk_import_authorized_vehicles(rows)
        return {
            "status": "success",
            "message": f"Bulk import complete: {result['added']} added, {result['updated']} updated out of {result['total_records']} records.",
            **result,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process bulk import: {str(e)}")


@app.get("/api/admin/vehicles/template")
def get_vehicles_template(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    current_user: dict = Depends(require_admin),
):
    """Download sample CSV or Excel template for bulk importing authorized vehicles (Admin only)."""
    try:
        data, media_type, filename = generate_sample_template(target="vehicles", format_type=format)
        return Response(
            content=data,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")


@app.delete("/api/admin/vehicles/{plate_number}")
def delete_admin_vehicle(plate_number: str, current_user: dict = Depends(require_admin)):
    """Remove a vehicle from the authorized whitelist (Admin only)."""
    success = delete_authorized_vehicle(plate_number)
    if not success:
        raise HTTPException(status_code=404, detail=f"Vehicle '{plate_number}' not found on whitelist.")
    return {
        "status": "success",
        "message": f"Vehicle '{plate_number}' removed from authorized whitelist.",
        "plate_number": plate_number,
    }


# =====================================================================
# Protected Security Endpoints
# =====================================================================
@app.get("/api/events")
def get_events(
    limit: int = Query(50, ge=1, le=500, description="Max number of events to return"),
    event_type: Optional[str] = Query(None, description="Filter by event_type"),
    object_class: Optional[str] = Query(None, description="Filter by object_class"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    camera_id: Optional[str] = Query(None, description="Filter by camera_id"),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve security events with optional filtering (Requires Operator/Admin authentication)."""
    events = fetch_events_filtered(
        camera_id=camera_id,
        event_type=event_type,
        object_class=object_class,
        severity=severity,
        limit=limit,
    )
    return {
        "count": len(events),
        "events": events,
    }


@app.post("/api/events/purge")
def purge_events_endpoint(
    max_age_minutes: int = Query(30, ge=1, le=1440, description="Purge events older than this number of minutes"),
    current_user: dict = Depends(get_current_user),
):
    """
    Purge historical security events older than max_age_minutes (default: 30 minutes).
    Deletes SQLite records and removes associated image snapshots to reclaim disk space.
    """
    res = purge_expired_events(max_age_minutes=max_age_minutes)
    return res


@app.get("/api/audit/verify")
def get_audit_verification(current_user: dict = Depends(get_current_user)):
    """Verify cryptographic SHA-256 hash chain across all stored security events (Requires Operator/Admin)."""
    return verify_chain_integrity()


@app.get("/api/events/{event_id}")
def get_event_detail(event_id: str, current_user: dict = Depends(get_current_user)):
    """Retrieve full detail for a single security event."""
    event = fetch_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event with ID '{event_id}' not found")
    return event


@app.get("/api/cameras")
def get_cameras(current_user: dict = Depends(get_current_user)):
    """Retrieve registered cameras list and real-time online/offline status."""
    cams = fetch_all_cameras()
    if not cams:
        return [
            {
                "camera_id": "CAM_01",
                "name": "Sector 4 Gate",
                "location": "North Perimeter Fence - Sector 4",
                "status": "online",
                "resolution": "1280x720",
                "fps": 30,
                "monitored_zone": "Polygon Zone Alpha (Sector 4)",
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }
        ]
    return cams


@app.get("/api/snapshots/{event_id}")
def get_snapshot_image(
    event_id: str,
    current_user: dict = Depends(get_current_user_flexible),
):
    """Serve the JPEG snapshot image for a given event ID."""
    snapshots_dir = get_snapshots_dir()
    snapshot_path = snapshots_dir / f"{event_id}.jpg"

    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail=f"Snapshot for event '{event_id}' not found")

    return FileResponse(
        path=str(snapshot_path),
        media_type="image/jpeg",
        filename=f"{event_id}.jpg",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get("/api/events/{event_id}/replay")
def get_incident_replay(
    event_id: str,
    format: str = Query("video", description="Format: 'video' for MP4 stream, 'json' for forensic metadata"),
    window: float = Query(3.0, description="Window size in seconds before and after the event (default: 3.0s)"),
    current_user: dict = Depends(get_current_user_flexible),
):
    """
    Extract and serve a forensic sub-clip (T-3s to T+3s) around a security event.
    If source video is unavailable (e.g. live-only webcam session), returns a clear fallback response.
    """
    is_available, metadata, replay_path = extract_incident_replay_clip(
        event_id=event_id,
        window_seconds=window,
    )

    if not is_available:
        raise HTTPException(
            status_code=404,
            detail=metadata.get("message", "Incident replay is unavailable for this session."),
        )

    if format.lower() == "json":
        return metadata

    return FileResponse(
        path=str(replay_path),
        media_type="video/mp4",
        filename=f"replay_{event_id}.mp4",
        headers={"Accept-Ranges": "bytes"},
    )


@app.get("/api/events/{event_id}/crop")
def get_event_target_crop(
    event_id: str,
    current_user: dict = Depends(get_current_user_flexible),
):
    """Serve cropped high-resolution target ROI (face, plate, or body) for forensic zoom inspection."""
    success, jpeg_bytes, meta = extract_event_target_crop(event_id)
    if not success or not jpeg_bytes:
        raise HTTPException(
            status_code=404,
            detail=meta.get("error", "Target crop unavailable for this event."),
        )
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Crop-Type": meta.get("crop_type", "body"),
        },
    )


@app.get("/api/audit/verify")
def verify_security_audit_chain(current_user: dict = Depends(get_current_user)):
    """
    Perform full cryptographic verification across the entire SQLite event audit hash chain.
    Validates SHA-256 block linkages and signs cryptographic audit response.
    """
    return verify_chain_integrity()


@app.get("/api/audit/certificate")
def get_audit_certificate(current_user: dict = Depends(get_current_user)):
    """
    Generate a formal, tamper-evident Digital Chain of Custody & Forensic Verification Certificate.
    Admissible for military inquiry, internal security review, and legal compliance.
    """
    audit_res = verify_chain_integrity()
    now_utc = datetime.now(timezone.utc).isoformat()
    cert_id = f"CERT-IBVAP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    is_valid = audit_res.get("valid", False)
    total_checked = audit_res.get("total_events_checked", 0)
    genesis_hash = audit_res.get("genesis_hash")
    latest_hash = audit_res.get("latest_block_hash")

    certificate = {
        "certificate_id": cert_id,
        "title": "DIGITAL CHAIN OF CUSTODY & CRYPTOGRAPHIC INTEGRITY CERTIFICATE",
        "issuing_authority": "IBVAP Autonomous Border Security Platform (V2.6)",
        "verified_at": now_utc,
        "verified_by": {
            "username": current_user.get("username", "admin"),
            "role": current_user.get("role", "operator"),
        },
        "integrity_status": "AUTHENTIC // UNCOMPROMISED" if is_valid else "COMPROMISED // INTEGRITY_VIOLATION",
        "is_valid": is_valid,
        "cryptographic_specification": {
            "algorithm": "SHA-256 Chained Hash Ledger (Genesis Block Anchored)",
            "digital_signature_algorithm": "HMAC-SHA256 Command Authority Digital Seal",
            "genesis_block_hash": genesis_hash,
            "latest_block_hash": latest_hash,
            "total_blocks_verified": total_checked,
            "signature_seal": sign_event_block(genesis_hash or "GENESIS", latest_hash or "LATEST", now_utc, "COMMAND_HQ"),
        },
        "command_authority_signature_seal": sign_event_block(genesis_hash or "GENESIS", latest_hash or "LATEST", now_utc, "COMMAND_HQ"),
        "forensic_audit_details": audit_res,
        "compliance_statement": (
            "This digital certificate attests that all surveillance intrusion records, biometric face identifications, "
            "and vehicle detections in the IBVAP database have been cryptographically verified against SHA-256 Merkle-style "
            "chained block hashes with zero detected tampering, alterations, or record deletions."
            if is_valid
            else "WARNING: Cryptographic integrity violation detected. One or more records have been tampered with post-signing."
        ),
    }
    return certificate


def generate_placeholder_frame(camera_id: str = "CAM_01", message: str = "STANDBY // NO SIGNAL") -> bytes:
    """Generate a high-tech dark mode standby placeholder frame when stream is offline/initializing."""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (20, 16, 10)  # Dark BGR navy #0a1014

    # Tactical grid lines
    for x in range(0, 640, 40):
        cv2.line(img, (x, 0), (x, 480), (35, 28, 18), 1)
    for y in range(0, 480, 40):
        cv2.line(img, (0, y), (640, y), (35, 28, 18), 1)

    # Top HUD banner
    cv2.rectangle(img, (0, 0), (640, 38), (30, 22, 14), -1)
    cv2.line(img, (0, 38), (640, 38), (233, 165, 14), 2)
    cv2.putText(
        img,
        f"IBVAP SURVEILLANCE | {camera_id}",
        (16, 25),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 210, 80),
        2,
        cv2.LINE_AA,
    )
    cv2.putText(
        img,
        "FEED STANDBY",
        (490, 25),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (100, 100, 255),
        1,
        cv2.LINE_AA,
    )

    # Center alert box
    cv2.rectangle(img, (100, 170), (540, 310), (32, 24, 16), -1)
    cv2.rectangle(img, (100, 170), (540, 310), (70, 50, 28), 1)

    # Warning icon
    cv2.circle(img, (320, 215), 18, (0, 140, 255), 2)
    cv2.putText(
        img, "!", (315, 223), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 180, 255), 2, cv2.LINE_AA
    )

    (tw, _), _ = cv2.getTextSize(message, cv2.FONT_HERSHEY_SIMPLEX, 0.60, 2)
    cv2.putText(
        img,
        message,
        (max(110, int((640 - tw) / 2)), 260),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.60,
        (0, 180, 255),
        2,
        cv2.LINE_AA,
    )
    sub_msg = "Click 'Resume Feed' or 'Webcam' above to activate surveillance"
    (stw, _), _ = cv2.getTextSize(sub_msg, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
    cv2.putText(
        img,
        sub_msg,
        (max(110, int((640 - stw) / 2)), 290),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.38,
        (160, 160, 160),
        1,
        cv2.LINE_AA,
    )

    _, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return encoded.tobytes()


async def mjpeg_frame_generator(camera_id: str, request: Optional[Request] = None):
    """Continuously yield multipart MJPEG frames from in-memory FrameHub or disk with zero judder."""
    backend_dir = Path(__file__).resolve().parent.parent
    live_frame_path = backend_dir / f"live_frame_{camera_id}.jpg"
    placeholder_bytes = generate_placeholder_frame(camera_id, "STANDBY // NO SIGNAL")

    # Auto-ensure live surveillance loop is active only if NOT manually stopped by operator
    try:
        if camera_id not in MANUALLY_STOPPED_CAMERAS:
            ensure_default_stream_running(camera_id)
    except Exception:
        pass

    hub = get_frame_hub()
    last_mtime = 0.0
    last_yield_time = 0.0
    is_standby = False

    while True:
        if request is not None and await request.is_disconnected():
            break

        if camera_id in MANUALLY_STOPPED_CAMERAS:
            if not is_standby or (time.time() - last_yield_time > 1.0):
                stale_bytes = generate_placeholder_frame(camera_id, "CAMERA STOPPED // STANDBY")
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + stale_bytes + b"\r\n"
                )
                last_yield_time = time.time()
                is_standby = True
            await asyncio.sleep(0.4)
            continue

        try:
            # 1. First priority: In-Memory FrameHub (Zero Disk Latency)
            if hub is not None:
                mem_bytes = hub.get_latest_frame(camera_id, max_age=3.5)
                if mem_bytes and len(mem_bytes) > 500:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + mem_bytes + b"\r\n"
                    )
                    last_yield_time = time.time()
                    is_standby = False
                    await asyncio.sleep(0.025)  # Smooth ~40 FPS pacing
                    continue

            # 2. Second priority: Disk File Fallback (fast OS temp folder first to bypass OneDrive locks)
            fast_path = get_live_frame_path(camera_id)
            target_path = fast_path if (fast_path.exists() and (time.time() - fast_path.stat().st_mtime <= 4.0)) else live_frame_path

            if target_path.exists():
                mtime = target_path.stat().st_mtime
                age = time.time() - mtime

                if age > 4.0:
                    # Stream has stopped or paused
                    if not is_standby or (time.time() - last_yield_time > 1.0):
                        stale_bytes = generate_placeholder_frame(camera_id, "STREAM STANDBY (WAITING FOR FRAMES)")
                        yield (
                            b"--frame\r\n"
                            b"Content-Type: image/jpeg\r\n\r\n" + stale_bytes + b"\r\n"
                        )
                        last_yield_time = time.time()
                        is_standby = True
                    await asyncio.sleep(0.1)
                elif mtime > last_mtime:
                    # Fresh new frame generated by video pipeline!
                    try:
                        with open(target_path, "rb") as f:
                            frame_bytes = f.read()
                        if frame_bytes and len(frame_bytes) > 500:
                            yield (
                                b"--frame\r\n"
                                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                            )
                            last_mtime = mtime
                            last_yield_time = time.time()
                            is_standby = False
                    except Exception:
                        pass
                    # Small yield to event loop
                    await asyncio.sleep(0.01)
                else:
                    # No new frame yet - wait briefly to match frame arrival with zero judder
                    await asyncio.sleep(0.015)
            else:
                if not is_standby or (time.time() - last_yield_time > 1.0):
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + placeholder_bytes + b"\r\n"
                    )
                    last_yield_time = time.time()
                    is_standby = True
                await asyncio.sleep(0.1)
        except Exception:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + placeholder_bytes + b"\r\n"
            )
            await asyncio.sleep(0.1)


@app.get("/api/live-feed/{camera_id}")
async def get_live_feed(
    camera_id: str = "CAM_01",
    request: Request = None,
    current_user: dict = Depends(get_current_user_flexible),
):
    """
    Stream real-time MJPEG video feed for standard browser <img> tags.
    Continuously streams annotated detection and tracking frames from the analytics pipeline.
    """
    return StreamingResponse(
        mjpeg_frame_generator(camera_id, request),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/live-feed/{camera_id}/frame")
async def get_live_frame_snapshot(
    camera_id: str = "CAM_01",
    current_user: dict = Depends(get_current_user_flexible),
):
    """Fetch the single latest JPEG frame instantly with zero browser caching."""
    hub = get_frame_hub()
    if hub is not None:
        mem_bytes = hub.get_latest_frame(camera_id, max_age=4.0)
        if mem_bytes and len(mem_bytes) > 500:
            return Response(
                content=mem_bytes,
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                    "Access-Control-Allow-Origin": "*",
                },
            )

    fast_path = get_live_frame_path(camera_id)
    target_path = fast_path if (fast_path.exists() and (time.time() - fast_path.stat().st_mtime <= 4.0)) else (Path(__file__).resolve().parent.parent / f"live_frame_{camera_id}.jpg")
    if target_path.exists():
        try:
            mtime = target_path.stat().st_mtime
            if (time.time() - mtime) <= 4.0:
                with open(target_path, "rb") as f:
                    data = f.read()
                if data and len(data) > 500:
                    return Response(
                        content=data,
                        media_type="image/jpeg",
                        headers={
                            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                            "Pragma": "no-cache",
                            "Expires": "0",
                            "Access-Control-Allow-Origin": "*",
                        },
                    )
        except Exception:
            pass

    placeholder = generate_placeholder_frame(camera_id, "STANDBY // NO SIGNAL")
    return Response(
        content=placeholder,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/stats")
def get_stats(current_user: dict = Depends(get_current_user)):
    """Retrieve aggregate counts and metrics for dashboard stat tiles (Requires Operator/Admin)."""
    return compute_event_stats()


@app.get("/api/system/health")
def get_system_health():
    """Retrieve real-time hardware telemetry and stream health watchdog stats."""
    hub = get_frame_hub()
    health = hub.get_system_health() if hub is not None else {
        "status": "operational",
        "uptime_seconds": 0.0,
        "cpu_percent": 0.0,
        "memory": {"percent": 0.0, "used_mb": 0.0, "total_mb": 0.0},
        "active_streams": 0,
        "aggregate_footfall": {"total_in": 0, "total_out": 0, "current_occupancy": 0},
        "camera_telemetry": {},
    }
    backend_dir = Path(__file__).resolve().parent.parent
    active_count = 0
    with STREAM_PROCESSES_LOCK:
        for cam_id, proc in list(ACTIVE_STREAM_PROCESSES.items()):
            if proc and proc.poll() is None:
                active_count += 1
    for f in backend_dir.glob("live_frame_*.jpg"):
        try:
            if (time.time() - f.stat().st_mtime) <= 4.0:
                active_count = max(active_count, 1)
        except Exception:
            pass
    health["active_streams"] = max(health.get("active_streams", 0), active_count)
    return health


class StreamControlRequest(BaseModel):
    camera_id: str = "CAM_01"
    source: str = "sample.mp4"  # "0" for webcam, or video filename/path/url
    source_type: str = "test_video"  # "webcam" | "test_video" | "rtsp"
    imgsz: int = 480
    show_zone: bool = True
    camera_name: Optional[str] = None
    location: Optional[str] = None


class ClientFrameRequest(BaseModel):
    image: str  # Base64 data URL
    camera_id: Optional[str] = "CAM_01"
    show_zone: Optional[bool] = True
    custom_polygon: Optional[List[List[float]]] = None  # Normalized [[x,y],...] or pixel coords (Item 11)


_CLIENT_YOLO_MODEL = None
_CLIENT_YOLO_LOCK = threading.Lock()
_LAST_CLIENT_INTRUSION_LOG: dict[str, float] = {}


def get_client_yolo_model():
    global _CLIENT_YOLO_MODEL
    if _CLIENT_YOLO_MODEL is None:
        with _CLIENT_YOLO_LOCK:
            if _CLIENT_YOLO_MODEL is None:
                try:
                    from ultralytics import YOLO
                    app_dir = Path(__file__).resolve().parent
                    candidates = [
                        app_dir.parent / "models" / "yolov8n.pt",
                        app_dir.parent.parent / "yolov8n.pt",
                        Path("yolov8n.pt"),
                    ]
                    m_path = None
                    for c in candidates:
                        if c.exists():
                            m_path = str(c)
                            break
                    if not m_path:
                        m_path = "yolov8n.pt"
                    print(f"[*] Initializing client frame YOLO model from: {m_path}")
                    _CLIENT_YOLO_MODEL = YOLO(m_path)
                except Exception as e:
                    print(f"[!] Warning: Could not initialize YOLO model in main.py: {e}")
                    _CLIENT_YOLO_MODEL = False
    return _CLIENT_YOLO_MODEL if _CLIENT_YOLO_MODEL is not False else None


# Track identity memory cache for client browser webcam AI loop (smooths face recognition across frames)
_CLIENT_TRACK_IDENTITIES: Dict[int, Dict[str, Any]] = {}
_CLIENT_TRACK_UNKNOWN_FRAMES: Dict[int, int] = {}


def is_person_authorized(name: Optional[str]) -> bool:
    """Evaluate whether an identified name belongs to an active authorized officer / personnel."""
    if not name or not isinstance(name, str) or name.upper() in ("UNKNOWN", "NONE", "UNLISTED"):
        return False
    try:
        from backend.app.admin_management import check_watchlist_person_active, get_watchlist_person
    except ImportError:
        try:
            from admin_management import check_watchlist_person_active, get_watchlist_person
        except ImportError:
            check_watchlist_person_active = None
            get_watchlist_person = None

    clean_name = name.strip()
    if get_watchlist_person:
        p = get_watchlist_person(clean_name)
        if p and not p.get("is_expired", False):
            return True
    if check_watchlist_person_active:
        return check_watchlist_person_active(clean_name)
    return False



@app.post("/api/stream/process-client-frame")
async def process_client_frame(
    req: ClientFrameRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Process real-time browser webcam frame for AI border security analytics.
    Performs YOLOv8 object detection, Virtual Fence intrusion check, and Face Recognition.
    """
    try:
        img_str = req.image
        if "," in img_str:
            img_str = img_str.split(",", 1)[1]
        raw_bytes = base64.b64decode(img_str)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode image buffer")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame data: {str(e)}")

    height, width = frame.shape[:2]
    # Virtual Fence Polygon: If custom polygon is drawn and provided by client, use it; otherwise fallback to default side corridor
    if req.custom_polygon and len(req.custom_polygon) >= 3:
        try:
            poly_pts = []
            norm_pts = []
            for pt in req.custom_polygon:
                nx = float(pt[0]) if float(pt[0]) <= 1.0 else float(pt[0]) / width
                ny = float(pt[1]) if float(pt[1]) <= 1.0 else float(pt[1]) / height
                poly_pts.append([nx * width, ny * height])
                norm_pts.append([nx, ny])
            polygon = np.array(poly_pts, dtype=np.int32)
            active_poly_norm = norm_pts
        except Exception:
            webcam_poly = np.array([[0.62, 0.12], [0.96, 0.12], [0.96, 0.88], [0.62, 0.88]], dtype=np.float32)
            polygon = (webcam_poly * [width, height]).astype(np.int32)
            active_poly_norm = webcam_poly.tolist()
    else:
        # Dedicated side perimeter corridor for webcam mode so sitting at desk does not trigger false alerts
        # Corridor covers right 35% of the frame: [[0.62, 0.12], [0.96, 0.12], [0.96, 0.88], [0.62, 0.88]]
        webcam_poly = np.array([[0.62, 0.12], [0.96, 0.12], [0.96, 0.88], [0.62, 0.88]], dtype=np.float32)
        polygon = (webcam_poly * [width, height]).astype(np.int32)
        active_poly_norm = webcam_poly.tolist()

    model = get_client_yolo_model()
    detections = []
    has_intrusion = False
    occupancy = 0
    t0 = time.time()

    if model is not None:
        try:
            results = model.track(
                source=frame,
                persist=True,
                classes=[0, 1, 2, 3, 5, 7],
                conf=0.35,
                imgsz=384,
                verbose=False,
            )[0]
            boxes = results.boxes
            if boxes is not None and len(boxes) > 0:
                recognizer = get_active_face_recognizer()
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = [int(v) for v in xyxy]
                    cls_name = model.names.get(cls_id, f"class_{cls_id}")
                    track_id = int(box.id[0]) if box.id is not None else 1

                    if cls_name == "person":
                        occupancy += 1

                    foot_point = (int((x1 + x2) / 2), int(y2))
                    center_point = (int((x1 + x2) / 2), int((y1 + y2) / 2))

                    is_inside = False
                    if req.show_zone:
                        poly_foot = cv2.pointPolygonTest(polygon, (float(foot_point[0]), float(foot_point[1])), False)
                        poly_center = cv2.pointPolygonTest(polygon, (float(center_point[0]), float(center_point[1])), False)
                        is_inside = (poly_foot >= 0 or poly_center >= 0)

                    if is_inside:
                        has_intrusion = True

                    identified_as = None
                    face_conf = 0.0
                    face_bbox = None
                    is_auth_veh = False
                    veh_owner = None
                    plate_number = None
                    plate_conf = 0.0
                    plate_bbox = None

                    is_auth_person = False
                    if cls_name == "person":
                        if recognizer is not None:
                            try:
                                f_ident, f_conf, f_coords = recognizer.identify_face_in_person_crop(
                                    frame, (x1, y1, x2, y2)
                                )
                                if f_coords:
                                    face_bbox = f_coords
                                if f_ident and f_ident != "UNKNOWN":
                                    identified_as = f_ident
                                    face_conf = f_conf
                                    is_auth_person = is_person_authorized(f_ident)
                                    _CLIENT_TRACK_IDENTITIES[track_id] = {
                                        "identity": f_ident,
                                        "is_authorized": is_auth_person,
                                        "last_seen": t0,
                                        "face_conf": f_conf,
                                        "face_bbox": f_coords,
                                    }
                                    _CLIENT_TRACK_UNKNOWN_FRAMES[track_id] = 0
                                elif f_ident == "UNKNOWN":
                                    _CLIENT_TRACK_UNKNOWN_FRAMES[track_id] = _CLIENT_TRACK_UNKNOWN_FRAMES.get(track_id, 0) + 1
                            except Exception:
                                pass

                        # Temporal Track Identity Smoothing:
                        # If face is momentarily occluded or angled away in this frame, retain positive identification
                        cached_ident = _CLIENT_TRACK_IDENTITIES.get(track_id)
                        if cached_ident and (t0 - cached_ident.get("last_seen", 0) <= 20.0):
                            identified_as = cached_ident["identity"]
                            face_conf = cached_ident.get("face_conf", face_conf)
                            is_auth_person = cached_ident.get("is_authorized", False)
                            if not face_bbox:
                                face_bbox = cached_ident.get("face_bbox")
                        elif identified_as:
                            is_auth_person = is_person_authorized(identified_as)
                    elif cls_name in ["car", "bus", "truck", "motorcycle", "vehicle"]:
                        try:
                            p_bbox, p_text, p_conf, is_auth, owner = run_vehicle_anpr(
                                frame, (x1, y1, x2, y2), tracker_id=track_id
                            )
                            plate_bbox = p_bbox
                            plate_number = p_text
                            plate_conf = p_conf
                            is_auth_veh = is_auth
                            veh_owner = owner
                            if is_auth and owner:
                                identified_as = owner
                        except Exception as anpr_e:
                            print(f"[!] ANPR client frame error: {anpr_e}")

                    detections.append({
                        "class_name": cls_name,
                        "track_id": track_id,
                        "confidence": round(conf, 2),
                        "bbox": [x1, y1, x2, y2],
                        "norm_bbox": [
                            round(x1 / width, 4),
                            round(y1 / height, 4),
                            round(x2 / width, 4),
                            round(y2 / height, 4),
                        ],
                        "in_zone": is_inside,
                        "identified_as": identified_as,
                        "face_confidence": round(face_conf, 2) if face_conf else None,
                        "face_bbox": face_bbox,
                        "plate_number": plate_number,
                        "plate_confidence": round(plate_conf, 2) if plate_conf else None,
                        "plate_bbox": plate_bbox,
                        "is_authorized_vehicle": is_auth_veh,
                        "is_authorized_person": is_auth_person,
                        "is_authorized": is_auth_person or is_auth_veh,
                        "vehicle_owner": veh_owner,
                    })
        except Exception as det_err:
            print(f"[!] Warning running client YOLO detection: {det_err}")

    # Check for unknown persons or unauthorized vehicles
    # Only flag unknown person if NOT authorized AND persistently unverified across multiple frames
    has_unknown_person = any(
        d["class_name"] == "person"
        and not d.get("is_authorized_person")
        and not d.get("is_authorized")
        and (not d.get("identified_as") or d.get("identified_as") == "UNKNOWN")
        and (d.get("in_zone") or _CLIENT_TRACK_UNKNOWN_FRAMES.get(d["track_id"], 0) >= 6)
        for d in detections
    )
    has_unknown_vehicle = any(
        d["class_name"] in ["car", "bus", "truck", "motorcycle", "vehicle"] and not d.get("is_authorized_vehicle")
        for d in detections
    )
    has_unknown_activity = has_unknown_person or has_unknown_vehicle

    # Enqueue intrusion event with rate limiting (at most once every 4.0 seconds)
    now = time.time()
    last_logged = _LAST_CLIENT_INTRUSION_LOG.get(req.camera_id, 0)
    if (has_intrusion or has_unknown_activity) and (now - last_logged >= 4.0):
        _LAST_CLIENT_INTRUSION_LOG[req.camera_id] = now
        try:
            from backend.app.events import log_event_async
        except ImportError:
            try:
                from events import log_event_async
            except ImportError:
                log_event_async = None
        if log_event_async:
            primary_det = next(
                (d for d in detections if (d["class_name"] == "person" and not d.get("is_authorized_person")) or (d["class_name"] in ["car", "bus", "truck", "motorcycle", "vehicle"] and not d.get("is_authorized_vehicle")) or d.get("in_zone")),
                detections[0] if detections else None,
            )
            det_class = primary_det["class_name"] if primary_det else "person"
            det_track = primary_det["track_id"] if primary_det else 1
            det_bbox = [float(v) for v in primary_det["bbox"]] if primary_det else [0.0, 0.0, float(width), float(height)]
            det_conf = primary_det["confidence"] if primary_det else 0.85
            ident = primary_det.get("vehicle_owner") if primary_det.get("is_authorized_vehicle") else primary_det.get("identified_as")

            if det_class in ["car", "bus", "truck", "motorcycle", "vehicle"]:
                evt_type = "authorized_entry" if primary_det.get("is_authorized_vehicle") else "unauthorized_vehicle"
            else:
                if primary_det.get("is_authorized_person"):
                    evt_type = "authorized_entry" if primary_det.get("in_zone") else "authorized_person"
                elif ident and ident != "UNKNOWN":
                    evt_type = "zone_entry" if primary_det.get("in_zone") else "watchlist_match"
                else:
                    evt_type = "unauthorized_person"

            log_event_async(
                camera_id=req.camera_id,
                event_type=evt_type,
                object_class=det_class,
                track_id=det_track,
                frame_number=0,
                bbox=det_bbox,
                confidence=det_conf,
                frame=frame,
                identified_as=ident,
                plate_number=primary_det.get("plate_number"),
                plate_confidence=primary_det.get("plate_confidence"),
                plate_bbox=primary_det.get("plate_bbox"),
                source_video="live_browser_webcam",
            )

    # Push to in-memory frame hub and update telemetry
    hub = get_frame_hub()
    inference_fps = round(1.0 / max(time.time() - t0, 0.001), 1)
    if hub:
        hub.update_telemetry(
            camera_id=req.camera_id,
            footfall_in=0,
            footfall_out=0,
            occupancy=occupancy,
            fps=inference_fps,
        )
        try:
            hub.push_ndarray(req.camera_id, frame)
        except Exception:
            pass

    return {
        "status": "success",
        "camera_id": req.camera_id,
        "width": width,
        "height": height,
        "polygon": active_poly_norm,
        "detections": detections,
        "has_intrusion": has_intrusion,
        "has_unknown_person": has_unknown_person,
        "has_unknown_vehicle": has_unknown_vehicle,
        "unknown_person_count": sum(1 for d in detections if d["class_name"] == "person" and (not d.get("identified_as") or d.get("identified_as") == "UNKNOWN")),
        "unknown_vehicle_count": sum(1 for d in detections if d["class_name"] in ["car", "bus", "truck", "motorcycle", "vehicle"] and not d.get("is_authorized_vehicle")),
        "occupancy": occupancy,
        "telemetry": {
            "fps": inference_fps,
            "occupancy": occupancy,
        },
    }


@app.get("/api/stream/videos")
def get_available_videos():
    """List all available surveillance video test feeds for quick switching."""
    app_dir = Path(__file__).resolve().parent
    test_videos_dir = app_dir.parent / "test_videos"
    video_labels = {
        "sample.mp4": "Sector 01 Gate (Multi-Person Intrusion & Bus Entry)",
        "tracking_test.mp4": "Sector 04 Gate (Multi-Target Tracking & Debounce)",
        "dark_test.mp4": "Night Low-Light Sector (Retinex-CLAHE Enhancement)",
        "foggy_test.mp4": "Adverse Fog Weather (DCP Dehazing Verification)",
        "suspicious_behavior_test.mp4": "Sector 02 Perimeter (Suspicious Loitering & Pacing)",
        "real_footage_1.mp4": "Border Outpost 01 (Real Surveillance Feed)",
        "real_footage_2.mp4": "Border Outpost 02 (Real Surveillance Feed)",
        "real_footage_3.mp4": "Border Outpost 03 (Real Surveillance Feed)",
    }
    videos = []
    for file in sorted(test_videos_dir.glob("*.mp4")):
        if "annotated" in file.name or "output" in file.name or file.name.startswith("."):
            continue
        videos.append({
            "filename": file.name,
            "label": video_labels.get(file.name, file.stem.replace("_", " ").title()),
            "size_kb": round(file.stat().st_size / 1024),
        })
    return {"videos": videos}


@app.post("/api/video/upload")
async def upload_offline_video(
    file: UploadFile = File(..., description="Video file for offline forensic analysis"),
    current_user: dict = Depends(get_current_user_flexible),
):
    """
    Upload an offline surveillance or test video file (MP4/AVI/MKV/MOV) directly for immediate ingestion or preview (Item 26).
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="A valid video file is required.")

    ext = Path(file.filename).suffix.lower()
    allowed_exts = [".mp4", ".avi", ".mkv", ".mov", ".m4v", ".webm"]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: {', '.join(allowed_exts)}",
        )

    clean_stem = re.sub(r'[^a-zA-Z0-9_\-]', '_', Path(file.filename).stem)
    dest_filename = f"upload_{clean_stem}_{int(time.time())}{ext}"
    app_dir = Path(__file__).resolve().parent
    test_videos_dir = app_dir.parent / "test_videos"
    test_videos_dir.mkdir(parents=True, exist_ok=True)
    dest_path = test_videos_dir / dest_filename

    contents = await file.read()
    if len(contents) < 100:
        raise HTTPException(status_code=400, detail="Uploaded video file is empty or corrupted.")

    dest_path.write_bytes(contents)
    size_kb = round(len(contents) / 1024)

    return {
        "status": "success",
        "filename": dest_filename,
        "label": f"Offline Video: {file.filename} ({size_kb} KB)",
        "size_kb": size_kb,
        "message": f"Successfully uploaded {file.filename} for offline video inspection.",
    }



@app.post("/api/stream/start")
async def start_camera_stream(
    req: StreamControlRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Start live camera analytics process (Webcam #0, RTSP stream, or test video) in background with 1-click.
    """
    cam_id = req.camera_id or "CAM_01"
    MANUALLY_STOPPED_CAMERAS.discard(cam_id)
    if req.camera_name or req.location:
        try:
            heartbeat_camera(
                camera_id=cam_id,
                name=req.camera_name or f"CCTV {cam_id}",
                location=req.location or f"Sector Gate ({cam_id})",
                resolution="1280x720",
                fps=30.0,
            )
        except Exception:
            pass
    proc = launch_analytics_stream(
        camera_id=cam_id,
        source_type=req.source_type,
        source=req.source,
        imgsz=req.imgsz,
        show_zone=req.show_zone,
    )

    safe_source = sanitize_stream_source(req.source)
    await ws_manager.broadcast_json({
        "type": "stream_started",
        "camera_id": cam_id,
        "source_type": req.source_type,
        "source": safe_source,
        "pid": proc.pid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "status": "started",
        "camera_id": cam_id,
        "source_type": req.source_type,
        "source": safe_source,
        "pid": proc.pid,
        "message": f"Camera '{cam_id}' ({req.source_type}) started in continuous surveillance loop.",
    }


@app.post("/api/stream/stop")
async def stop_camera_stream(
    camera_id: str = Query("CAM_01"),
    current_user: dict = Depends(get_current_user),
):
    """Stop active camera analytics process with 1-click."""
    MANUALLY_STOPPED_CAMERAS.add(camera_id)
    kill_camera_processes(camera_id)

    # Clear cached frames from memory and disk so no stale frames display
    hub = get_frame_hub()
    if hub:
        hub.remove_camera(camera_id)
    backend_dir = Path(__file__).resolve().parent.parent
    live_frame_path = backend_dir / f"live_frame_{camera_id}.jpg"
    fast_path = get_live_frame_path(camera_id)
    try:
        if live_frame_path.exists():
            live_frame_path.unlink()
    except Exception:
        pass
    try:
        if fast_path.exists():
            fast_path.unlink()
    except Exception:
        pass

    await ws_manager.broadcast_json({
        "type": "stream_stopped",
        "camera_id": camera_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "status": "stopped",
        "camera_id": camera_id,
        "message": f"Camera stream '{camera_id}' stopped.",
    }


@app.get("/api/stream/status")
def get_stream_processes_status():
    """Retrieve running status for all camera analytics processes."""
    with STREAM_PROCESSES_LOCK:
        status = {}
        for cam_id, proc in list(ACTIVE_STREAM_PROCESSES.items()):
            is_running = proc.poll() is None
            if not is_running:
                ACTIVE_STREAM_PROCESSES.pop(cam_id, None)
            status[cam_id] = {
                "running": is_running,
                "pid": proc.pid if is_running else None,
            }
        return status


def _run_detection_process():
    """Background task to run video detection pipeline with optimized CPU inference."""
    app_dir = Path(__file__).resolve().parent
    script_path = app_dir / "detection_tracking.py"
    video_path = app_dir.parent / "test_videos" / "tracking_test.mp4"
    output_path = app_dir.parent / "test_videos" / "annotated_tracking_test.mp4"

    cmd = [
        sys.executable,
        str(script_path),
        "--input", str(video_path),
        "--output", str(output_path),
        "--imgsz", "480",
        "--no-display",
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


@app.post("/api/pipeline/run")
def trigger_pipeline_run(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Trigger an asynchronous video analytics pipeline run on the test video (Requires Operator/Admin)."""
    background_tasks.add_task(_run_detection_process)
    return {
        "status": "pipeline_started",
        "message": f"Video analytics engine running on sector surveillance stream (Triggered by {current_user.get('role', 'operator')} '{current_user.get('username', 'user')}'). Events will stream live over WebSocket.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


INTERNAL_BROADCAST_KEY = os.environ.get("IBVAP_INTERNAL_KEY", "ibvap_internal_process_broadcast_secret_2026")


@app.post("/api/internal/broadcast")
async def internal_broadcast_event(
    request: Request,
    event: dict[str, Any],
):
    """Internal webhook endpoint for external detection processes to trigger WebSocket broadcasts."""
    key = request.headers.get("X-Internal-Key")
    if key == INTERNAL_BROADCAST_KEY:
        await ws_manager.broadcast_json(event)
        return {"status": "broadcast_queued", "clients": len(ws_manager.active_connections)}

    auth_hdr = request.headers.get("Authorization", "")
    token = request.query_params.get("token")
    raw_tok = None
    if auth_hdr.startswith("Bearer "):
        raw_tok = auth_hdr.split(" ", 1)[1]
    elif token:
        raw_tok = token

    if not raw_tok or not verify_token_str(raw_tok):
        raise HTTPException(status_code=401, detail="Authentication required for external broadcast callers.")

    await ws_manager.broadcast_json(event)
    return {"status": "broadcast_queued", "clients": len(ws_manager.active_connections)}


# =====================================================================
# WebSocket Endpoint
# =====================================================================
@app.websocket("/ws/events")
async def websocket_events_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time security event streaming.
    Broadcasts live events as they occur in the video analytics pipeline.
    Requires valid token authentication during connection handshake.
    """
    # Authenticate client token during handshake
    user = None
    if is_auth_disabled():
        user = {"username": "demo_admin", "role": "admin"}
    elif token:
        user = verify_token_str(token)

    if not user:
        await websocket.close(code=4401, reason="Unauthorized: Valid authentication token required.")
        return

    await ws_manager.connect(websocket)

    # Send connection handshake acknowledgment
    try:
        await websocket.send_json(
            {
                "type": "connection_established",
                "message": "Connected to IBVAP Real-Time Security Event Stream",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        while True:
            try:
                # Wait for client keepalive messages with a 30s slice
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
            except asyncio.TimeoutError:
                # Slice timeout: send keepalive ping to verify client socket is open
                await websocket.send_json({"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# =====================================================================
# Production Static SPA Frontend Serving (Single-Link Deployment)
# =====================================================================
from fastapi.staticfiles import StaticFiles

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    images_dir = frontend_dist / "images"
    if images_dir.exists():
        app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")

    audit_images_dir = frontend_dist / "audit_images"
    if audit_images_dir.exists():
        app.mount("/audit_images", StaticFiles(directory=str(audit_images_dir)), name="audit_images")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(frontend_dist / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith(("api/", "api", "ws/", "ws", "docs", "openapi.json")):
            raise HTTPException(status_code=404, detail="Endpoint not found")
        target_file = frontend_dist / full_path
        if full_path and target_file.is_file():
            return FileResponse(str(target_file))
        return FileResponse(str(frontend_dist / "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "project": "IBVAP - Intelligent Border Video Analytics Platform",
            "status": "online",
            "phase": "Step 5 - React Command Center Dashboard",
            "auth_enabled": not is_auth_disabled(),
            "docs_url": "/docs",
            "ws_events_url": "/ws/events",
        }

