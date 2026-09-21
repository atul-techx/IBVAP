import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Maximize2,
  Minimize2,
  RefreshCw,
  Shield,
  Activity,
  AlertTriangle,
  Layers,
  Users,
  Cpu,
  Video,
  Square,
  Play,
  Film,
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  FlipHorizontal,
  VideoOff,
  CameraOff,
  Plus,
  LayoutGrid,
  Upload,
  Edit3,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  getLiveFeedUrl,
  getLiveFrameUrl,
  fetchSystemHealth,
  startStream,
  stopStream,
  fetchStreamStatus,
  fetchAvailableVideos,
  processClientFrame,
  uploadVideoFile,
} from '../services/api';
import voiceAlertService from '../services/voiceAlertService';
import CctvConnectModal from './CctvConnectModal';

export default function LiveVideoFeed({
  cameraId = 'CAM_01',
  cameraName = 'Sector 4 Gate',
  location = 'North Perimeter Fence - Sector 4',
  cameras = [],
  onSelectCamera,
  lastEventTime = null,
}) {
  const [streamKey, setStreamKey] = useState(Date.now());
  const [isCctvModalOpen, setIsCctvModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [streamProcesses, setStreamProcesses] = useState({});
  const [availableVideos, setAvailableVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('sample.mp4');
  const [isControllingStream, setIsControllingStream] = useState(false);
  const [streamMode, setStreamMode] = useState('browser_webcam'); // 'browser_webcam' | 'mjpeg' | 'fallback_frame' | 'no_physical_camera'
  const [showZone, setShowZone] = useState(true);
  const [activeSourceType, setActiveSourceType] = useState('browser_webcam');
  const [manuallyStopped, setManuallyStopped] = useState(false);
  const [fallbackFrameUrl, setFallbackFrameUrl] = useState('');
  const [webcamError, setWebcamError] = useState(null);
  const [isWebcamMirror, setIsWebcamMirror] = useState(true);
  const [clientDetections, setClientDetections] = useState([]);
  const [clientHasIntrusion, setClientHasIntrusion] = useState(false);
  const [clientUnknownPersonCount, setClientUnknownPersonCount] = useState(0);
  const [clientUnknownVehicleCount, setClientUnknownVehicleCount] = useState(0);
  const [clientTelemetry, setClientTelemetry] = useState({ fps: 0, occupancy: 0 });

  // Multi-Camera Grid vs Single View Mode (Item 10)
  const [viewLayout, setViewLayout] = useState('single'); // 'single' | 'grid'

  // Interactive Virtual Fence Canvas Drawing Mode (Item 11)
  const [customFencePoints, setCustomFencePoints] = useState([]);
  const [isDrawingFence, setIsDrawingFence] = useState(false);
  const customFencePointsRef = useRef(customFencePoints);
  customFencePointsRef.current = customFencePoints;
  const isDrawingFenceRef = useRef(isDrawingFence);
  isDrawingFenceRef.current = isDrawingFence;
  const isWebcamMirrorRef = useRef(isWebcamMirror);
  isWebcamMirrorRef.current = isWebcamMirror;

  // Offline Video File Upload (Item 26)
  const fileInputRef = useRef(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const videoContainerRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const webcamCanvasRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const webcamIntervalRef = useRef(null);
  const isSendingFrameRef = useRef(false);
  const lastWebcamAlertTimeRef = useRef(0);
  const showZoneRef = useRef(showZone);
  showZoneRef.current = showZone;

  const isPhysicalCamera = cameraId === 'CAM_01' || cameraId === 'CAM_02';

  const feedUrl = getLiveFeedUrl(cameraId, { v: streamKey });

  const validCameras = (cameras || []).filter(
    (c) => c?.camera_id && !c.camera_id.toUpperCase().startsWith('SYSTEM') && !c.camera_id.toUpperCase().startsWith('AUTH')
  );

  const currentCam = validCameras.find((c) => c.camera_id === cameraId) || {
    camera_id: cameraId,
    name: cameraName || cameraId,
    location: location,
  };

  const isProcessRunning = streamProcesses[cameraId]?.running || false;
  const isCamOnline = !manuallyStopped && (
    isPhysicalCamera
      ? (streamMode === 'browser_webcam' && !webcamError)
      : (streamMode === 'mjpeg' && isProcessRunning)
  );

  // Helper to cleanly terminate browser webcam hardware tracks
  const stopBrowserWebcamTracks = () => {
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    if (webcamStreamRef.current) {
      try {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      webcamStreamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setClientDetections([]);
    setClientHasIntrusion(false);
  };

  // Draw cyber tactical virtual fence and live AI bounding boxes on browser webcam overlay canvas
  const drawClientOverlay = (canvas, w, h, detections, hasIntrusion, zoneActive) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const isMirrored = Boolean(isWebcamMirrorRef.current);

    // 1. Draw Virtual Fence Polygon (Custom drawn polygon or default side perimeter corridor)
    if (zoneActive) {
      const customPts = customFencePointsRef.current;
      const isCustom = customPts && customPts.length >= 3;
      const poly = isCustom
        ? customPts.map(([nx, ny]) => [isMirrored ? (1.0 - nx) * w : nx * w, ny * h])
        : (isMirrored
            ? [
                [(1.0 - 0.96) * w, 0.12 * h],
                [(1.0 - 0.62) * w, 0.12 * h],
                [(1.0 - 0.62) * w, 0.88 * h],
                [(1.0 - 0.96) * w, 0.88 * h],
              ]
            : [
                [0.62 * w, 0.12 * h],
                [0.96 * w, 0.12 * h],
                [0.96 * w, 0.88 * h],
                [0.62 * w, 0.88 * h],
              ]
          );

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i][0], poly[i][1]);
      }
      ctx.closePath();

      // Translucent cyber fill
      ctx.fillStyle = hasIntrusion ? 'rgba(239, 68, 68, 0.22)' : 'rgba(56, 189, 248, 0.10)';
      ctx.fill();

      // Glowing cyber perimeter border
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = hasIntrusion ? '#ef4444' : (isCustom ? '#38bdf8' : '#38bdf8');
      ctx.shadowColor = hasIntrusion ? '#ef4444' : '#38bdf8';
      ctx.shadowBlur = hasIntrusion ? 16 : 8;
      ctx.stroke();

      // Corner reticles for high-tech look
      poly.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fillStyle = hasIntrusion ? '#ef4444' : '#38bdf8';
        ctx.fill();
      });

      // Zone Label Badge
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = hasIntrusion ? '#ef4444' : '#38bdf8';
      const labelX = poly[0][0] + 8;
      const labelY = Math.max(16, poly[0][1] - 8);
      ctx.fillText(
        hasIntrusion
          ? '⚠ ALERT: INTRUSION ACTIVE'
          : isCustom
          ? '🛡 ZONE: CUSTOM POLYGON (ACTIVE)'
          : '🛡 ZONE: POLYGON α (PERIMETER ACTIVE)',
        labelX,
        labelY
      );
      ctx.restore();
    }

    // In-progress fence vertices & dashed preview if currently in drawing mode
    if (isDrawingFenceRef.current) {
      const pts = customFencePointsRef.current || [];
      ctx.save();
      if (pts.length > 0) {
        const getPtX = (nx) => (isMirrored ? (1.0 - nx) * w : nx * w);
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.moveTo(getPtX(pts[0][0]), pts[0][1] * h);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(getPtX(pts[i][0]), pts[i][1] * h);
        }
        ctx.stroke();

        pts.forEach(([nx, ny], idx) => {
          const px = getPtX(nx);
          const py = ny * h;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#000000';
          ctx.fillText(String(idx + 1), px - 3, py + 3);
        });
      }

      // Drawing HUD instruction banner
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(w / 2 - 180, 10, 360, 26);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - 180, 10, 360, 26);
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText(`✏️ CLICK CANVAS TO PLACE VERTEX (${pts.length} PTS) • CLICK APPLY`, w / 2, 27);
      ctx.textAlign = 'start';
      ctx.restore();
    }

    // 2. Draw Detections (Bounding Boxes & Badges)
    detections.forEach((det) => {
      if (!det.norm_bbox) return;
      const [nx1, ny1, nx2, ny2] = det.norm_bbox;
      const x1 = isMirrored ? (1.0 - nx2) * w : nx1 * w;
      const y1 = ny1 * h;
      const bw = (nx2 - nx1) * w;
      const bh = (ny2 - ny1) * h;

      const isPerson = det.class_name?.toLowerCase() === 'person';
      const isVehicle = ['car', 'bus', 'truck', 'motorcycle', 'vehicle'].includes(det.class_name?.toLowerCase());
      const isAuthPerson = isPerson && (det.is_authorized_person || det.is_authorized || (det.identified_as && det.identified_as !== 'UNKNOWN'));
      const isUnknownPerson = isPerson && !isAuthPerson;
      const isAuthVeh = isVehicle && det.is_authorized_vehicle;
      const isUnauthVeh = isVehicle && !det.is_authorized_vehicle;
      const isInZone = det.in_zone;

      let boxColor = '#38bdf8';
      if (isAuthVeh || isAuthPerson) {
        boxColor = '#10b981'; // Green for authorized
      } else if (isUnknownPerson || isUnauthVeh || isInZone) {
        boxColor = '#ef4444'; // Red alert for unknown persons or unauthorized vehicles
      }

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = boxColor;
      ctx.shadowColor = boxColor;
      ctx.shadowBlur = (isInZone || isUnauthVeh || isUnknownPerson) ? 14 : 6;
      ctx.strokeRect(x1, y1, bw, bh);

      // Corner reticles
      const rLen = Math.min(16, bw / 4, bh / 4);
      ctx.lineWidth = 3.5;
      // top-left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + rLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + rLen, y1);
      ctx.stroke();
      // top-right
      ctx.beginPath();
      ctx.moveTo(x1 + bw - rLen, y1);
      ctx.lineTo(x1 + bw, y1);
      ctx.lineTo(x1 + bw, y1 + rLen);
      ctx.stroke();
      // bottom-left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + bh - rLen);
      ctx.lineTo(x1, y1 + bh);
      ctx.lineTo(x1 + rLen, y1 + bh);
      ctx.stroke();
      // bottom-right
      ctx.beginPath();
      ctx.moveTo(x1 + bw - rLen, y1 + bh);
      ctx.lineTo(x1 + bw, y1 + bh);
      ctx.lineTo(x1 + bw, y1 + bh - rLen);
      ctx.stroke();

      // Label Header Badge
      let statusTag = '';
      if (isAuthVeh) {
        statusTag = ` [AUTHORIZED: ${det.vehicle_owner || 'FLEET'}]`;
      } else if (isUnauthVeh) {
        statusTag = ' [UNAUTHORIZED VEHICLE]';
      } else if (isAuthPerson) {
        statusTag = ` [AUTHORIZED: ${det.identified_as}]`;
      } else if (isUnknownPerson) {
        statusTag = ' [UNKNOWN PERSON]';
      } else if (isInZone) {
        statusTag = ' [INTRUSION]';
      }

      const plateTag = det.plate_number ? ` [PLATE: ${det.plate_number}]` : (isVehicle ? ' [PLATE: UNVERIFIED]' : '');
      const labelText = `${det.class_name.toUpperCase()} #${det.track_id} (${Math.round(det.confidence * 100)}%)${statusTag}${plateTag}`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillStyle = (isInZone || isUnauthVeh || isUnknownPerson) ? 'rgba(239, 68, 68, 0.95)' : (isAuthVeh || isAuthPerson ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.88)');
      ctx.fillRect(x1, Math.max(0, y1 - 21), textWidth + 12, 20);
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, Math.max(0, y1 - 21), textWidth + 12, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x1 + 6, Math.max(14, y1 - 7));

      // Draw License Plate box if vehicle
      if (isVehicle) {
        let px1, py1, pw, ph;
        if (det.plate_bbox && det.plate_bbox.length === 4) {
          px1 = isMirrored ? (w - det.plate_bbox[2]) : det.plate_bbox[0];
          py1 = det.plate_bbox[1];
          pw = Math.max(20, det.plate_bbox[2] - det.plate_bbox[0]);
          ph = Math.max(12, det.plate_bbox[3] - det.plate_bbox[1]);
        } else {
          px1 = x1 + bw * 0.20;
          py1 = y1 + bh * 0.72;
          pw = bw * 0.60;
          ph = bh * 0.22;
        }

        const pColor = isAuthVeh ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = pColor;
        ctx.strokeRect(px1, py1, pw, ph);

        const plateBadge = det.plate_number
          ? `PLATE: ${det.plate_number} ${isAuthVeh ? '[AUTHORIZED]' : '[UNAUTHORIZED]'}`
          : 'PLATE: UNVERIFIED [UNAUTHORIZED]';

        ctx.font = 'bold 10px monospace';
        const pTextWidth = ctx.measureText(plateBadge).width;
        ctx.fillStyle = isAuthVeh ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
        ctx.fillRect(px1, Math.max(0, py1 - 16), pTextWidth + 8, 15);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(plateBadge, px1 + 4, Math.max(11, py1 - 4));
      }

      ctx.restore();
    });
  };

  // Start continuous AI inference frame capture loop (~350ms interval, ~3 FPS)
  const startClientAiLoop = () => {
    if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);

    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');

    webcamIntervalRef.current = setInterval(async () => {
      const video = webcamVideoRef.current;
      const canvas = webcamCanvasRef.current;
      if (!video || !canvas || video.readyState < 2 || isSendingFrameRef.current) return;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      if (offscreenCanvas.width !== 640 || offscreenCanvas.height !== 360) {
        offscreenCanvas.width = 640;
        offscreenCanvas.height = 360;
      }

      try {
        offscreenCtx.drawImage(video, 0, 0, 640, 360);
        const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.65);

        isSendingFrameRef.current = true;
        const res = await processClientFrame({
          image: dataUrl,
          camera_id: cameraId,
          show_zone: showZoneRef.current,
          custom_polygon: (customFencePointsRef.current && customFencePointsRef.current.length >= 3)
            ? customFencePointsRef.current
            : undefined,
        });

        if (res?.status === 'success') {
          const detections = res.detections || [];
          setClientDetections(detections);

          const unknownPersons = detections.filter(
            (d) => d.class_name?.toLowerCase() === 'person' && !d.is_authorized_person && !d.is_authorized && (!d.identified_as || d.identified_as === 'UNKNOWN')
          );
          const isVehicleClass = (cls) => ['car', 'truck', 'bus', 'motorcycle', 'vehicle'].includes(cls?.toLowerCase());
          const unknownVehicles = detections.filter(
            (d) => isVehicleClass(d.class_name) && !d.is_authorized_vehicle && !d.is_authorized
          );

          setClientUnknownPersonCount(unknownPersons.length);
          setClientUnknownVehicleCount(unknownVehicles.length);

          const hasIntrusion = Boolean(res.has_intrusion);
          setClientHasIntrusion(hasIntrusion);

          if (res.telemetry) {
            setClientTelemetry(res.telemetry);
          }

          drawClientOverlay(canvas, vw, vh, detections, hasIntrusion, showZoneRef.current);

          // Real-time Voice Alert Trigger with 6.0s throttle to avoid speech congestion
          // Only alert for unknown persons that are entering the zone or when no zone is active
          const now = Date.now();
          const alertableUnknownPersons = unknownPersons.filter(
            (p) => !p.is_authorized_person && !p.is_authorized && (p.in_zone || !showZoneRef.current)
          );
          if (alertableUnknownPersons.length > 0 && (now - lastWebcamAlertTimeRef.current >= 6000)) {
            lastWebcamAlertTimeRef.current = now;
            voiceAlertService.announceEvent({
              event_type: 'unauthorized_person',
              object_class: 'person',
              severity: 'high',
              camera_id: cameraId,
            });
          } else if (unknownVehicles.length > 0 && (now - lastWebcamAlertTimeRef.current >= 6000)) {
            lastWebcamAlertTimeRef.current = now;
            voiceAlertService.announceEvent({
              event_type: 'unauthorized_vehicle',
              object_class: 'car',
              severity: 'high',
              camera_id: cameraId,
            });
          } else if (hasIntrusion && (now - lastWebcamAlertTimeRef.current >= 4500)) {
            lastWebcamAlertTimeRef.current = now;
            voiceAlertService.announceEvent({
              event_type: 'zone_entry',
              object_class: 'person',
              severity: 'high',
              camera_id: cameraId,
            });
          }
        }
      } catch (err) {
        // Silently skip frame error to keep smooth UI
      } finally {
        isSendingFrameRef.current = false;
      }
    }, 350);
  };

  // Load available test videos on mount
  useEffect(() => {
    fetchAvailableVideos()
      .then((data) => {
        if (data?.videos && data.videos.length > 0) {
          setAvailableVideos(data.videos);
        }
      })
      .catch(() => {});
  }, []);

  // Poll system health & process status at a reasonable, low-overhead interval (3.5s)
  useEffect(() => {
    let isMounted = true;
    const pollStatus = async () => {
      try {
        const [healthData, procStatus] = await Promise.all([
          fetchSystemHealth().catch(() => null),
          fetchStreamStatus().catch(() => ({})),
        ]);
        if (isMounted) {
          if (healthData) setSystemHealth(healthData);
          if (procStatus) setStreamProcesses(procStatus);
        }
      } catch {
        // Silently handle polling errors
      }
    };
    pollStatus();
    const interval = setInterval(pollStatus, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const camTelemetry = systemHealth?.camera_telemetry?.[cameraId] || {
    footfall_in: 0,
    footfall_out: 0,
    occupancy: 0,
    fps: 0.0,
  };

  // Handle switching camera sectors: keep live camera connected on Sector 1 & 2, show offline on others
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);

    if (isPhysicalCamera) {
      setManuallyStopped(false);
      setStreamMode('browser_webcam');
      setActiveSourceType('browser_webcam');

      if (webcamStreamRef.current && webcamStreamRef.current.active) {
        if (webcamVideoRef.current && webcamVideoRef.current.srcObject !== webcamStreamRef.current) {
          webcamVideoRef.current.srcObject = webcamStreamRef.current;
          webcamVideoRef.current.play().catch(() => {});
        }
        setIsLoaded(true);
        startClientAiLoop();
      } else {
        handleStartWebcam();
      }
    } else {
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current);
        webcamIntervalRef.current = null;
      }
      setStreamMode('no_physical_camera');
      setActiveSourceType('no_physical_camera');
      setIsLoaded(true);
    }
  }, [cameraId]);

  // Clean up browser webcam tracks on component unmount
  useEffect(() => {
    return () => {
      stopBrowserWebcamTracks();
    };
  }, []);

  // Gracefully transition out the loader after 700ms so stream is never hidden behind spinner
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [streamKey]);

  // Handle fallback polling if MJPEG fails in browser
  useEffect(() => {
    if (streamMode === 'fallback_frame' && !manuallyStopped) {
      const updateFrame = () => {
        setFallbackFrameUrl(getLiveFrameUrl(cameraId, { t: Date.now() }));
      };
      updateFrame();
      fallbackIntervalRef.current = setInterval(updateFrame, 250); // 4 FPS fallback
      return () => {
        if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
      };
    } else {
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    }
  }, [streamMode, cameraId, manuallyStopped]);

  // 1-Click Launch or Switch Surveillance Video Feed (Continuous Loop)
  const handleStartVideoFeed = async (videoFilename = selectedVideo) => {
    // 1. Cleanly stop client webcam hardware tracks and timers
    stopBrowserWebcamTracks();

    setActiveSourceType('test_video');
    setManuallyStopped(false);
    setIsControllingStream(true);
    setHasError(false);
    setIsLoaded(false);
    setStreamMode('mjpeg');
    try {
      const res = await startStream(cameraId, {
        source: videoFilename,
        sourceType: 'test_video',
        imgsz: 480,
        showZone: showZone,
      });
      setStreamProcesses((prev) => ({
        ...prev,
        [cameraId]: { running: true, pid: res?.pid || null },
      }));
      // Short delay for backend pipeline to spin up and produce first frame before loading stream
      setTimeout(() => {
        setStreamKey(Date.now());
        setHasError(false);
        setIsLoaded(true);
      }, 1200);
    } catch (err) {
      alert(`Failed to start video feed: ${err.message}`);
    } finally {
      setIsControllingStream(false);
    }
  };

  // Launch Real Browser Device Webcam with Live AI Border Surveillance Analytics
  const handleStartWebcam = async () => {
    // 1. Terminate backend stream subprocess for this camera if running
    stopStream(cameraId).catch(() => {});
    setStreamProcesses((prev) => ({
      ...prev,
      [cameraId]: { running: false, pid: null },
    }));

    // 2. Set webcam mode states and clear errors
    setActiveSourceType('browser_webcam');
    setStreamMode('browser_webcam');
    setManuallyStopped(false);
    setHasError(false);
    setWebcamError(null);
    setIsLoaded(true);

    // 3. If hardware webcam track is already active, re-bind to video element
    if (webcamStreamRef.current && webcamStreamRef.current.active) {
      setIsControllingStream(false);
      setTimeout(() => {
        if (webcamVideoRef.current) {
          if (webcamVideoRef.current.srcObject !== webcamStreamRef.current) {
            webcamVideoRef.current.srcObject = webcamStreamRef.current;
          }
          webcamVideoRef.current.play().catch(() => {});
        }
        startClientAiLoop();
      }, 60);
      return;
    }

    // 4. Request new hardware webcam stream
    stopBrowserWebcamTracks();
    setIsControllingStream(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser mediaDevices API is not supported in this browser or environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          aspectRatio: { ideal: 1.7777777778 },
          facingMode: 'user',
        },
        audio: false,
      });

      webcamStreamRef.current = stream;
      setTimeout(() => {
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play().catch(() => {});
        }
        startClientAiLoop();
      }, 60);
      setIsLoaded(true);
    } catch (err) {
      console.error('[Webcam] Access error:', err);
      const errMsg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please click the camera icon in your browser address bar to allow camera access.'
          : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
          ? 'No camera device found on your device.'
          : `Failed to open camera: ${err.message}`;
      setWebcamError(errMsg);
      setIsLoaded(true);
    } finally {
      setIsControllingStream(false);
    }
  };

  // Auto-start Physical Camera on initial system launch for Sector 01
  useEffect(() => {
    if (isPhysicalCamera) {
      handleStartWebcam();
    }
  }, []);

  // Toggle Virtual Fence Zone (Blue Box) ON / OFF
  const handleToggleZone = async () => {
    const nextZone = !showZone;
    setShowZone(nextZone);
    showZoneRef.current = nextZone;

    if (streamMode === 'browser_webcam') {
      const canvas = webcamCanvasRef.current;
      if (canvas) {
        drawClientOverlay(canvas, canvas.width, canvas.height, clientDetections, clientHasIntrusion, nextZone);
      }
      return;
    }

    setManuallyStopped(false);
    setIsControllingStream(true);
    try {
      const res = await startStream(cameraId, {
        source: selectedVideo,
        sourceType: 'test_video',
        imgsz: 480,
        showZone: nextZone,
      });
      setStreamProcesses((prev) => ({
        ...prev,
        [cameraId]: { running: true, pid: res?.pid || null },
      }));
      setTimeout(() => {
        setStreamKey(Date.now());
      }, 900);
    } catch (err) {
      console.error('Failed to toggle virtual fence:', err);
    } finally {
      setIsControllingStream(false);
    }
  };

  // 1-Click Stop Active Stream
  const handleStopStream = async () => {
    stopBrowserWebcamTracks();
    setIsControllingStream(true);
    try {
      await stopStream(cameraId);
      setManuallyStopped(true);
      setStreamProcesses((prev) => ({
        ...prev,
        [cameraId]: { running: false, pid: null },
      }));
    } catch (err) {
      alert(`Failed to stop stream: ${err.message}`);
    } finally {
      setIsControllingStream(false);
    }
  };

  const handleRefresh = async () => {
    if (streamMode === 'browser_webcam') {
      handleStartWebcam();
      return;
    }
    setManuallyStopped(false);
    setHasError(false);
    setIsLoaded(false);
    setStreamMode('mjpeg');
    setStreamKey(Date.now());
    try {
      const res = await startStream(cameraId, {
        source: selectedVideo,
        sourceType: 'test_video',
        imgsz: 480,
        showZone: showZone,
      });
      setStreamProcesses((prev) => ({
        ...prev,
        [cameraId]: { running: true, pid: res?.pid || null },
      }));
    } catch (err) {
      console.warn('Failed to refresh stream:', err);
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Interactive Virtual Fence Canvas Click Handler (Item 11)
  const handleCanvasClick = (e) => {
    if (!isDrawingFence) return;
    const canvas = webcamCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (isWebcamMirror) {
      nx = 1.0 - nx;
    }
    const newPt = [Number(nx.toFixed(3)), Number(ny.toFixed(3))];
    setCustomFencePoints((prev) => [...prev, newPt]);
  };

  const handleResetCustomZone = () => {
    setCustomFencePoints([]);
    setIsDrawingFence(false);
  };

  // Offline Video File Upload Trigger (Item 26)
  const handleUploadVideoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const res = await uploadVideoFile(file);
      setAvailableVideos((prev) => [
        { filename: res.filename, label: res.label, size_kb: res.size_kb },
        ...prev,
      ]);
      setSelectedVideo(res.filename);
      await handleStartVideoFeed(res.filename);
    } catch (err) {
      alert(`Video upload failed: ${err.message}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const hasIntrusion = camTelemetry.occupancy > 0;

  return (
    <div className="card live-feed-card" role="region" aria-label="Live Video Surveillance Stream">
      {/* Multi-Camera Channel Switcher Tab Bar */}
      <div
        className="camera-switcher-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.1rem',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.4rem' }}>
          <Video size={14} />
          <span>Switch Camera:</span>
        </div>
        {validCameras.map((cam) => {
          const isSelected = cam.camera_id === cameraId;
          const isPhys = cam.camera_id === 'CAM_01' || cam.camera_id === 'CAM_02';
          return (
            <button
              key={cam.camera_id}
              onClick={() => onSelectCamera?.(cam.camera_id)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: isSelected
                  ? (isPhys ? '1.5px solid #16a34a' : '1.5px solid #d97706')
                  : '1px solid #e2e8f0',
                background: isSelected
                  ? (isPhys ? '#f0fdf4' : '#fffbeb')
                  : '#ffffff',
                color: isSelected ? (isPhys ? '#166534' : '#92400e') : '#64748b',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 800 : 500,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
                boxShadow: isSelected
                  ? '0 1px 3px rgba(0, 0, 0, 0.08)'
                  : 'none',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isPhys ? '#16a34a' : '#d97706',
                }}
              />
              <span>{cam.name || cam.camera_id}</span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '3px',
                  background: isPhys ? '#dcfce7' : '#fef3c7',
                  color: isPhys ? '#166534' : '#92400e',
                  fontWeight: 700,
                  marginLeft: '0.25rem',
                  letterSpacing: '0.03em',
                }}
              >
                {isPhys ? 'PHYSICAL CAM' : 'NO SENSOR'}
              </span>
            </button>
          );
        })}

        {/* View Mode Switcher (Item 10) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => setViewLayout('single')}
            style={{
              background: viewLayout === 'single' ? '#0284c7' : '#ffffff',
              color: viewLayout === 'single' ? '#ffffff' : '#64748b',
              border: `1px solid ${viewLayout === 'single' ? '#0284c7' : '#cbd5e1'}`,
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
            }}
            title="Switch to single focused camera view"
          >
            <Video size={13} />
            <span>Single View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewLayout('grid')}
            style={{
              background: viewLayout === 'grid' ? '#0284c7' : '#ffffff',
              color: viewLayout === 'grid' ? '#ffffff' : '#64748b',
              border: `1px solid ${viewLayout === 'grid' ? '#0284c7' : '#cbd5e1'}`,
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
            }}
            title="Switch to 4-camera split tactical grid (CAM_01 to CAM_04)"
          >
            <LayoutGrid size={13} />
            <span>4-Cam Grid</span>
          </button>
        </div>
      </div>

      {/* Feed Panel Header */}
      <div className="card-header live-feed-header" style={{ padding: '0.75rem 1.1rem' }}>
        <div className="live-feed-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            className={`status-indicator ${isPhysicalCamera ? (isCamOnline ? 'online' : 'standby') : 'offline'}`}
            style={!isPhysicalCamera && streamMode === 'no_physical_camera' ? { borderColor: '#fde68a', color: '#92400e', background: '#fffbeb' } : {}}
          >
            <span
              className="pulse-dot"
              style={!isPhysicalCamera && streamMode === 'no_physical_camera' ? { background: '#d97706' } : {}}
            />
            {isPhysicalCamera
              ? (isCamOnline ? 'SURVEILLANCE ACTIVE // LIVE CAM' : 'STANDBY')
              : (streamMode === 'no_physical_camera' ? 'NO PHYSICAL CAMERA' : 'SIMULATION STREAM')}
          </div>

          {/* Camera Selector Dropdown */}
          <div className="camera-selector-wrap">
            <Radio size={14} className="cam-icon" />
            <select
              className="camera-dropdown"
              value={cameraId}
              onChange={(e) => onSelectCamera?.(e.target.value)}
              aria-label="Select Monitored Camera"
              style={{
                background: '#ffffff',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {validCameras.map((cam) => (
                <option key={cam.camera_id} value={cam.camera_id} style={{ background: '#ffffff', color: '#0f172a' }}>
                  {cam.name || cam.camera_id} ({cam.location || 'Perimeter Sector'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls & Feed Selector */}
        <div className="feed-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Quick Video Scenario Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <Film size={13} style={{ color: '#0284c7' }} />
            <select
              value={activeSourceType === 'browser_webcam' ? 'browser_webcam' : selectedVideo}
              onChange={(e) => {
                const vid = e.target.value;
                if (vid === 'browser_webcam') {
                  handleStartWebcam();
                } else {
                  setSelectedVideo(vid);
                  handleStartVideoFeed(vid);
                }
              }}
              style={{
                background: '#ffffff',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                padding: '0.15rem 0.25rem',
              }}
              title="Select Video Surveillance Scenario"
            >
              <option value="browser_webcam" style={{ background: '#ffffff', color: '#16a34a', fontWeight: 700 }}>📹 My Device Webcam (Live AI)</option>
              <option value="sample.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Sector 01 (Bus & Person Intrusion)</option>
              <option value="tracking_test.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Sector 04 (Multi-Target Tracking)</option>
              <option value="dark_test.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Night Vision (CLAHE Retinex)</option>
              <option value="foggy_test.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Adverse Fog (DCP Dehazing)</option>
              <option value="suspicious_behavior_test.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Perimeter (Loitering & Pacing)</option>
              <option value="real_footage_1.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Outpost 01 (Real Surveillance)</option>
              <option value="real_footage_2.mp4" style={{ background: '#ffffff', color: '#0f172a' }}>Outpost 02 (Real Surveillance)</option>
            </select>
          </div>

          {/* Hidden video file input for offline video upload (Item 26) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleVideoFileChange}
            accept="video/mp4,video/avi,video/x-matroska,video/quicktime,video/webm"
            style={{ display: 'none' }}
          />

          {/* Play/Restart CCTV Loop Button */}
          <button
            className="icon-btn"
            onClick={() => handleStartVideoFeed(selectedVideo)}
            disabled={isControllingStream}
            title="Play / Restart Surveillance Video Loop"
            style={{
              background: 'rgba(14, 165, 233, 0.2)',
              border: '1px solid #0ea5e9',
              color: '#38bdf8',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {isControllingStream ? <Loader2 size={13} className="spin-icon" /> : <Play size={13} fill="currentColor" />}
            <span>Play Feed</span>
          </button>

          {/* Upload Offline Video Button (Item 26) */}
          <button
            className="icon-btn"
            onClick={handleUploadVideoClick}
            disabled={uploadingVideo || isControllingStream}
            title="Upload local surveillance or test video file (MP4/AVI/MKV/MOV) for offline AI inspection"
            style={{
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid #a855f7',
              color: '#c084fc',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {uploadingVideo ? <Loader2 size={13} className="spin-icon" /> : <Upload size={13} />}
            <span>{uploadingVideo ? 'Uploading...' : 'Upload Video'}</span>
          </button>

          {/* Webcam Button */}
          <button
            className="icon-btn"
            onClick={handleStartWebcam}
            disabled={isControllingStream}
            title="Open Live Device Camera with Real-Time AI Detection"
            style={{
              background: activeSourceType === 'browser_webcam' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${activeSourceType === 'browser_webcam' ? '#34d399' : '#10b981'}`,
              color: '#34d399',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeSourceType === 'browser_webcam' ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
            }}
          >
            <Video size={13} />
            <span>{activeSourceType === 'browser_webcam' ? 'Webcam (Active)' : 'Webcam'}</span>
          </button>

          {/* Mirror Toggle Button (Browser Webcam Mode Only) */}
          {streamMode === 'browser_webcam' && (
            <button
              className="icon-btn"
              onClick={() => setIsWebcamMirror((prev) => !prev)}
              title={isWebcamMirror ? 'Disable Mirror Mode' : 'Enable Mirror Mode'}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '0.35rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <FlipHorizontal size={13} />
              <span>{isWebcamMirror ? 'Mirrored' : 'Normal'}</span>
            </button>
          )}

          {/* Virtual Fence Zone (Blue Box) Toggle Button */}
          <button
            className="icon-btn"
            onClick={handleToggleZone}
            disabled={isControllingStream}
            title={showZone ? "Virtual Fence (Blue Box) is Active. Click to Remove / Hide." : "Virtual Fence (Blue Box) is Hidden. Click to Enable."}
            style={{
              background: showZone ? 'rgba(14, 165, 233, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              border: `1px solid ${showZone ? '#38bdf8' : '#64748b'}`,
              color: showZone ? '#38bdf8' : '#94a3b8',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Shield size={13} />
            <span>{showZone ? 'Zone: ON' : 'Zone: OFF'}</span>
          </button>

          {/* Custom Fence Drawing Mode Toggle (Item 11) */}
          {streamMode === 'browser_webcam' && (
            <>
              <button
                className="icon-btn"
                onClick={() => setIsDrawingFence((prev) => !prev)}
                title={isDrawingFence ? "Drawing mode active: Click canvas to add vertices, click 'Done' when finished." : "Draw custom virtual fence polygon on video canvas"}
                style={{
                  background: isDrawingFence ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${isDrawingFence ? '#f59e0b' : '#d97706'}`,
                  color: isDrawingFence ? '#fbbf24' : '#f59e0b',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={13} />
                <span>{isDrawingFence ? `Done (${customFencePoints.length} pts)` : 'Draw Fence'}</span>
              </button>

              {customFencePoints.length > 0 && (
                <button
                  className="icon-btn"
                  onClick={handleResetCustomZone}
                  title="Reset custom fence back to default perimeter side corridor"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '0.35rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Zone</span>
                </button>
              )}
            </>
          )}

          {/* Stop Stream Button */}
          {!manuallyStopped && (
            <button
              className="icon-btn"
              onClick={handleStopStream}
              disabled={isControllingStream}
              title="Stop Camera Stream"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          )}

          <button
            className="icon-btn"
            onClick={handleRefresh}
            title="Refresh Stream Ingestion"
            aria-label="Refresh Camera Stream"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            aria-label="Toggle Fullscreen Video View"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Video Viewport or 4-Cam Grid (Item 10) */}
      {viewLayout === 'grid' ? (
        <div
          className="tactical-grid-viewport"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '0.85rem',
            padding: '0.85rem',
            background: '#020617',
            minHeight: '520px',
          }}
        >
          {['CAM_01', 'CAM_02', 'CAM_03', 'CAM_04'].map((gridCamId) => {
            const camMeta = validCameras.find((c) => c.camera_id === gridCamId) || {
              camera_id: gridCamId,
              name: gridCamId === 'CAM_01' ? 'Sector 01 Gate' : gridCamId === 'CAM_02' ? 'Sector 02 Perimeter' : gridCamId === 'CAM_03' ? 'Border Outpost 01' : 'Sector 04 Perimeter',
              location: 'Border Security Zone',
            };
            const isTargetSelected = gridCamId === cameraId;
            const hasLocalIntrusion = isTargetSelected && (clientHasIntrusion || camTelemetry.occupancy > 0);

            return (
              <div
                key={gridCamId}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-md)',
                  border: hasLocalIntrusion
                    ? '2px solid #ef4444'
                    : isTargetSelected
                    ? '2px solid #0284c7'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                  background: '#090d16',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: hasLocalIntrusion
                    ? '0 0 15px rgba(239, 68, 68, 0.35)'
                    : isTargetSelected
                    ? '0 0 12px rgba(2, 132, 199, 0.3)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Tactical Tile Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.75rem',
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    zIndex: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: hasLocalIntrusion ? '#ef4444' : '#10b981',
                        boxShadow: hasLocalIntrusion ? '0 0 8px #ef4444' : '0 0 6px #10b981',
                      }}
                    />
                    <span>{camMeta.name || gridCamId}</span>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>({gridCamId})</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {hasLocalIntrusion && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.2)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        ALERT ACTIVE
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCamera?.(gridCamId);
                        setViewLayout('single');
                      }}
                      style={{
                        background: 'rgba(14, 165, 233, 0.2)',
                        border: '1px solid rgba(14, 165, 233, 0.5)',
                        color: '#38bdf8',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Focus View
                    </button>
                  </div>
                </div>

                {/* Tactical Tile Feed Viewport */}
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000000',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={getLiveFeedUrl(gridCamId, { v: streamKey })}
                    alt={`Surveillance feed ${gridCamId}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      e.target.style.opacity = '0.35';
                    }}
                  />

                  {/* Corner reticles for tactical aesthetics */}
                  <div style={{ position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderTop: '1.5px solid #38bdf8', borderLeft: '1.5px solid #38bdf8', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderTop: '1.5px solid #38bdf8', borderRight: '1.5px solid #38bdf8', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 6, left: 6, width: 10, height: 10, borderBottom: '1.5px solid #38bdf8', borderLeft: '1.5px solid #38bdf8', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 6, right: 6, width: 10, height: 10, borderBottom: '1.5px solid #38bdf8', borderRight: '1.5px solid #38bdf8', pointerEvents: 'none' }} />

                  {/* Tile Bottom Telemetry Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      right: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(2, 6, 23, 0.75)',
                      backdropFilter: 'blur(4px)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      ● LIVE INGEST
                    </span>
                    <span>HD 1280x720</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          ref={videoContainerRef}
          className={`live-viewport-container video-viewport ${isFullscreen ? 'fullscreen-mode' : ''}`}
        >
        {/* Optical HUD Crosshair & Reticles */}
        <div className="reticle top-left" />
        <div className="reticle top-right" />
        <div className="reticle bottom-left" />
        <div className="reticle bottom-right" />

        {/* Tactical Crosshair watermark in center */}
        <div className="tactical-crosshair" />

        {/* Loading Radar Overlay if stream is initializing */}
        {!manuallyStopped && !isLoaded && !hasError && (
          <div className="stream-loader-overlay">
            <div className="radar-spinner" />
            <div className="stream-loader-text">
              <Activity size={14} />
              SYNCING AI DETECTION STREAM...
            </div>
          </div>
        )}

        {/* Stopped Standby Screen OR Live Stream (Browser Webcam / MJPEG / Fallback) */}
        {manuallyStopped ? (
          <div
            className="stream-stopped-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.99) 100%)',
              color: '#94a3b8',
              zIndex: 5,
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 25px rgba(239, 68, 68, 0.25)',
              }}
            >
              <Square size={28} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ color: '#f8fafc', fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
              CAMERA OFF // FEED STANDBY
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 450, marginBottom: '1.6rem', lineHeight: 1.5 }}>
              Surveillance feed for <strong style={{ color: '#38bdf8' }}>{cameraName} ({cameraId})</strong> has been stopped by operator. Inference pipeline is completely paused with 0% CPU overhead.
            </div>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => handleStartVideoFeed(selectedVideo)}
                disabled={isControllingStream}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  padding: '0.6rem 1.4rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isControllingStream ? <Loader2 size={15} className="spin-icon" /> : <Play size={15} fill="currentColor" />}
                <span>Resume Feed</span>
              </button>
              <button
                onClick={handleStartWebcam}
                disabled={isControllingStream}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  padding: '0.6rem 1.3rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Video size={15} />
                <span>Activate Webcam</span>
              </button>
            </div>
          </div>
        ) : streamMode === 'browser_webcam' ? (
          <div
            className="browser-webcam-container"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#020617',
              overflow: 'hidden',
            }}
          >
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: isWebcamMirror ? 'scaleX(-1)' : 'none',
              }}
            />
            <canvas
              ref={webcamCanvasRef}
              onClick={handleCanvasClick}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: isDrawingFence ? 'auto' : 'none',
                cursor: isDrawingFence ? 'crosshair' : 'default',
                transform: 'none',
              }}
            />
            {webcamError && (
              <div className="stream-error-overlay" style={{ zIndex: 10 }}>
                <AlertTriangle size={36} style={{ color: '#fbbf24', marginBottom: '0.6rem' }} />
                <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                  Webcam Notice
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: 420, marginBottom: '1.2rem', lineHeight: 1.5 }}>
                  {webcamError}
                </div>
                <button
                  onClick={() => handleStartVideoFeed(selectedVideo)}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: '1px solid #38bdf8',
                    color: '#ffffff',
                    padding: '0.55rem 1.2rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Switch to Border Surveillance Feed
                </button>
              </div>
            )}
          </div>
        ) : streamMode === 'no_physical_camera' ? (
          <div
            className="no-physical-camera-container"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Tactical Grid Scan Pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(rgba(245, 158, 11, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.05) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1.5px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 25px rgba(245, 158, 11, 0.2)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <VideoOff size={36} style={{ color: '#fbbf24' }} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '9999px',
                padding: '0.25rem 0.85rem',
                color: '#fbbf24',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                marginBottom: '0.75rem',
                fontFamily: 'var(--font-mono)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  boxShadow: '0 0 8px #f59e0b',
                }}
              />
              SECTOR SENSOR DISCONNECTED // SENSOR OFFLINE
            </div>

            <h3
              style={{
                color: '#f8fafc',
                fontSize: '1.25rem',
                fontWeight: 800,
                marginBottom: '0.5rem',
                position: 'relative',
                zIndex: 1,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Physical Camera Not Connected in this Sector
            </h3>

            <p
              style={{
                color: '#94a3b8',
                fontSize: '0.88rem',
                maxWidth: 540,
                lineHeight: 1.6,
                marginBottom: '1.5rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              No physical optical sensor is currently linked to <strong>{currentCam?.name || cameraId}</strong> in this deployment field. Active physical camera surveillance is routed through <strong>Sector 01 Gate</strong> and <strong>Sector 02 East Fence</strong>. Switch to active sectors to view your live camera or launch an automated simulation feed.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <button
                onClick={() => setIsCctvModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  padding: '0.6rem 1.3rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
                }}
                title="Connect physical CCTV or 1-click cloud test stream to this sector"
              >
                <Plus size={16} />
                <span>+ Connect CCTV Camera to this Sector</span>
              </button>
              <button
                onClick={() => onSelectCamera?.('CAM_01')}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
                }}
              >
                <Video size={15} />
                <span>Switch to Sector 01 (Live Camera)</span>
              </button>
              <button
                onClick={() => onSelectCamera?.('CAM_02')}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Video size={15} />
                <span>Switch to Sector 02 (Live Camera)</span>
              </button>
              <button
                onClick={() => handleStartVideoFeed(selectedVideo)}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  padding: '0.6rem 1.15rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Play size={14} />
                <span>Launch Simulation Scenario</span>
              </button>
            </div>
          </div>
        ) : streamMode === 'mjpeg' ? (
          <img
            key={streamKey}
            src={feedUrl}
            alt={`Live Security Stream - ${cameraId}`}
            className="live-stream-img loaded"
            onLoad={() => {
              setIsLoaded(true);
              setHasError(false);
            }}
            onError={() => {
              console.warn('[LiveFeed] MJPEG stream error, switching to frame polling fallback...');
              setStreamMode('fallback_frame');
              setIsLoaded(true);
              setHasError(false);
            }}
          />
        ) : (
          <img
            src={fallbackFrameUrl}
            alt={`Live Security Stream (Fast Frame Mode) - ${cameraId}`}
            className="live-stream-img loaded"
            onLoad={() => {
              setIsLoaded(true);
              setHasError(false);
            }}
            onError={() => {
              if (streamMode !== 'browser_webcam') {
                setHasError(true);
              }
            }}
          />
        )}

        {/* Stream Overlay HUD (Top Bar) */}
        <div className="viewport-hud top" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(3, 7, 18, 0.75)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(8px)' }}>
          <div className="hud-metric">
            <span
              className="rec-dot"
              style={
                streamMode === 'no_physical_camera'
                  ? { background: '#f59e0b', boxShadow: 'none' }
                  : manuallyStopped
                  ? { background: '#64748b', boxShadow: 'none' }
                  : {}
              }
            />
            <span
              className="hud-label"
              style={{
                color: streamMode === 'no_physical_camera' ? '#fbbf24' : manuallyStopped ? '#94a3b8' : '#f87171',
                fontWeight: 800,
              }}
            >
              {streamMode === 'no_physical_camera' ? 'DISCONNECTED' : manuallyStopped ? 'STANDBY' : 'LIVE'}
            </span>
            <span className="hud-val">
              {streamMode === 'no_physical_camera'
                ? 'NO HARDWARE SENSOR'
                : manuallyStopped
                ? 'STREAM PAUSED'
                : (streamMode === 'browser_webcam' ? 'DEVICE WEBCAM // YOLOv8' : 'YOLOv8 + BYTETRACK')}
            </span>
          </div>
          <div className="hud-metric">
            <Layers size={12} style={{ color: '#06b6d4' }} />
            <span className="hud-label">ZONE:</span>
            <span className="hud-val">{showZone ? 'POLYGON α' : 'MUTED'}</span>
          </div>
          <div className="hud-metric">
            <Users size={12} style={{ color: streamMode === 'no_physical_camera' ? '#94a3b8' : manuallyStopped ? '#64748b' : ((streamMode === 'browser_webcam' ? (clientUnknownPersonCount > 0 || clientUnknownVehicleCount > 0 || clientHasIntrusion) : camTelemetry.occupancy > 0) ? '#f87171' : '#34d399') }} />
            <span className="hud-label">STATUS:</span>
            <span
              className="hud-val"
              style={{
                color: streamMode === 'no_physical_camera' ? '#fbbf24' : manuallyStopped ? '#64748b' : ((streamMode === 'browser_webcam' ? (clientUnknownPersonCount > 0 || clientUnknownVehicleCount > 0 || clientHasIntrusion) : camTelemetry.occupancy > 0) ? '#f87171' : '#34d399'),
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              {streamMode === 'no_physical_camera'
                ? 'SENSOR OFFLINE'
                : manuallyStopped
                ? 'CAMERA OFF'
                : streamMode === 'browser_webcam'
                ? (clientUnknownPersonCount > 0
                  ? `UNKNOWN PERSON IN AREA (${clientUnknownPersonCount})`
                  : clientUnknownVehicleCount > 0
                  ? `UNKNOWN VEHICLE IN AREA (${clientUnknownVehicleCount})`
                  : clientHasIntrusion
                  ? `ZONE INTRUSION (${clientTelemetry.occupancy || 1})`
                  : 'SECTOR CLEAR')
                : (camTelemetry.occupancy > 0
                  ? `TARGET DETECTED (${camTelemetry.occupancy})`
                  : 'SECTOR CLEAR')}
            </span>
          </div>
        </div>

        {/* Stream Overlay HUD (Bottom Right FPS & Stream Info) */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 6,
            background: 'rgba(3, 7, 18, 0.75)',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-sm)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            color: '#94a3b8',
          }}
        >
          <span style={{ color: streamMode === 'no_physical_camera' ? '#f59e0b' : manuallyStopped ? '#64748b' : '#38bdf8', fontWeight: 700 }}>
            {streamMode === 'no_physical_camera'
              ? '0.0 OFFLINE'
              : manuallyStopped
              ? '0.0'
              : (streamMode === 'browser_webcam'
                ? (clientTelemetry.fps ? clientTelemetry.fps.toFixed(1) : '30.0')
                : (camTelemetry.fps ? camTelemetry.fps.toFixed(1) : '30.0'))} FPS
          </span>
          <span style={{ color: '#64748b' }}>|</span>
          <span>
            {streamMode === 'no_physical_camera'
              ? 'UNMAPPED SENSOR'
              : manuallyStopped
              ? 'PAUSED'
              : (streamMode === 'browser_webcam' ? 'LIVE CAMERA' : 'LOOP ACTIVE')}
          </span>
        </div>

        {/* Fallback Display if stream disconnects */}
        {hasError && streamMode !== 'browser_webcam' && !manuallyStopped && (
          <div className="stream-error-overlay">
            <AlertTriangle size={36} style={{ color: '#fbbf24', marginBottom: '0.5rem' }} />
            <div className="error-heading" style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              CAMERA STREAM DISCONNECTED
            </div>
            <p className="error-sub" style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: '400px', margin: '0.4rem auto' }}>
              The camera feed process is initializing or standby. Click below to launch the surveillance loop.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
              <button
                className="action-btn"
                onClick={() => handleStartVideoFeed(selectedVideo)}
                style={{
                  background: 'var(--border-accent)',
                  color: '#fff',
                  padding: '0.45rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Play size={14} fill="currentColor" />
                Start Surveillance Loop
              </button>
              <button
                className="action-btn retry-btn"
                onClick={handleRefresh}
                style={{
                  background: 'rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  padding: '0.45rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <RefreshCw size={14} />
                Retry Connection
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Feed Panel Footer */}
      <div className="live-feed-footer" style={{ padding: '0.75rem 1.1rem' }}>
        <div className="footer-meta-item">
          <Shield size={14} style={{ color: '#34d399' }} />
          <span>Surveillance Zone:</span>
          <strong style={{ color: '#f8fafc' }}>{location}</strong>
        </div>
        <div className="footer-meta-item">
          <Users size={14} style={{ color: '#06b6d4' }} />
          <span>Footfall:</span>
          <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            IN: +{camTelemetry.footfall_in} | OUT: -{camTelemetry.footfall_out}
          </span>
        </div>
        <div className="footer-meta-item">
          <Cpu size={14} style={{ color: '#a855f7' }} />
          <span>Vitals:</span>
          <span style={{ color: '#c084fc', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            CPU {systemHealth?.cpu_percent ?? 0}% | {systemHealth?.active_streams ?? 1} STREAMS
          </span>
        </div>
      </div>

      <CctvConnectModal
        isOpen={isCctvModalOpen}
        onClose={() => setIsCctvModalOpen(false)}
        initialCameraId={cameraId}
        onCameraConnected={(camId) => {
          setManuallyStopped(false);
          setStreamMode('mjpeg');
          setStreamKey(Date.now());
          if (onSelectCamera) onSelectCamera(camId);
        }}
      />
    </div>
  );
}
