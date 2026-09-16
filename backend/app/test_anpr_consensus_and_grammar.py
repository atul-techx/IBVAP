"""
Test Suite for Items 4 & 14:
- Item 4: ANPR license plate recognition multi-frame voting consensus
- Item 14: Indian license plate format validation (standard state, Bharat Series, Defense)
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.detection_tracking import (
    validate_indian_plate_grammar,
    MultiFramePlateVoter,
    format_plate_string,
)


def test_indian_plate_grammar():
    print("\n--- [TEST 1] Testing Indian Plate Format Validation (Item 14) ---")
    
    # 1. Standard State/UT plates
    cases_valid_std = [
        ("DL01AB1234", "DL 01 AB 1234", "standard_state", "DL"),
        ("UP 14 AN 9999", "UP 14 AN 9999", "standard_state", "UP"),
        ("MH02CR0001", "MH 02 CR 0001", "standard_state", "MH"),
        ("HR26DK8337", "HR 26 DK 8337", "standard_state", "HR"),
        ("JK01TR5555", "JK 01 TR 5555", "standard_state", "JK"),
        ("PB10XY7788", "PB 10 XY 7788", "standard_state", "PB"),
        ("KA05MB4321", "KA 05 MB 4321", "standard_state", "KA"),
    ]
    for raw, expected_fmt, expected_type, expected_state in cases_valid_std:
        res = validate_indian_plate_grammar(raw)
        assert res["is_valid"] is True, f"Failed for {raw}: {res}"
        assert res["format_type"] == expected_type, f"Wrong type for {raw}: {res}"
        assert res["state_code"] == expected_state, f"Wrong state for {raw}: {res}"
        assert res["formatted"] == expected_fmt, f"Wrong format for {raw}: {res}"
        print(f"  [+] Valid Standard Plate: '{raw}' -> '{res['formatted']}' ({res['state_code']})")

    # 2. Bharat Series (BH)
    cases_valid_bh = [
        ("22BH1234AA", "22 BH 1234 AA", "bharat_series"),
        ("24 BH 9001 Z", "24 BH 9001 Z", "bharat_series"),
    ]
    for raw, expected_fmt, expected_type in cases_valid_bh:
        res = validate_indian_plate_grammar(raw)
        assert res["is_valid"] is True, f"Failed for {raw}: {res}"
        assert res["format_type"] == expected_type, f"Wrong type for {raw}: {res}"
        assert res["formatted"] == expected_fmt, f"Wrong format for {raw}: {res}"
        print(f"  [+] Valid Bharat Series (BH): '{raw}' -> '{res['formatted']}'")

    # 3. Defense Registration
    res_def = validate_indian_plate_grammar("21D098765A")
    assert res_def["is_valid"] is True and res_def["format_type"] == "defense"
    print(f"  [+] Valid Defense Plate: '21D098765A' -> '{res_def['formatted']}'")

    # 4. Invalid / Non-conforming plates
    invalid_cases = ["ZZ99XX1234", "12345", "INVALID", "USA1234"]
    for inv in invalid_cases:
        res = validate_indian_plate_grammar(inv)
        assert res["is_valid"] is False, f"Expected invalid for {inv}, got: {res}"
        print(f"  [+] Correctly rejected non-conforming plate: '{inv}' (format: {res['format_type']})")


def test_multi_frame_plate_voter():
    print("\n--- [TEST 2] Testing Multi-Frame Plate Voting Consensus (Item 4) ---")
    voter = MultiFramePlateVoter(history_len=10, min_consensus_votes=2)
    tracker_id = 42

    # Frame 1: Glare/noisy read "DL 01 AB 123" (missing 1 digit)
    v1 = voter.add_observation(
        tracker_id=tracker_id,
        plate_text="DL01AB123",
        confidence=0.55,
        plate_bbox=[100, 200, 150, 230],
        frame_idx=10,
    )
    print(f"  Frame 10: Read='DL01AB123' -> Consensus='{v1['plate_number']}', Confirmed={v1['is_confirmed']}")
    assert v1["is_confirmed"] is False

    # Frame 15: Clear read "DL 01 AB 1234"
    v2 = voter.add_observation(
        tracker_id=tracker_id,
        plate_text="DL 01 AB 1234",
        confidence=0.91,
        plate_bbox=[102, 201, 152, 231],
        frame_idx=15,
    )
    print(f"  Frame 15: Read='DL 01 AB 1234' -> Consensus='{v2['plate_number']}', Confirmed={v2['is_confirmed']}")
    # 0.91 high conf with valid grammar confirms or prepares consensus
    assert v2["plate_number"] == "DL 01 AB 1234"

    # Frame 20: Slight OCR variation "DL 01 A8 1234" (conf 0.60)
    v3 = voter.add_observation(
        tracker_id=tracker_id,
        plate_text="DL 01 A8 1234",
        confidence=0.60,
        plate_bbox=[105, 202, 155, 232],
        frame_idx=20,
    )
    print(f"  Frame 20: Read='DL 01 A8 1234' -> Consensus='{v3['plate_number']}', Confirmed={v3['is_confirmed']}")
    # Multi-frame consensus maintains DL 01 AB 1234 due to higher confidence and grammar
    assert v3["plate_number"] == "DL 01 AB 1234"
    assert v3["is_confirmed"] is True

    # Frame 25: Corroborating read "DL01AB1234" (conf 0.93)
    v4 = voter.add_observation(
        tracker_id=tracker_id,
        plate_text="DL01AB1234",
        confidence=0.93,
        plate_bbox=[108, 205, 158, 235],
        frame_idx=25,
    )
    print(f"  Frame 25: Read='DL01AB1234' -> Consensus='{v4['plate_number']}', Confirmed={v4['is_confirmed']}, Votes={v4.get('consensus_count')}")
    assert v4["plate_number"] == "DL 01 AB 1234"
    assert v4["is_confirmed"] is True
    assert v4["consensus_count"] >= 2

    # Pruning test
    voter.prune(current_frame_idx=200, max_idle_frames=100)
    assert voter.get_plate(tracker_id) is None
    print("  [+] Track pruning after inactivity verified.")


if __name__ == "__main__":
    print("==================================================================")
    print("  IBVAP ANPR Multi-Frame Consensus & Indian Grammar Test Suite")
    print("==================================================================")
    test_indian_plate_grammar()
    test_multi_frame_plate_voter()
    print("\n[SUCCESS] All ANPR Multi-frame voting & Indian plate format tests PASSED!")
