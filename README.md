# 🛡️ IBVAP – Intelligent Border Video Analytics Platform

<div align="center">

![IBVAP Banner](frontend/public/images/indian_army_command_center.png)

### **Next-Generation Autonomous Multi-Camera AI Surveillance & Tactical Command System**
*Engineered for Smart India Hackathon (SIH) 2026*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=for-the-badge&logo=python&logoColor=white)](https://ultralytics.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Dual--Engine-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebSocket](https://img.shields.io/badge/Real--Time-WebSocket-E4405F?style=for-the-badge&logo=websocket&logoColor=white)](#real-time-websockets--tactical-voice-synthesizer)
[![Audit](https://img.shields.io/badge/Audit-SHA--256_Chained-red?style=for-the-badge&logo=shield&logoColor=white)](#9-cryptographic-tamper-evident-sha-256-audit-trail)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

[Live Demo / Overview](#15-public-platform-overview--telemetry-portal) • [System Architecture](#system-architecture) • [Tech Stack](#technology-stack) • [Quickstart Guide](#installation--getting-started) • [API Docs](#rest--websocket-api-reference)

</div>

---

## 📋 Table of Contents

- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
  - [Frontend & Tactical Interface](#frontend--tactical-interface)
  - [Backend & Server Architecture](#backend--server-architecture)
  - [Computer Vision & Deep Learning Engines](#computer-vision--deep-learning-engines)
  - [Database, Storage & Forensic Cryptography](#database-storage--forensic-cryptography)
  - [DevOps, Cloud & Containerization](#devops-cloud--containerization)
- [Key Capabilities & Modules](#key-capabilities--modules)
  - [1. Multi-Object Detection & Tuned ByteTrack](#1-multi-object-detection--bytetrack-tracking)
  - [2. Multi-Stream Ingestion & Live Switching Hub](#2-multi-stream-ingestion--live-switching-hub)
  - [3. Dynamic Virtual Fence (Polygon Geo-Fencing)](#3-dynamic-virtual-fence-polygon-geo-fencing)
  - [4. Appearance Re-Identification (Re-ID)](#4-appearance-re-identification-re-id)
  - [5. Low-Light Nocturnal & Weather-Adaptive Dehazing](#5-low-light-nocturnal--weather-adaptive-dehazing)
  - [6. Behavioral Anomaly Detection (Loitering & Pacing)](#6-behavioral-anomaly-detection-loitering--pacing)
  - [7. Watchlist Facial Recognition (YuNet + SFace)](#7-watchlist-facial-recognition-yunet--sface)
  - [8. ANPR & Authorized Vehicle Whitelisting](#8-anpr--authorized-vehicle-whitelisting)
  - [9. Cryptographic Tamper-Evident SHA-256 Audit Trail](#9-cryptographic-tamper-evident-sha-256-audit-trail)
  - [10. Incident Video Replay & Evidence Extraction](#10-incident-video-replay--evidence-extraction)
  - [11. Real-Time WebSockets & Tactical Voice Synthesizer](#11-real-time-websockets--tactical-voice-synthesizer)
  - [12. Dual-Engine Database Architecture (PostgreSQL + SQLite)](#12-dual-engine-database-architecture-postgresql--sqlite)
  - [13. Cloud Storage & CDN Integration (Cloudinary)](#13-cloud-storage--cdn-integration-cloudinary)
  - [14. Live CCTV & RTSP Stream Integration Engine](#14-live-cctv--rtsp-stream-integration-engine)
  - [15. Public Platform Overview & Telemetry Portal](#15-public-platform-overview--telemetry-portal)
- [Tactical Dashboard & User Experience](#tactical-dashboard--user-experience)
- [Repository Directory Structure](#repository-directory-structure)
- [REST & WebSocket API Reference](#rest--websocket-api-reference)
- [Environment Configuration](#environment-configuration)
- [Installation & Getting Started](#installation--getting-started)
  - [Prerequisites](#prerequisites)
  - [Quickstart (Docker - Recommended)](#quickstart-with-docker)
  - [Manual Local Setup](#manual-local-setup)
- [Running the Platform](#running-the-platform)
  - [1. Development Mode (Dual Process)](#1-development-mode)
  - [2. Unified Production Mode (Single-Port Runner)](#2-unified-production-mode-single-port-runner)
  - [3. Verification & Pipeline Benchmarks](#3-verification--pipeline-benchmarks)
  - [4. Real-Time Git Auto-Sync](#4-real-time-git-auto-sync)
- [Cloud Deployment Guide (Railway & Render)](#cloud-deployment-guide-railway--render)
- [Ethical & Legal Compliance Disclaimer](#ethical--legal-compliance-disclaimer)

---

## 🎯 Executive Summary

Border security requires high-precision, low-latency automated surveillance capable of operating **24/7 across extreme environmental hazards** (dense fog, nocturnal darkness, rain, sandstorms). 

**IBVAP (Intelligent Border Video Analytics Platform)** bridges state-of-the-art computer vision (`YOLOv8`, tuned `ByteTrack`, `YuNet`/`SFace`, `EasyOCR`) with an enterprise-grade tactical command dashboard. It eliminates surveillance fatigue by autonomously tracking moving targets, evaluating polygon keep-out breaches, identifying watchlisted personnel and vehicles, and broadcasting sub-50ms tactical audio alerts to command personnel.

### 🌟 Core Value Propositions

- ⚡ **Instant Situational Awareness:** Low-latency live MJPEG feeds with AI bounding boxes, interactive polygon geo-fences, and real-time synthesized voice alarms.
- 🎯 **Precision Anti-Occlusion Tracking:** Tuned ByteTrack with spatial-temporal bounding box association and HSV chromatic histogram Re-ID.
- 🔒 **Zero-Trust Forensic Audit Ledger:** Every security breach is cryptographically chained using continuous SHA-256 hashing to ensure tamper-evident non-repudiation.
- ⏪ **Instant Incident Replay:** Operators can click any alarm to extract pre/post-incident MP4 video clips and high-resolution cropped targets.
- 🗄️ **Dual-Engine Database Flexibility:** Seamlessly runs on managed **PostgreSQL** in the cloud with zero-config fallback to **SQLite** for edge border outposts.
- ☁️ **Permanent Cloud CDN Storage:** Integrated Cloudinary object storage retains critical evidence and facial biometric templates across ephemeral container restarts.
- 🛡️ **Role-Based Access Control (RBAC):** Military-style JWT authentication distinguishing `Admin` and `Operator` privilege tiers.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Video_Sources["📹 Video Ingestion Layer"]
        CAM1["Camera 01 (Perimeter Alpha)"]
        CAM2["Camera 02 (Sector Bravo)"]
        CAM3["Camera 03 (Checkpoint Zulu)"]
        CAM4["Camera 04 (Vehicle Gate Delta)"]
        RTSP["Live RTSP / ONVIF / CCTV Feeds"]
    end

    subgraph AI_Core["🧠 FastAPI Backend & AI Analytics Engine"]
        StreamHub["Stream Frame Hub (Multi-threaded Buffer)"]
        Enhance["Weather Dehazing & CLAHE Night Mode"]
        YOLO["YOLOv8 Multi-Object Detection (30+ FPS)"]
        Tracker["Tuned ByteTrack + Chromatic Re-ID"]
        GeoFence["Dynamic Polygon Geo-Fence Engine"]
        Behavior["Loitering & Pacing Analytics"]
        BioEng["YuNet + SFace Facial Watchlist Engine"]
        ANPREng["Sobel + EasyOCR Vehicle Plate Engine"]
        DualDB["Dual-Engine DB (PostgreSQL / SQLite)"]
        AuditLog["SHA-256 Chained Cryptographic Ledger"]
        ReplaySvc["Incident Replay Clip & Crop Extractor"]
        CloudCDN["Cloudinary Object Storage & CDN"]
    end

    subgraph Frontend_UI["🖥️ Tactical Command Dashboard (React 18 + Vite)"]
        Overview["Public Telemetry & Showcase Landing"]
        Auth["Biometric Login (JWT + RBAC Guards)"]
        WS["WebSocket Client (/ws/events)"]
        LiveFeed["Live MJPEG Multi-Camera Video Player"]
        AlertFeed["Live Priority Threat Notification Feed"]
        VoiceAlert["Tactical Voice Synthesizer & Chimes"]
        CctvModal["Dynamic RTSP / IP Camera Connector"]
        History["Searchable Event History & Forensic Replay"]
        AdminUI["Admin Whitelist & Watchlist Manager"]
        CertModal["Cryptographic Audit Certificate Verifier"]
    end

    Video_Sources --> StreamHub
    StreamHub --> Enhance --> YOLO --> Tracker
    Tracker --> GeoFence
    Tracker --> Behavior
    Tracker --> BioEng
    Tracker --> ANPREng
    GeoFence & Behavior & BioEng & ANPREng --> DualDB
    DualDB --> AuditLog
    AuditLog --> ReplaySvc
    ReplaySvc & BioEng --> CloudCDN
    AuditLog -. Real-Time Alerts .-> WS
    WS --> AlertFeed & VoiceAlert & LiveFeed
    StreamHub -. MJPEG Video Stream .-> LiveFeed
```

---

## 💻 Technology Stack

| Domain | Technology | Version | Purpose / Functionality in Platform |
|:---|:---|:---:|:---|
| **Frontend Framework** | **React** | `18.3.1` | Single-Page Application (SPA) tactical command console |
| **Frontend Build Tool** | **Vite** | `5.4.14` | High-speed ESM build system, HMR, and production bundler |
| **Icons & Visuals** | **Lucide React** | `0.475.0` | Comprehensive tactical and military HUD icon suite |
| **Styling & HUD** | **Vanilla CSS** | Modern | Cyberpunk dark-mode design system with scanlines & glassmorphism |
| **Voice & Chimes** | **Web Speech / Audio API**| Native | Browser-native synthesized voice warnings and tactical alerts |
| **Backend Framework** | **FastAPI** | `>=0.100.0` | High-performance asynchronous REST API & WebSocket server |
| **ASGI Server** | **Uvicorn** | `>=0.23.0` | Lightweight, high-throughput asynchronous Python ASGI server |
| **Computer Vision Core**| **OpenCV** | `>=4.8.0` | Frame ingestion, video decoding, drawing annotations & CLAHE |
| **Deep Learning** | **PyTorch / Torchvision** | `>=2.0.0` | Tensor computation and neural network backbone execution |
| **Object Detection** | **Ultralytics YOLOv8** | `>=8.0.0` | Real-time object detection and classification (people, vehicles) |
| **Object Tracking** | **ByteTrack + Supervision**| `>=0.18.0` | High-accuracy multi-object tracking with occlusion resistance |
| **Facial Biometrics** | **YuNet + SFace (ONNX)** | OpenCV DNN | 5-point landmark detector + 128-d deep cosine facial matching |
| **ANPR / Plate OCR** | **EasyOCR + OpenCV** | `>=1.7.0` | Automated Number Plate Recognition with grammar validation |
| **Nocturnal / Dehaze** | **CLAHE + DCP Filter** | Custom | Contrast Limited Equalization & Dark Channel Prior dehazing |
| **Relational Database**| **PostgreSQL / SQLite** | Dual | Seamless cloud persistence (Postgres) and edge fallback (SQLite) |
| **Database Driver** | **psycopg2-binary** | `>=2.9.9` | High-performance native PostgreSQL connection driver |
| **Cloud Storage** | **Cloudinary Python SDK**| `>=1.40.0` | Persistent cloud CDN storage for incident snapshots & biometrics |
| **Cryptography** | **SHA-256 Hash Chain** | `hashlib` | Blockchain-inspired continuous tamper-evident event ledger |
| **Authentication** | **PyJWT + Bcrypt** | Standard | Secure JSON Web Tokens with salted password hashing |
| **Containerization** | **Docker** | Multi-Stage| Unified deployment container with FFmpeg & system libraries |
| **Deployment Cloud** | **Railway / Render** | PaaS | Automated Git-triggered cloud deployment specifications |

---

## ⚡ Key Capabilities & Modules

### 1. Multi-Object Detection & ByteTrack Tracking
- Powered by **Ultralytics YOLOv8** coupled with custom-tuned **ByteTrack** parameters ([`bytetrack_tuned.yaml`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/bytetrack_tuned.yaml)).
- Classifies and tracks `person`, `car`, `truck`, `bus`, `motorcycle`, and unexpected animal movements at **30+ FPS**.
- Minimum track hysteresis debouncing prevents momentary detection flickers from triggering false alarms.

### 2. Multi-Stream Ingestion & Live Switching Hub
- Implemented in [`stream_hub.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/stream_hub.py) via an asynchronous, thread-safe frame buffer.
- Supports switching live feeds dynamically across registered surveillance cameras (`CAM_01` through `CAM_04`), live RTSP feeds, and on-demand video files.
- Provides standard MJPEG video streaming endpoints (`/api/live-feed/{camera_id}`) for zero-plugin browser playback.

### 3. Dynamic Virtual Fence (Polygon Geo-Fencing)
- Real-time ray-casting Point-In-Polygon (PIP) algorithms evaluate tracked object centroids against arbitrary security zone geometries.
- **Interactive UI Drawing Canvas**: Operators can click and draw custom polygon keep-out zones directly on the live video stream.
- Features a **3-frame hysteresis state machine**: requires persistent presence before triggering a breach and prevents bouncing at boundary edges.
- Generates prioritized `CRITICAL` perimeter intrusion security events.

### 4. Appearance Re-Identification (Re-ID)
- Retains track identity when subjects are momentarily occluded behind terrain, vehicles, or border structures.
- Combines normalized HSV-weighted chromatic histograms with spatial-temporal bounding box predictions to reconnect broken trajectories across occlusions and camera sectors.

### 5. Low-Light Nocturnal & Weather-Adaptive Dehazing
- Integrated in [`weather_enhancement.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/weather_enhancement.py).
- **Nocturnal Low-Light Boost:** Dynamically applies CLAHE (Contrast Limited Adaptive Histogram Equalization) to amplify visibility in pitch-black conditions.
- **Dark Channel Prior (DCP) Dehazing:** Estimates atmospheric light to reverse transmission loss during heavy fog, haze, and rain.

### 6. Behavioral Anomaly Detection (Loitering & Pacing)
- Mathematical spatial tracking measures trajectory dwell times and bounding box displacement vectors.
- Targets lingering inside sensitive sectors beyond an adjustable threshold (default 10s) trigger automated `LOITERING` or `ANOMALOUS_PACING` priority alerts.

### 7. Watchlist Facial Recognition (YuNet + SFace)
- Integrated in [`face_engine.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/face_engine.py).
- Uses lightweight ONNX deep models running directly in OpenCV DNN:
  - **YuNet**: Real-time 5-point landmark face detector.
  - **SFace**: Extracts 128-dimensional deep feature embeddings.
- Compares embeddings using cosine similarity against enrolled personnel in [`backend/watchlist/`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/watchlist/).
- Matches trigger an authorized `WATCHLIST_PERSONNEL_DETECTED` event or flag unverified walk-ins.

### 8. ANPR & Authorized Vehicle Whitelisting
- Locates vehicle license plates using morphological Sobel gradient filtering and extracts text via **EasyOCR**.
- Employs regex heuristic post-processing to correct optical ambiguities (e.g., `O` vs `0`, `I` vs `1`).
- Cross-references parsed plates against the authorized vehicle database (`backend/app/admin_management.py`). Unlisted vehicles trigger an immediate `UNAUTHORIZED_VEHICLE` alert.

### 9. Cryptographic Tamper-Evident SHA-256 Audit Trail
- Designed in [`events.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/events.py).
- Every event is sealed into a blockchain-style hash chain:
  $$\text{Current Hash} = \text{SHA256}(\text{Prev Hash} + \text{Timestamp} + \text{Camera} + \text{Type} + \text{Severity})$$
- Even a 1-bit manual alteration in the database completely invalidates the chain.
- Includes a live verification endpoint (`/api/audit/verify`) and downloadable cryptographic audit proof certificates (`/api/audit/certificate`).

### 10. Incident Video Replay & Evidence Extraction
- Engineered in [`replay_service.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/replay_service.py).
- When a threat occurs, the platform automatically generates:
  - An extracted **MP4 incident clip** (with pre/post event context).
  - A full-resolution **JPEG evidence snapshot**.
  - A high-resolution **target crop** focused on the suspect.

### 11. Real-Time WebSockets & Tactical Voice Synthesizer
- Bi-directional WebSocket endpoint (`/ws/events`) streams security events to connected operator clients in under 50ms.
- **Voice Synthesizer**: Uses Web Speech API to vocalize audible alerts (e.g., *"Warning: Perimeter breach detected on Sector Alpha, Camera 01"*).
- Features user volume/mute toggles, deduplication queues, and priority alert chimes.

### 12. Dual-Engine Database Architecture (PostgreSQL + SQLite)
- Implemented in [`db_engine.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/db_engine.py) with unified parameter normalization (`?` vs `%s`).
- **Cloud Mode**: Connects to managed PostgreSQL whenever `DATABASE_URL` is detected (Railway, Supabase, Neon).
- **Edge Mode**: Automatically falls back to high-performance local SQLite when running offline at remote border posts.

### 13. Cloud Storage & CDN Integration (Cloudinary)
- Implemented in [`cloud_storage.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/cloud_storage.py).
- Overcomes container ephemerality on platforms like Railway and Render by syncing enrolled watchlist portrait images and event snapshots to Cloudinary cloud CDN.

### 14. Live CCTV & RTSP Stream Integration Engine
- Integrated in [`CctvConnectModal.jsx`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/frontend/src/components/CctvConnectModal.jsx) and [`main.py`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/app/main.py).
- Allows operators to provision external live RTSP IP cameras, HLS network video streams, and HTTP feeds dynamically without restarting the server.

### 15. Public Platform Overview & Telemetry Portal
- Implemented in [`PlatformOverview.jsx`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/frontend/src/components/PlatformOverview.jsx).
- Unauthenticated public landing view for judges, stakeholders, and high-command personnel showcasing platform metrics, core capabilities, and live system architecture telemetry before logging into the restricted tactical console.

---

## 🖥️ Tactical Dashboard & User Experience

| Module | Purpose | Key Capabilities |
|---|---|---|
| **Platform Overview** | Public Showcase & Telemetry | Interactive feature matrix, system architecture breakdown, and one-click transition to Command Center. |
| **Tactical Login** | Access Security | Biometric-style animated login interface with JWT authentication and Role-Based Access Control (Admin vs. Operator). |
| **Live Command Feed** | Real-Time Video Operations | Multi-camera switcher, live MJPEG stream with dynamic AI bounding boxes, Night Mode & Dehaze controls, and dynamic polygon drawing. |
| **Live Alert Feed** | Immediate Threat Notifications | Scrolling real-time alert feed with audio chime, severity badges (`CRITICAL`, `HIGH`, `LOW`), and timestamp tracking. |
| **Event History** | Forensic Analysis & Replay | Searchable, paginated event log with date/severity filters, pre/post incident MP4 video playback, target crops, and audit certificates. |
| **Admin Command Center** | Biometric & Vehicle Whitelists | Enrolls facial identities (YuNet/SFace), manages authorized vehicle plates (EasyOCR), initiates pipeline tests, and monitors system health. |
| **CCTV Connector** | Camera Provisioning | Dynamic modal to register live RTSP, ONVIF, and HTTP video feeds directly into the active camera pool. |

---

## 📂 Repository Directory Structure

```
IBVAP/
├── backend/
│   ├── app/
│   │   ├── admin_management.py         # Watchlist & vehicle whitelist DB handlers
│   │   ├── auth.py                     # JWT token generation, bcrypt, and RBAC guards
│   │   ├── bytetrack_tuned.yaml        # Tuned ByteTrack tracking configuration
│   │   ├── cloud_storage.py            # Cloudinary CDN object storage integration
│   │   ├── db_engine.py                # Dual-Engine DB manager (PostgreSQL + SQLite)
│   │   ├── detection_tracking.py       # YOLOv8 + ByteTrack + Re-ID + Geo-Fence core
│   │   ├── events.py                   # Schema & SHA-256 chained audit ledger
│   │   ├── face_engine.py              # YuNet + SFace biometric recognition engine
│   │   ├── main.py                     # FastAPI server, REST routes & WebSocket hub
│   │   ├── replay_service.py           # Pre/post incident clip and crop generator
│   │   ├── stream_hub.py               # Multi-camera frame ingestion & MJPEG streamer
│   │   ├── weather_enhancement.py      # CLAHE & Dark Channel Prior dehaze filters
│   │   ├── test_detection.py           # Verification script for local video tests
│   │   ├── benchmark_weather_dehaze.py # Dehaze and low-light evaluation benchmark
│   │   └── test_audit_certificate.py   # Cryptographic audit hash integrity verifier
│   ├── models/                         # YOLOv8n, YuNet, and SFace ONNX weight files
│   ├── snapshots/                      # Stored event snapshot JPEGs
│   ├── test_videos/                    # Sample test clips (perimeter, night, traffic)
│   ├── watchlist/                      # Enrolled face images for authorized personnel
│   ├── requirements.txt                # Python backend dependencies
│   └── ibvap.db                        # Local SQLite database (fallback mode)
├── frontend/
│   ├── public/                         # Public assets, military emblems, and demo media
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminPanel.jsx          # Personnel watchlist & vehicle whitelist UI
│   │   │   ├── CameraPanel.jsx         # Camera status & stream switcher
│   │   │   ├── CctvConnectModal.jsx    # Live RTSP / IP camera connection modal
│   │   │   ├── EventHistory.jsx        # Searchable event table, replay & audit cert
│   │   │   ├── Header.jsx              # Status indicators, clock, voice controls & user profile
│   │   │   ├── LiveAlertFeed.jsx       # Real-time scrolling alert notification feed
│   │   │   ├── LiveVideoFeed.jsx       # Interactive video player with dynamic polygon canvas
│   │   │   ├── LoginPage.jsx           # Tactical biometric-style login page
│   │   │   ├── PlatformOverview.jsx    # Public platform landing page & telemetry showcase
│   │   │   ├── SnapshotModal.jsx       # Full-resolution evidence & replay viewer
│   │   │   └── StatsRow.jsx            # Real-time KPI summary counter cards
│   │   ├── context/
│   │   │   └── AuthContext.jsx         # User auth state, JWT tokens & permissions
│   │   ├── services/
│   │   │   ├── api.js                  # Axios/fetch API communication layer & endpoints
│   │   │   └── voiceAlertService.js    # TTS voice alerts & priority audio chime queue
│   │   ├── App.jsx                     # Main tactical layout assembler & state controller
│   │   ├── index.css                   # Cyberpunk / tactical dark-mode design system
│   │   └── main.jsx                    # React application root entrypoint
│   ├── package.json                    # Frontend dependencies & scripts
│   └── vite.config.js                  # Vite configuration & dev proxy
├── Dockerfile                          # Multi-stage container definition
├── railway.json                        # Railway.app cloud deployment configuration
├── render.yaml                         # Render.com unified deployment specification
├── Procfile                            # Heroku / Dokku process file
├── Aptfile                             # System dependencies (libgl1, libglib2.0)
├── run.py                              # Unified single-port server launcher
├── auto_git_sync.ps1                   # Real-time PowerShell background auto-sync
├── auto_git_sync.bat                   # 1-click batch launcher for auto-sync
├── sync_now.bat                        # 1-click immediate manual push launcher
├── requirements.txt                    # Root-level requirements wrapper
├── yolov8n.pt                          # Ultralytics YOLOv8 nano pre-trained weights
└── README.md                           # Documentation
```

---

## 📡 REST & WebSocket API Reference

### Authentication & Access Control
| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/auth/login` | Authenticate operator credentials and receive JWT Bearer token |
| `GET` | `/api/auth/me` | Retrieve profile and role permissions of current user |
| `GET` | `/api/auth/config` | Retrieve current authentication system configuration |

### Security Events & Forensic Audit
| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/events` | List security events (supports filtering by camera, severity, type) |
| `GET` | `/api/events/{id}` | Get detailed data for a specific security event |
| `GET` | `/api/snapshots/{id}` | Retrieve high-resolution evidence snapshot JPEG |
| `GET` | `/api/events/{id}/replay` | Stream or download pre/post-event incident MP4 replay clip |
| `GET` | `/api/events/{id}/crop` | Retrieve high-resolution cropped bounding box of target |
| `GET` | `/api/audit/verify` | Re-verify cryptographic SHA-256 hash chain from genesis block |
| `GET` | `/api/audit/certificate` | Generate downloadable cryptographic audit proof certificate |

### Live Video Feeds & Stream Hub
| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/live-feed/{camera_id}` | Stream real-time low-latency MJPEG video feed |
| `GET` | `/api/live-feed/{camera_id}/frame` | Fetch current raw frame JPEG for a specific camera |
| `GET` | `/api/stream/videos` | List available test video files for simulation |
| `POST` | `/api/stream/start` | Launch live AI tracking on a specific video source or camera |
| `POST` | `/api/stream/stop` | Stop active tracking stream pipeline |
| `GET` | `/api/stream/status` | Query active tracking status and source metadata |

### Admin Management & Watchlists
| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/admin/watchlist` | List registered personnel in biometric watchlist |
| `POST` | `/api/admin/watchlist` | Enroll new person with portrait photo upload |
| `DELETE` | `/api/admin/watchlist/{name}` | Remove individual from biometric watchlist |
| `POST` | `/api/admin/watchlist/rescan` | Trigger facial engine embedding re-computation |
| `GET` | `/api/admin/vehicles` | List authorized vehicles on whitelist |
| `POST` | `/api/admin/vehicles` | Add or update authorized vehicle license plate |
| `DELETE` | `/api/admin/vehicles/{plate}` | Delete vehicle license plate from whitelist |

### Real-Time WebSockets
| Protocol | Endpoint | Description |
|:---:|:---|:---|
| `WS` | `/ws/events` | Bi-directional WebSocket stream for sub-50ms security alerts |

---

## ⚙️ Environment Configuration

IBVAP works **out of the box with zero configuration** using SQLite. For production or cloud deployments, configure these optional environment variables:

| Variable | Default | Description |
|:---|:---:|:---|
| `PORT` | `8000` | Port for the backend and unified server runner |
| `DATABASE_URL` | *None (SQLite)* | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/ibvap`) |
| `CLOUDINARY_URL`| *None (Local disk)*| Cloudinary credentials for permanent snapshot CDN storage |
| `JWT_SECRET` | *Auto-generated* | Secret key for signing JSON Web Tokens |
| `CORS_ORIGINS` | `*` | Allowed CORS origins for API requests |

---

## 🚀 Installation & Getting Started

### Prerequisites
- **Python**: 3.10 or 3.11
- **Node.js**: v18.0.0 or higher (with `npm`)
- **Git**: Installed and configured
- **Docker**: (Optional, for containerized run)

---

### Quickstart with Docker

Run the entire platform with one command:

```bash
# Build the Docker image
docker build -t ibvap:latest .

# Run container on port 8000
docker run -p 8000:8000 ibvap:latest
```

Access the dashboard at **`http://localhost:8000`**.

---

### Manual Local Setup

#### 1. Clone the repository
```bash
git clone https://github.com/atul-techx/IBVAP.git
cd IBVAP
```

#### 2. Backend Setup
```bash
# Create and activate virtual environment
# Windows (PowerShell):
python -m venv backend/.venv
backend\.venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
cd ..
```

---

## 🎮 Running the Platform

### 1. Development Mode

Run backend and frontend concurrently for active development:

**Terminal 1 (Backend):**
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API Docs available at `http://localhost:8000/docs`*

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
*Frontend opens at `http://localhost:5173`*

#### 🔑 Pre-Configured Default Credentials

| Role | Username | Password | Permissions |
|:---|:---:|:---:|:---|
| **Tactical Administrator** | `admin` | `admin123` | Full access: Watchlist, Whitelist, Audit verification, Diagnostics |
| **Field Operator** | `operator` | `operator123` | Operational access: Live cameras, Alarms, Replay, Polygon geofence |

---

### 2. Unified Production Mode (Single-Port Runner)

To serve both frontend and backend on a single port (ideal for cloud deployments):

```bash
# Build the frontend assets
cd frontend
npm run build
cd ..

# Start the unified single-port runner
python run.py
```
Open **`http://localhost:8000`** in your browser.

---

### 3. Verification & Pipeline Benchmarks

Run standalone verification and accuracy tests:

```bash
# Test YOLOv8 video detection pipeline on sample clips:
python backend/app/test_detection.py

# Benchmark weather dehazing & low-light CLAHE filters:
python backend/app/benchmark_weather_dehaze.py

# Verify SHA-256 chained audit trail tamper detection:
python backend/app/test_audit_certificate.py

# Run E2E Admin Panel and whitelist verification:
python backend/app/test_e2e_admin_phase_a.py
```

---

### 4. Real-Time Git Auto-Sync

For multi-developer hackathon environments:
- **1-Click Auto-Sync**: Double-click [`auto_git_sync.bat`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/auto_git_sync.bat) to continuously watch and sync.
- **Immediate Push**: Double-click [`sync_now.bat`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/sync_now.bat) to commit and push changes immediately.

---

## ☁️ Cloud Deployment Guide (Railway & Render)

### Deploying to Railway
1. Push your code to GitHub.
2. In [Railway](https://railway.app), click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Railway automatically reads [`railway.json`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/railway.json) and executes `python run.py`.
4. *(Optional)* Add a PostgreSQL service in Railway; `DATABASE_URL` will be linked automatically.
5. *(Optional)* Set `CLOUDINARY_URL` in Railway Variables for permanent CDN snapshot storage.

### Deploying to Render
1. Create a **New Web Service** connected to your repository on [Render](https://render.com).
2. Render reads [`render.yaml`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/render.yaml) automatically.
3. Build Command:
   ```bash
   pip install --upgrade pip && pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install -r backend/requirements.txt
   ```
4. Start Command:
   ```bash
   python run.py
   ```

---

## ⚖️ Ethical & Legal Compliance Disclaimer

> [!IMPORTANT]
> **Consented Demo Biometrics Only:**
> The facial identification and license plate recognition capabilities included in IBVAP are strictly engineered as educational proof-of-concept demonstrations.
>
> - Biometric facial matching evaluates exclusively against small, local, consented demo watchlists ([`backend/watchlist/`](file:///c:/Users/atulg/OneDrive/Desktop/IBVAP/backend/watchlist/)).
> - The platform is **NOT** connected to any real-world law enforcement, governmental, or public surveillance database.
> - Real-world deployment of autonomous border video analytics requires formal statutory authorization, adherence to international human rights standards, data privacy compliance, and judicial oversight frameworks.

---

<div align="center">

**Developed for Smart India Hackathon (SIH) 2026**<br>
<i>Engineered with precision for secure, intelligent, and tamper-evident border surveillance.</i>

[![GitHub Stars](https://img.shields.io/github/stars/atul-techx/IBVAP?style=social)](https://github.com/atul-techx/IBVAP)
[![GitHub Forks](https://img.shields.io/github/forks/atul-techx/IBVAP?style=social)](https://github.com/atul-techx/IBVAP)

</div>
