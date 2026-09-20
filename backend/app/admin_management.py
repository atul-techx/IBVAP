"""
IBVAP - Tactical Admin Management Module
Provides backend database management and validation for:
1. Authorized Personnel Watchlist (with photo management and expiry dates)
2. Authorized Vehicles Whitelist (with ANPR plate normalization and expiry dates)
3. On-demand Watchlist embedding re-synchronization
"""

import base64
import csv
import io
import os
import re
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    from backend.app.db_engine import get_db_connection, is_postgres
    from backend.app.cloud_storage import (
        upload_watchlist_image,
        download_image_from_url,
        is_cloud_storage_configured,
    )
except ImportError:
    try:
        from db_engine import get_db_connection, is_postgres
        from cloud_storage import (
            upload_watchlist_image,
            download_image_from_url,
            is_cloud_storage_configured,
        )
    except ImportError:
        get_db_connection = None
        is_postgres = lambda: False
        upload_watchlist_image = lambda *a, **k: None
        download_image_from_url = lambda *a, **k: False
        is_cloud_storage_configured = lambda: False


def get_default_db_path() -> Path:
    """Get default SQLite database path."""
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / "ibvap.db"


def get_watchlist_dir() -> Path:
    """Get default watchlist photos directory."""
    backend_dir = Path(__file__).resolve().parent.parent
    watchlist_dir = backend_dir / "watchlist"
    watchlist_dir.mkdir(parents=True, exist_ok=True)
    return watchlist_dir


def normalize_plate(plate_number: Optional[str]) -> str:
    """Normalize license plate text by stripping punctuation/whitespace and converting to uppercase."""
    if not plate_number:
        return ""
    return re.sub(r"[^A-Z0-9]", "", str(plate_number).upper())


def is_expired(expiry_date: Optional[str]) -> bool:
    """
    Check if an expiry date has passed relative to current UTC date.
    Returns False if expiry_date is None or empty (i.e. permanently authorized).
    """
    if not expiry_date or not str(expiry_date).strip():
        return False

    clean_str = str(expiry_date).strip()
    try:
        if "T" in clean_str:
            clean_str = clean_str.split("T")[0]
        elif " " in clean_str:
            clean_str = clean_str.split(" ")[0]

        parts = [int(p) for p in clean_str.split("-") if p.isdigit()]
        if len(parts) >= 3:
            exp_date = datetime(parts[0], parts[1], parts[2], tzinfo=timezone.utc).date()
            today_utc = datetime.now(timezone.utc).date()
            return exp_date < today_utc
    except Exception:
        pass
    return False


