# IBVAP – Intelligent Border Video Analytics Platform

**Smart India Hackathon 2026**

IBVAP is an automated, AI-powered border surveillance and video analytics platform engineered to process real-time border camera feeds, detect critical activity (such as unauthorized persons, anomalous vehicle movements, intrusion events), and deliver actionable situational awareness to security personnel.

---

## Current Status: Step 1 – Foundation & YOLOv8 Verification

This step establishes the core project structure, Python virtual environment, dependencies, and a verified YOLOv8 video detection script.

### Directory Structure

```
IBVAP/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI backend entrypoint (foundation skeleton)
│   │   └── test_detection.py   # YOLOv8 verification script for video feeds
│   ├── models/                 # Storage for YOLO weights (yolov8n.pt)
│   ├── test_videos/            # Sample video clips for testing & verification
│   └── requirements.txt        # Backend dependencies
├── frontend/                   # Web frontend UI (reserved for upcoming steps)
├── .gitignore
└── README.md
```

---

## Getting Started (Backend)

### 1. Setup Virtual Environment

Navigate to the project root and create a virtual environment for the backend:

```bash
# In Windows PowerShell:
python -m venv backend/.venv

# Activate virtual environment:
backend\.venv\Scripts\Activate.ps1
# (or in cmd: backend\.venv\Scripts\activate.bat)
```

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Run Detection Verification Script

Place any test video (`.mp4`, `.avi`, `.mkv`) in `backend/test_videos/` (or pass a direct path):

```bash
# Run with automatic sample detection & live display:
python backend/app/test_detection.py

# Or specify custom input & output paths:
python backend/app/test_detection.py --input backend/test_videos/sample.mp4 --output backend/test_videos/annotated_sample.mp4

# For headless environments (no GUI window):
python backend/app/test_detection.py --input backend/test_videos/sample.mp4 --no-display
```

## Capabilities Overview

- **Multi-Object Detection & Tracking**: YOLOv8n + Tuned ByteTrack with multi-source ingestion (Webcam, RTSP, Video files).
- **Appearance Re-Identification (Re-ID)**: HSV-weighted chromatic histograms and spatial-temporal bounding box association for ID persistence across momentary occlusions.
- **Dynamic Virtual Fence (Polygon Geo-Fencing)**: Ray-casting point-in-polygon tests with 3-frame hysteresis debounce state machine.
- **Nocturnal CLAHE Enhancement**: Automatic low-light luminance detection with adaptive histogram equalization on the Lightness channel.
- **Tamper-Evident SHA-256 Audit Trail**: Blockchain-style continuous hash chaining of security events with genesis block and cryptographic integrity verification.
- **Tactical Summary Generation**: Hybrid plain-English tactical briefing generator (local Ollama LLM with instant rule-based deterministic fallback).
- **Behavioral Anomaly Detection**: Rule-based loitering and oscillating horizontal pacing heuristics.
- **ANPR License Plate Recognition**: Edge/Sobel rectangular localization and EasyOCR character recognition on tracked vehicles.
- **Watchlist Face Identification (Consented Demo)**: YuNet DNN landmark localization and SFace 128-d cosine similarity matching against local profiles in `backend/watchlist/`.

---

## Ethical & Legal Compliance Disclaimer (Facial Recognition)

> [!IMPORTANT]
> **Consented Demo Watchlist Only:**
> The facial identification capability in IBVAP is strictly scoped as a proof-of-concept demonstration that matches faces exclusively against a small, local, consented demo watchlist (e.g. authorized team members in `backend/watchlist/`).
>
> It is **NOT** connected to any government, law-enforcement, or public biometric database. Deployment of live biometric identification in real-world border management scenarios requires separate statutory authorizations and legal oversight frameworks that are outside the scope of this hackathon demo.
