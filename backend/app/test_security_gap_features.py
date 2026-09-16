"""
Test Suite for Items 13, 15, 16, 17:
- Item 13: One-way / Wrong-direction detection on a tripwire/corridor
- Item 15: Animal vs human false positive filtering (Wildlife detection & suppression)
- Item 16: Foliage/wind false positive filtering
- Item 17: Optical camera tampering detection (lens covered, blinding, angle shift)
"""
import sys
import numpy as np
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.detection_tracking import (
    SuspiciousBehaviorDetector,
    OpticalTamperDetector,
    WILDLIFE_CLASSES,
)


def test_wrong_direction_detection():
    print("\n--- [TEST 1] Testing Wrong-Direction Traversal Detection (Item 13) ---")
    detector = SuspiciousBehaviorDetector()
    # Authorized flow direction is downward / inbound: (0.0, 1.0)
    detector.authorized_flow_direction = (0.0, 1.0)
    
    tracker_id = 99
    # Track moving in authorized downward direction: (cx, cy) increasing in y
    events_normal = []
    for f in range(20):
        ev = detector.update(
            tracker_id=tracker_id,
            cls_name="person",
            center_pt=(200, 100 + f * 5),
            is_inside=True,
            dist_to_zone=0.0,
            frame_idx=f,
        )
        events_normal.extend(ev)
    assert "wrong_way_direction" not in events_normal
    print("  [+] Authorized direction traversal: No wrong-way alert triggered.")

    # New track moving in reverse upward direction: (cx, cy) decreasing in y
    tracker_wrong = 100
    events_wrong = []
    for f in range(25):
        ev = detector.update(
            tracker_id=tracker_wrong,
            cls_name="person",
            center_pt=(200, 300 - f * 6),
            is_inside=True,
            dist_to_zone=0.0,
            frame_idx=f,
        )
        events_wrong.extend(ev)
    assert "wrong_way_direction" in events_wrong
    assert detector.get_active_behavior(tracker_wrong) == "WRONG_WAY"
    print("  [+] Reverse / wrong-way traversal: 'wrong_way_direction' alert triggered and verified!")


def test_wildlife_classes():
    print("\n--- [TEST 2] Testing Wildlife & Animal Class Filtering (Item 15) ---")
    common_stray_animals = ["dog", "cat", "cow", "horse", "sheep", "bird"]
    for animal in common_stray_animals:
        assert animal in WILDLIFE_CLASSES
        print(f"  [+] Wildlife class mapped: '{animal}' (COCO ID: {WILDLIFE_CLASSES[animal]})")


def test_foliage_wind_suppressor():
    print("\n--- [TEST 3] Testing Foliage / Wind Oscillation Filter (Item 16) ---")
    detector = SuspiciousBehaviorDetector()
    tracker_foliage = 50
    # Simulate swaying branch oscillating back and forth (+4, -4) around anchor (100, 100)
    for f in range(30):
        jitter_x = 4 if (f % 2 == 0) else -4
        jitter_y = 2 if (f % 4 < 2) else -2
        detector.update(
            tracker_id=tracker_foliage,
            cls_name="person",
            center_pt=(100 + jitter_x, 100 + jitter_y),
            is_inside=True,
            dist_to_zone=0.0,
            frame_idx=f,
        )
    is_foliage = detector.is_foliage_or_wind(tracker_foliage)
    assert is_foliage is True, "Expected wind-swayed foliage to be recognized and suppressed"
    print("  [+] Wind-swayed foliage oscillation accurately recognized and suppressed!")


def test_optical_camera_tampering():
    print("\n--- [TEST 4] Testing Optical Camera Tampering Detection (Item 17) ---")
    tamper = OpticalTamperDetector(alert_cooldown_frames=10)
    
    # Normal textured surveillance frame
    normal_frame = np.random.randint(50, 180, (480, 640, 3), dtype=np.uint8)
    res_normal = tamper.evaluate_frame(normal_frame, frame_idx=1)
    assert res_normal is None
    print("  [+] Normal surveillance frame: No tamper alert.")

    # 1. Lens Covered / Blackout (Spray paint / cloth)
    black_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    tamper_black = None
    for f in range(5):
        r = tamper.evaluate_frame(black_frame, frame_idx=10 + f)
        if r and r.get("is_tampered"):
            tamper_black = r
    assert tamper_black is not None
    assert tamper_black["cause"] == "lens_covered_or_occluded"
    print(f"  [+] Lens covered / blacked out: Detected '{tamper_black['cause']}'")

    # Reset with normal frames
    for f in range(5):
        tamper.evaluate_frame(normal_frame, frame_idx=20 + f)

    # 2. Camera Blinded (Laser / Directed flashlight / High-beam)
    white_frame = np.full((480, 640, 3), 255, dtype=np.uint8)
    tamper_white = None
    for f in range(5):
        r = tamper.evaluate_frame(white_frame, frame_idx=40 + f)
        if r and r.get("is_tampered"):
            tamper_white = r
    assert tamper_white is not None
    assert tamper_white["cause"] == "camera_blinded_overexposure"
    print(f"  [+] Camera blinded / overexposed: Detected '{tamper_white['cause']}'")

    # 3. Abrupt Camera Angle Shift (Camera bumped / turned 90 degrees)
    angle_frame = np.full((480, 640, 3), 100, dtype=np.uint8)
    tamper.prev_small_gray = np.zeros((90, 160), dtype=np.uint8)
    tamper_shift = None
    for f in range(5):
        r = tamper.evaluate_frame(angle_frame, frame_idx=60 + f)
        if r and r.get("is_tampered"):
            tamper_shift = r
    assert tamper_shift is not None
    assert tamper_shift["cause"] == "camera_angle_shifted_or_displaced"
    print(f"  [+] Abrupt camera angle shift: Detected '{tamper_shift['cause']}'")


if __name__ == "__main__":
    print("==================================================================")
    print("  IBVAP Security Gap Features Test Suite (Items 13, 15, 16, 17)")
    print("==================================================================")
    test_wrong_direction_detection()
    test_wildlife_classes()
    test_foliage_wind_suppressor()
    test_optical_camera_tampering()
    print("\n[SUCCESS] All security gap feature tests PASSED!")