def init_admin_tables(db_path: Optional[Path] = None):
    """
    Initialize database tables for watchlist personnel and authorized vehicles.
    Supports both PostgreSQL and SQLite transparently.
    Automatically seeds initial records for existing reference images and sample vehicles.
    """
    if db_path is None:
        db_path = get_default_db_path()

    pg_mode = is_postgres()
    id_type = "SERIAL PRIMARY KEY" if pg_mode else "INTEGER PRIMARY KEY AUTOINCREMENT"

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()

        # 1. Watchlist Personnel Table
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS watchlist_personnel (
                id {id_type},
                name TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL DEFAULT 'SSB Personnel',
                photo_filename TEXT NOT NULL,
                image_url TEXT,
                face_embedding TEXT,
                expiry_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Ensure image_url and face_embedding columns exist if table was created previously
        try:
            cursor.execute("ALTER TABLE watchlist_personnel ADD COLUMN image_url TEXT")
            conn.commit()
        except Exception:
            pass

        try:
            cursor.execute("ALTER TABLE watchlist_personnel ADD COLUMN face_embedding TEXT")
            conn.commit()
        except Exception:
            pass

        try:
            cursor.execute("ALTER TABLE watchlist_personnel ADD COLUMN photo_base64 TEXT")
            conn.commit()
        except Exception:
            pass

        # 2. Authorized Vehicles Whitelist Table
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS authorized_vehicles (
                id {id_type},
                plate_number TEXT UNIQUE NOT NULL,
                owner_name TEXT NOT NULL,
                vehicle_type TEXT NOT NULL DEFAULT 'Patrol Vehicle',
                purpose TEXT NOT NULL DEFAULT 'Official Duty',
                expiry_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

        # Seed existing photo files from backend/watchlist/ if watchlist_personnel is empty
        cursor.execute("SELECT COUNT(*) FROM watchlist_personnel")
        count_wl = cursor.fetchone()[0]
        if count_wl == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            watchlist_dir = get_watchlist_dir()
            default_roles = {
                "kunal": "SSB Personnel",
                "aditya": "Border Patrol Officer",
                "akanksha": "Command Staff",
                "anshika": "Border Patrol Officer",
                "atul": "Surveillance Operator",
                "hardik": "Field Patrol Specialist",
            }

            for p in sorted(watchlist_dir.iterdir()):
                if p.suffix.lower() in [".png", ".jpg", ".jpeg"]:
                    stem_clean = p.stem.strip()
                    display_name = stem_clean.replace("_", " ").title()
                    role = default_roles.get(stem_clean.lower(), "SSB Personnel")

                    cdn_url = None
                    if is_cloud_storage_configured():
                        cdn_url = upload_watchlist_image(p, public_id=stem_clean.lower())

                    b64_str = None
                    try:
                        with open(p, "rb") as pf:
                            b64_str = base64.b64encode(pf.read()).decode("utf-8")
                    except Exception:
                        pass

                    cursor.execute(
                        """
                        INSERT INTO watchlist_personnel
                        (name, role, photo_filename, image_url, photo_base64, expiry_date, notes, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, NULL, 'Pre-configured reference profile', ?, ?)
                        ON CONFLICT (name) DO NOTHING
                        """,
                        (display_name, role, p.name, cdn_url, b64_str, now_iso, now_iso),
                    )
            conn.commit()

        # Seed initial authorized vehicles if table is empty
        cursor.execute("SELECT COUNT(*) FROM authorized_vehicles")
        count_veh = cursor.fetchone()[0]
        if count_veh == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            default_vehicles = [
                ("DL 01 AB 1234", "Capt. Rajesh Kumar", "Patrol Jeep", "Sector 4 Perimeter Patrol", None, "Command Escort Vehicle"),
                ("JK 02 CD 5678", "Subedar Major Singh", "Supply Truck", "Ration & Ammo Logistics", None, "Battalion Logistics Unit"),
                ("HR 26 EF 9012", "Dr. A. Verma", "Medical Ambulance", "Emergency Medical Support", None, "Perimeter Quick Response Unit"),
            ]
            for plate, owner, vtype, purpose, exp, notes in default_vehicles:
                cursor.execute(
                    """
                    INSERT INTO authorized_vehicles
                    (plate_number, owner_name, vehicle_type, purpose, expiry_date, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (plate_number) DO NOTHING
                    """,
                    (plate, owner, vtype, purpose, exp, notes, now_iso, now_iso),
                )
            conn.commit()

def sync_cloud_watchlist_to_disk(watchlist_dir: Optional[Path] = None, db_path: Optional[Path] = None) -> int:
    """
    Restore and synchronize watchlist photos from database (photo_base64) and Cloudinary CDN to local disk.
    Ensures photos survive container redeployments seamlessly without data loss.
    """
    if watchlist_dir is None:
        watchlist_dir = get_watchlist_dir()
    watchlist_dir.mkdir(parents=True, exist_ok=True)

    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    synced_count = 0
    try:
        with get_db_connection(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name, photo_filename, image_url, photo_base64 FROM watchlist_personnel")
            records = cursor.fetchall_dicts()

            for rec in records:
                name = rec.get("name", "").strip()
                photo_file = (rec.get("photo_filename") or "").strip()
                image_url = rec.get("image_url")
                photo_b64 = rec.get("photo_base64")
                if not name or not photo_file or photo_file == "default_avatar.png":
                    continue

                safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", name.lower())
                target_file = watchlist_dir / photo_file

                # Priority 1: Restore directly from PostgreSQL photo_base64
                if (not target_file.exists() or target_file.stat().st_size < 200) and photo_b64:
                    try:
                        raw_bytes = base64.b64decode(photo_b64)
                        with open(target_file, "wb") as f:
                            f.write(raw_bytes)
                        synced_count += 1
                        print(f"[+] Restored watchlist photo '{photo_file}' for '{name}' directly from PostgreSQL DB!")
                        continue
                    except Exception as err:
                        print(f"[!] DB photo decode notice for '{name}': {err}")

                # Priority 2: Restore from Cloudinary CDN if URL exists
                if (not target_file.exists() or target_file.stat().st_size < 200) and image_url:
                    print(f"[*] Restoring watchlist photo for '{name}' from Cloudinary CDN: {image_url}")
                    ok = download_image_from_url(image_url, target_file)
                    if ok:
                        synced_count += 1

                # Priority 3: If local photo exists, ensure photo_base64 in DB is populated
                if target_file.exists() and target_file.stat().st_size >= 200 and not photo_b64:
                    try:
                        with open(target_file, "rb") as pf:
                            b64_val = base64.b64encode(pf.read()).decode("utf-8")
                        cursor.execute(
                            "UPDATE watchlist_personnel SET photo_base64 = ? WHERE LOWER(name) = LOWER(?)",
                            (b64_val, name),
                        )
                        conn.commit()
                    except Exception:
                        pass

                # Priority 4: Upload to Cloudinary if configured and image_url is missing
                if is_cloud_storage_configured() and not image_url and target_file.exists() and target_file.stat().st_size >= 200:
                    cdn_url = upload_watchlist_image(target_file, public_id=safe_stem)
                    if cdn_url:
                        cursor.execute(
                            "UPDATE watchlist_personnel SET image_url = ? WHERE LOWER(name) = LOWER(?)",
                            (cdn_url, name),
                        )
                        conn.commit()
    except Exception as e:
        print(f"[!] Warning during sync_cloud_watchlist_to_disk: {e}")

    return synced_count


# =====================================================================
# Watchlist Personnel CRUD Operations
# =====================================================================
def get_all_watchlist_personnel(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve all watchlist personnel profiles with real-time expiry evaluation."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM watchlist_personnel ORDER BY name ASC")
        rows = cursor.fetchall_dicts()
        results = []
        for d in rows:
            d["is_expired"] = is_expired(d.get("expiry_date"))
            # Prefer Cloudinary CDN URL if available for permanent delivery
            d["photo_url"] = d.get("image_url") or f"/api/admin/watchlist/photo/{d['photo_filename']}"
            results.append(d)
        return results


def get_watchlist_person(name: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Lookup a single watchlist person by name."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM watchlist_personnel WHERE LOWER(name) = LOWER(?)", (name.strip(),))
        d = cursor.fetchone_dict()
        if not d:
            return None
        d["is_expired"] = is_expired(d.get("expiry_date"))
        d["photo_url"] = d.get("image_url") or f"/api/admin/watchlist/photo/{d['photo_filename']}"
        return d


def check_watchlist_person_active(name: Optional[str], db_path: Optional[Path] = None) -> bool:
    """
    Evaluate if an identified person is active on the authorized watchlist.
    Returns False if expired (logs note) or if unlisted.
    """
    if not name or not isinstance(name, str) or name.upper() == "UNKNOWN":
        return False

    person = get_watchlist_person(name, db_path=db_path)
    if person:
        if person["is_expired"]:
            print(f"[!] Expired watchlist profile skipped: '{name}' (Expired on {person['expiry_date']})")
            return False
        return True

    # If file exists in watchlist folder but not yet in DB, treat as active
    clean_name = name.strip().replace(" ", "_").lower()
    for ext in [".png", ".jpg", ".jpeg"]:
        p = get_watchlist_dir() / f"{clean_name}{ext}"
        if p.exists():
            return True
    return False


def add_or_update_watchlist_person(
    name: str,
    role: str = "SSB Personnel",
    photo_filename: str = "",
    image_url: Optional[str] = None,
    face_embedding: Optional[str] = None,
    expiry_date: Optional[str] = None,
    notes: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Add or update an authorized person in PostgreSQL/SQLite and Cloudinary."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    now_iso = datetime.now(timezone.utc).isoformat()
    clean_name = name.strip()
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", clean_name.lower())
    watchlist_dir = get_watchlist_dir()

    photo_file = photo_filename.strip() if photo_filename else ""
    if not photo_file or photo_file.lower() in ("none", "null"):
        for ext in [".png", ".jpg", ".jpeg", ".webp"]:
            if (watchlist_dir / f"{safe_stem}{ext}").exists():
                photo_file = f"{safe_stem}{ext}"
                break
        if not photo_file:
            photo_file = "default_avatar.png"

    # Auto-upload to Cloudinary if image_url is missing but local file exists
    final_image_url = image_url
    if not final_image_url and photo_file and photo_file != "default_avatar.png":
        local_p = watchlist_dir / photo_file
        if local_p.exists() and is_cloud_storage_configured():
            final_image_url = upload_watchlist_image(local_p, public_id=safe_stem)

    # Convert photo to base64 so it is permanently preserved directly in PostgreSQL
    photo_b64 = None
    if photo_file and photo_file != "default_avatar.png":
        local_p = watchlist_dir / photo_file
        if local_p.exists() and local_p.stat().st_size > 100:
            try:
                with open(local_p, "rb") as pf:
                    photo_b64 = base64.b64encode(pf.read()).decode("utf-8")
            except Exception:
                pass

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO watchlist_personnel (name, role, photo_filename, image_url, face_embedding, photo_base64, expiry_date, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                role = excluded.role,
                photo_filename = CASE 
                    WHEN excluded.photo_filename != '' AND excluded.photo_filename != 'default_avatar.png' THEN excluded.photo_filename 
                    ELSE watchlist_personnel.photo_filename 
                END,
                image_url = COALESCE(excluded.image_url, watchlist_personnel.image_url),
                face_embedding = COALESCE(excluded.face_embedding, watchlist_personnel.face_embedding),
                photo_base64 = COALESCE(excluded.photo_base64, watchlist_personnel.photo_base64),
                expiry_date = excluded.expiry_date,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            """,
            (clean_name, role.strip(), photo_file, final_image_url, face_embedding, photo_b64, expiry_date or None, notes or None, now_iso, now_iso),
        )
        conn.commit()

    return get_watchlist_person(clean_name, db_path=db_path) or {}


def delete_watchlist_person(name: str, db_path: Optional[Path] = None) -> bool:
    """Delete person from database and remove their photo from backend/watchlist/."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    clean_name = name.strip()
    person = get_watchlist_person(clean_name, db_path=db_path)
    if not person:
        return False

    photo_filename = person.get("photo_filename")
    if photo_filename:
        photo_path = get_watchlist_dir() / photo_filename
        if photo_path.exists():
            try:
                photo_path.unlink()
            except Exception as e:
                print(f"[!] Warning: Could not delete photo file {photo_path}: {e}")

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM watchlist_personnel WHERE LOWER(name) = LOWER(?)", (clean_name,))
        conn.commit()

    return True


# =====================================================================
# Authorized Vehicles Whitelist CRUD Operations
# =====================================================================
def get_all_authorized_vehicles(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve all authorized vehicles with real-time expiry evaluation."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM authorized_vehicles ORDER BY plate_number ASC")
        rows = cursor.fetchall_dicts()
        results = []
        for d in rows:
            d["is_expired"] = is_expired(d.get("expiry_date"))
            d["normalized_plate"] = normalize_plate(d["plate_number"])
            results.append(d)
        return results


def check_authorized_vehicle(plate_number: Optional[str], db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """
    Evaluate if an ANPR license plate matches an active, non-expired authorized vehicle.
    Returns vehicle record if authorized and active, or None if unlisted or expired (logs note on expiry).
    """
    if not plate_number or not isinstance(plate_number, str):
        return None

    cand_norm = normalize_plate(plate_number)
    if not cand_norm or len(cand_norm) < 4:
        return None

    vehicles = get_all_authorized_vehicles(db_path=db_path)
    for v in vehicles:
        if v["normalized_plate"] == cand_norm:
            if v["is_expired"]:
                print(f"[!] Expired authorized vehicle skipped: '{plate_number}' (Owner: {v['owner_name']}, Expired: {v['expiry_date']})")
                return None
            return v

    return None


def add_or_update_authorized_vehicle(
    plate_number: str,
    owner_name: str,
    vehicle_type: str = "Patrol Vehicle",
    purpose: str = "Official Duty",
    expiry_date: Optional[str] = None,
    notes: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Add or update an authorized vehicle in PostgreSQL/SQLite."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    now_iso = datetime.now(timezone.utc).isoformat()
    clean_plate = plate_number.strip().upper()

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO authorized_vehicles (plate_number, owner_name, vehicle_type, purpose, expiry_date, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plate_number) DO UPDATE SET
                owner_name = excluded.owner_name,
                vehicle_type = excluded.vehicle_type,
                purpose = excluded.purpose,
                expiry_date = excluded.expiry_date,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            """,
            (
                clean_plate,
                owner_name.strip(),
                vehicle_type.strip(),
                purpose.strip(),
                expiry_date.strip() if expiry_date else None,
                notes.strip() if notes else None,
                now_iso,
                now_iso,
            ),
        )
        conn.commit()

    vehicles = get_all_authorized_vehicles(db_path=db_path)
    for v in vehicles:
        if normalize_plate(v["plate_number"]) == normalize_plate(clean_plate):
            return v
    return {}


def delete_authorized_vehicle(plate_number: str, db_path: Optional[Path] = None) -> bool:
    """Remove a vehicle from the authorized whitelist."""
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    target_norm = normalize_plate(plate_number)
    vehicles = get_all_authorized_vehicles(db_path=db_path)
    exact_plate = None
    for v in vehicles:
        if v["normalized_plate"] == target_norm:
            exact_plate = v["plate_number"]
            break

    if not exact_plate:
        return False

    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM authorized_vehicles WHERE plate_number = ?", (exact_plate,))
        conn.commit()

    return True


# =====================================================================
# Bulk Import & Tabular Parsing Engine (CSV & Excel .xlsx)
# =====================================================================
def normalize_date_input(val: Any) -> Optional[str]:
    """Normalize various date representations (Excel datetime, DD/MM/YYYY, ISO) to YYYY-MM-DD."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "permanent", "na", "n/a", "-", "nil"):
        return None
    s = s.split("T")[0].split(" ")[0]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
    if m:
        return f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return s


def parse_tabular_file(contents: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parse uploaded CSV or Excel (.xlsx) file into a list of row dicts.
    """
    ext = Path(filename).suffix.lower()
    rows: List[Dict[str, Any]] = []

    if ext in [".xlsx", ".xlsm", ".xltx", ".xltm"]:
        if openpyxl is None:
            raise RuntimeError("Excel parsing module 'openpyxl' is not installed.")
        wb = openpyxl.load_workbook(filename=io.BytesIO(contents), data_only=True)
        ws = wb.active
        all_values = list(ws.iter_rows(values_only=True))
        if not all_values:
            return []
        header_idx = -1
        headers = []
        for i, r in enumerate(all_values):
            if any(cell is not None and str(cell).strip() for cell in r):
                header_idx = i
                headers = [str(c).strip() if c is not None else f"col_{j}" for j, c in enumerate(r)]
                break
        if header_idx == -1:
            return []

        for r in all_values[header_idx + 1:]:
            if not any(cell is not None and str(cell).strip() for cell in r):
                continue
            row_dict = {}
            for j, val in enumerate(r):
                if j < len(headers):
                    key = headers[j]
                    row_dict[key] = val
            rows.append(row_dict)

    elif ext in [".csv", ".tsv", ".txt"]:
        text = None
        for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
            try:
                text = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            text = contents.decode("utf-8", errors="replace")

        first_lines = "\n".join(text.splitlines()[:5])
        delimiter = ","
        try:
            dialect = csv.Sniffer().sniff(first_lines, delimiters=",\t;|")
            delimiter = dialect.delimiter
        except Exception:
            if "\t" in first_lines:
                delimiter = "\t"
            elif ";" in first_lines:
                delimiter = ";"

        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        for r in reader:
            if any(v and str(v).strip() for v in r.values()):
                clean_row = {str(k).strip(): v for k, v in r.items() if k is not None}
                rows.append(clean_row)
    else:
        raise ValueError(f"Unsupported file format '{ext}'. Please upload a CSV (.csv) or Excel (.xlsx) file.")

    return rows


def bulk_import_watchlist_personnel(
    rows: List[Dict[str, Any]],
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Process rows parsed from CSV or Excel and insert/update authorized personnel.
    """
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    total = len(rows)
    added = 0
    updated = 0
    errors: List[str] = []
    imported_names: List[str] = []

    for idx, raw in enumerate(rows, start=1):
        try:
            norm_map = {re.sub(r"[^a-z0-9]", "", str(k).lower()): v for k, v in raw.items()}

            def get_f(keys: List[str], default=None):
                for k in keys:
                    if k in norm_map and norm_map[k] is not None:
                        s = str(norm_map[k]).strip()
                        if s:
                            return norm_map[k]
                return default

            name_val = get_f(["name", "fullname", "personname", "personnelname", "officername", "authorizedperson"])
            if not name_val:
                errors.append(f"Row {idx}: Skipped (Missing required 'Name' column)")
                continue

            name = str(name_val).strip()
            if not name or name.lower() in ("name", "full name", "n/a", "none"):
                continue

            role_val = get_f(["role", "category", "designation", "unit", "rank", "rolecategory", "position"], default="SSB Personnel")
            role = str(role_val).strip() if role_val else "SSB Personnel"

            exp_val = get_f(["expirydate", "expiry", "validtill", "validuntil", "expirationdate", "dateofexpiry", "validupto"])
            expiry_date = normalize_date_input(exp_val)

            notes_val = get_f(["notes", "remarks", "comment", "comments", "operationalnotes", "description", "gatepass"])
            notes = str(notes_val).strip() if notes_val else None

            photo_val = get_f(["photofilename", "photo", "image", "photofile", "picture", "avatar", "portrait"])
            photo_filename = str(photo_val).strip() if photo_val else ""

            existing = get_watchlist_person(name, db_path=db_path)
            add_or_update_watchlist_person(
                name=name,
                role=role,
                photo_filename=photo_filename,
                expiry_date=expiry_date,
                notes=notes,
                db_path=db_path,
            )
            if existing:
                updated += 1
            else:
                added += 1
            imported_names.append(name)

        except Exception as e:
            errors.append(f"Row {idx} ('{raw.get('name', 'Unknown')}'): {str(e)}")

    return {
        "status": "success",
        "total_records": total,
        "added": added,
        "updated": updated,
        "errors": errors,
        "imported_names": imported_names,
    }


def bulk_import_authorized_vehicles(
    rows: List[Dict[str, Any]],
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Process rows parsed from CSV or Excel and insert/update authorized vehicles.
    """
    if db_path is None:
        db_path = get_default_db_path()
    init_admin_tables(db_path)

    total = len(rows)
    added = 0
    updated = 0
    errors: List[str] = []
    imported_plates: List[str] = []

    for idx, raw in enumerate(rows, start=1):
        try:
            norm_map = {re.sub(r"[^a-z0-9]", "", str(k).lower()): v for k, v in raw.items()}

            def get_f(keys: List[str], default=None):
                for k in keys:
                    if k in norm_map and norm_map[k] is not None:
                        s = str(norm_map[k]).strip()
                        if s:
                            return norm_map[k]
                return default

            plate_val = get_f(["platenumber", "plate", "vehiclenumber", "registrationnumber", "rcnumber", "vehicleno"])
            if not plate_val:
                errors.append(f"Row {idx}: Skipped (Missing required 'Plate Number' column)")
                continue

            plate = str(plate_val).strip().upper()
            if not plate:
                continue

            owner_val = get_f(["ownername", "owner", "driver", "assignedto", "officer", "unit"], default="Official Border Patrol Unit")
            owner_name = str(owner_val).strip() if owner_val else "Official Border Patrol Unit"

            vtype_val = get_f(["vehicletype", "type", "category", "model"], default="Patrol Vehicle")
            vehicle_type = str(vtype_val).strip() if vtype_val else "Patrol Vehicle"

            purpose_val = get_f(["purpose", "duty", "assignment", "mission", "reason"], default="Official Duty")
            purpose = str(purpose_val).strip() if purpose_val else "Official Duty"

            exp_val = get_f(["expirydate", "expiry", "validtill", "validuntil", "expirationdate"])
            expiry_date = normalize_date_input(exp_val)

            notes_val = get_f(["notes", "remarks", "comment", "description"])
            notes = str(notes_val).strip() if notes_val else None

            existing = check_authorized_vehicle(plate, db_path=db_path)
            add_or_update_authorized_vehicle(
                plate_number=plate,
                owner_name=owner_name,
                vehicle_type=vehicle_type,
                purpose=purpose,
                expiry_date=expiry_date,
                notes=notes,
                db_path=db_path,
            )
            if existing:
                updated += 1
            else:
                added += 1
            imported_plates.append(plate)

        except Exception as e:
            errors.append(f"Row {idx} ('{raw.get('plate_number', 'Unknown')}'): {str(e)}")

    return {
        "status": "success",
        "total_records": total,
        "added": added,
        "updated": updated,
        "errors": errors,
        "imported_plates": imported_plates,
    }


def generate_sample_template(target: str = "personnel", format_type: str = "csv") -> Tuple[bytes, str, str]:
    """
    Generate downloadable sample template in CSV or Excel format.
    Returns (bytes_data, media_type, filename).
    """
    format_type = format_type.lower()
    if target == "personnel":
        headers = ["Full Name", "Role / Unit", "Expiry Date", "Operational Notes", "Photo Filename"]
        sample_rows = [
            ["Capt. Vikram Batra", "Command Staff", "2026-12-31", "Perimeter Sector 4 Commander", "batra.jpg"],
            ["Subedar Major Joginder", "Border Patrol Officer", "", "QRT Bravo Team Leader", ""],
            ["Constable Ramesh Singh", "SSB Personnel", "2026-10-15", "Checkpoint Delta Guard", "ramesh.png"],
            ["Dr. Neha Sharma", "Medical Officer", "2027-01-01", "Base Hospital Staff", ""],
        ]
        base_name = "ibvap_authorized_personnel_template"
    else:
        headers = ["Plate Number", "Owner Name", "Vehicle Type", "Purpose", "Expiry Date", "Operational Notes"]
        sample_rows = [
            ["DL 01 AB 1234", "Capt. Rajesh Kumar", "Patrol Jeep", "Sector 4 Perimeter Patrol", "2026-12-31", "Command Escort"],
            ["JK 02 CD 5678", "Subedar Major Singh", "Supply Truck", "Ration & Ammo Logistics", "", "Battalion Unit"],
            ["HR 26 EF 9012", "Dr. A. Verma", "Medical Ambulance", "Emergency Medical Support", "2027-05-30", "Quick Response"],
        ]
        base_name = "ibvap_authorized_vehicles_template"

    if format_type in ["xlsx", "excel"]:
        if openpyxl is None:
            raise RuntimeError("Excel module 'openpyxl' not installed.")
        from openpyxl.styles import Alignment, Font, PatternFill
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Template"
        ws.append(headers)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        for col_num, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            ws.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = max(len(h) + 6, 22)

        for row_data in sample_rows:
            ws.append(row_data)

        buf = io.BytesIO()
        wb.save(buf)
        return (
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{base_name}.xlsx",
        )
    else:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        for row in sample_rows:
            writer.writerow(row)
        return (
            buf.getvalue().encode("utf-8-sig"),
            "text/csv; charset=utf-8",
            f"{base_name}.csv",
        )
