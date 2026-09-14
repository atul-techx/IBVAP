"""
IBVAP Cloud Object Storage & CDN Subsystem (Cloudinary Integration)
Ensures permanent storage for watchlist faces and forensic snapshots across ephemeral cloud redeployments.
"""

import os
import urllib.request
from pathlib import Path
from typing import Optional

_CLOUDINARY_INITIALIZED = False


def init_cloudinary() -> bool:
    """Initialize Cloudinary client using CLOUDINARY_URL or component API keys."""
    global _CLOUDINARY_INITIALIZED
    if _CLOUDINARY_INITIALIZED:
        return True

    cloudinary_url = os.getenv("CLOUDINARY_URL")
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not cloudinary_url and not (cloud_name and api_key and api_secret):
        return False

    try:
        import cloudinary
        if cloudinary_url:
            # Auto-configured via environment
            pass
        else:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )
        _CLOUDINARY_INITIALIZED = True
        print("[+] Cloudinary Cloud Storage INITIALIZED successfully.")
        return True
    except Exception as e:
        print(f"[!] Warning: Could not initialize Cloudinary: {e}")
        return False


def is_cloud_storage_configured() -> bool:
    """Check if cloud storage credentials are configured in environment."""
    return bool(
        os.getenv("CLOUDINARY_URL")
        or (
            os.getenv("CLOUDINARY_CLOUD_NAME")
            and os.getenv("CLOUDINARY_API_KEY")
            and os.getenv("CLOUDINARY_API_SECRET")
        )
    )


def upload_watchlist_image(image_input, public_id: Optional[str] = None) -> Optional[str]:
    """
    Upload a face image to Cloudinary CDN under folder 'ibvap/watchlist'.
    Args:
        image_input: File path (str/Path), file-like object, or raw image bytes.
        public_id: Optional clean filename without extension (e.g. 'capt_rajesh_kumar').
    Returns:
        Secure CDN URL string (e.g. 'https://res.cloudinary.com/...') or None if upload failed.
    """
    if not init_cloudinary():
        return None

    try:
        import cloudinary.uploader
        upload_options = {
            "folder": "ibvap/watchlist",
            "overwrite": True,
            "resource_type": "image",
        }
        if public_id:
            # Clean public_id for URL safety
            clean_id = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in public_id)
            upload_options["public_id"] = clean_id

        result = cloudinary.uploader.upload(image_input, **upload_options)
        secure_url = result.get("secure_url") or result.get("url")
        if secure_url:
            print(f"[+] Watchlist image uploaded to Cloudinary CDN: {secure_url}")
            return secure_url
    except Exception as e:
        print(f"[!] Cloudinary upload error: {e}")
    return None


def download_image_from_url(url: str, dest_path: Path) -> bool:
    """Download an image from Cloudinary CDN to local filesystem with error handling."""
    if not url or not str(url).startswith("http"):
        return False

    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "IBVAP-Surveillance-Engine/2.0"}
        )
        with urllib.request.urlopen(req, timeout=15.0) as resp:
            content = resp.read()
            if content and len(content) > 200:
                with open(dest_path, "wb") as f:
                    f.write(content)
                print(f"[+] Synced image from Cloud CDN to local disk: {dest_path.name} ({len(content)} bytes)")
                return True
    except Exception as e:
        print(f"[!] Failed to sync image from CDN ({url}): {e}")
    return False
