"""
Test suite for Gap-Fill Items:
- Item 25: Escalation Siren & SMS Webhook config API
- Item 26: Offline Video File Upload API
- Item 11: Custom polygon input handling in process_client_frame
"""

import sys
from pathlib import Path
repo_root = str(Path(__file__).resolve().parent.parent.parent)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.events import get_escalation_config, update_escalation_config

def test_escalation_config_endpoints():
    print("[*] Testing escalation config GET and POST endpoints...")
    client = TestClient(app)
    
    from backend.app.auth import create_access_token
    admin_token = create_access_token({"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/config/escalation", headers=headers)
    assert res.status_code == 200, f"GET /api/config/escalation failed: {res.status_code}, {res.text}"
    data = res.json()
    assert "enabled" in data
    assert "min_severity" in data
    print(f"    [+] Initial config: {data}")

    # Test updating escalation config
    from backend.app.auth import create_access_token
    admin_token = create_access_token({"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    update_payload = {
        "siren_webhook_url": "https://border-post-01.internal/api/siren",
        "sms_webhook_url": "https://sms-gateway.defence.gov.in/v1/send",
        "min_severity": "critical",
        "enabled": True
    }
    res_post = client.post("/api/config/escalation", json=update_payload, headers=headers)
    assert res_post.status_code == 200, f"POST /api/config/escalation failed: {res_post.status_code}, {res_post.text}"
    updated_data = res_post.json()
    assert updated_data["status"] == "success"
    assert updated_data["config"]["siren_webhook_url"] == "https://border-post-01.internal/api/siren"
    assert updated_data["config"]["min_severity"] == "critical"
    print("    [+] Successfully updated escalation settings!")


def test_offline_video_upload_endpoint():
    print("[*] Testing offline video upload endpoint...")
    client = TestClient(app)
    from backend.app.auth import create_access_token
    token = create_access_token({"sub": "officer1", "role": "operator"})
    headers = {"Authorization": f"Bearer {token}"}

    # Dummy small mp4 payload
    dummy_bytes = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200
    files = {"file": ("test_surveillance_clip.mp4", dummy_bytes, "video/mp4")}

    res = client.post("/api/video/upload", files=files, headers=headers)
    assert res.status_code == 200, f"POST /api/video/upload failed: {res.status_code}, {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert "upload_test_surveillance_clip_" in data["filename"]
    print(f"    [+] Video uploaded successfully as: {data['filename']}")

    # Clean up test uploaded file
    app_dir = Path(__file__).resolve().parent
    test_videos_dir = app_dir.parent / "test_videos"
    dest_path = test_videos_dir / data["filename"]
    if dest_path.exists():
        dest_path.unlink()
        print(f"    [+] Cleaned up test file: {dest_path.name}")


def test_custom_polygon_frame_request():
    print("[*] Testing ClientFrameRequest with custom polygon...")
    import cv2
    import numpy as np
    import base64

    # Create dummy black frame with white circle
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(frame, (320, 240), 50, (255, 255, 255), -1)
    _, buffer = cv2.imencode('.jpg', frame)
    b64_str = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    client = TestClient(app)
    from backend.app.auth import create_access_token
    token = create_access_token({"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    custom_poly = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.9], [0.1, 0.9]]
    payload = {
        "image": b64_str,
        "camera_id": "CAM_01",
        "show_zone": True,
        "custom_polygon": custom_poly
    }
    res = client.post("/api/stream/process-client-frame", json=payload, headers=headers)
    assert res.status_code == 200, f"process-client-frame failed: {res.status_code}, {res.text}"
    data = res.json()
    assert data["status"] == "success"
    print("    [+] Successfully processed client frame with custom polygon!")


if __name__ == "__main__":
    test_escalation_config_endpoints()
    test_offline_video_upload_endpoint()
    test_custom_polygon_frame_request()
    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")
