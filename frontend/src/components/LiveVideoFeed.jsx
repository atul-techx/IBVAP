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
  Zap,
  Users,
  Cpu,
  ArrowDownRight,
  Video,
  Square,
  Play,
  Film,
  Loader2,
} from 'lucide-react';
import { getLiveFeedUrl, fetchSystemHealth, startStream, stopStream, fetchStreamStatus } from '../services/api';

export default function LiveVideoFeed({
  cameraId = 'CAM_01',
  cameraName = 'Sector 4 Gate',
  location = 'North Perimeter Fence - Sector 4',
  cameras = [],
  onSelectCamera,
  lastEventTime = null,
}) {
  const [streamKey, setStreamKey] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [streamProcesses, setStreamProcesses] = useState({});
  const [isControllingStream, setIsControllingStream] = useState(false);
  const videoContainerRef = useRef(null);
  const prevCamStatusRef = useRef(null);

  const feedUrl = `${getLiveFeedUrl(cameraId)}?v=${streamKey}`;

  const validCameras = (cameras || []).filter(
    (c) => c?.camera_id && !c.camera_id.toUpperCase().startsWith('SYSTEM') && !c.camera_id.toUpperCase().startsWith('AUTH')
  );

  const currentCam = validCameras.find((c) => c.camera_id === cameraId) || validCameras[0];
  const isProcessRunning = streamProcesses[cameraId]?.running || false;
  const isCamOnline = currentCam?.status === 'online' || isProcessRunning;

  // Poll system health & stream process status periodically
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
      } catch (err) {
        // Silently handle
      }
    };
    pollStatus();
    const interval = setInterval(pollStatus, 2500);
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

  // Reset loading state when switching camera source
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setStreamKey(Date.now());
  }, [cameraId]);

  // 1-Click Launch Live Webcam
  const handleStartWebcam = async () => {
    setIsControllingStream(true);
    setHasError(false);
    setIsLoaded(false);
    try {
      await startStream(cameraId, { source: 0, sourceType: 'webcam' });
      // Fast reconnect polling
      let attempts = 0;
      const pollTimer = setInterval(() => {
        attempts += 1;
        setStreamKey(Date.now());
        if (attempts >= 6) clearInterval(pollTimer);
      }, 1000);
    } catch (err) {
      alert(`Failed to start webcam: ${err.message}`);
    } finally {
      setIsControllingStream(false);
    }
  };

  // 1-Click Launch Test Video Feed
  const handleStartTestVideo = async () => {
    setIsControllingStream(true);
    setHasError(false);
    setIsLoaded(false);
    try {
      await startStream(cameraId, { source: 'test_video', sourceType: 'test_video' });
      let attempts = 0;
      const pollTimer = setInterval(() => {
        attempts += 1;
        setStreamKey(Date.now());
        if (attempts >= 6) clearInterval(pollTimer);
      }, 1000);
    } catch (err) {
      alert(`Failed to start test video: ${err.message}`);
    } finally {
      setIsControllingStream(false);
    }
  };

  // 1-Click Stop Active Stream
  const handleStopStream = async () => {
    setIsControllingStream(true);
    try {
      await stopStream(cameraId);
      setStreamProcesses((prev) => ({
        ...prev,
        [cameraId]: { running: false, pid: null },
      }));
      setStreamKey(Date.now());
    } catch (err) {
      alert(`Failed to stop stream: ${err.message}`);
    } finally {
      setIsControllingStream(false);
    }
  };

  // Auto-connect stream as soon as camera becomes 'online'
  useEffect(() => {
    if (isCamOnline && prevCamStatusRef.current !== 'online') {
      console.log(`[LiveFeed] Camera ${cameraId} is now ONLINE -> Connecting live stream immediately...`);
      setHasError(false);
      setStreamKey(Date.now());
    }
    prevCamStatusRef.current = currentCam?.status;
  }, [isCamOnline, currentCam?.status, cameraId]);

  // Auto-refresh stream if a new live security event or heartbeat arrives
  useEffect(() => {
    if (lastEventTime) {
      if (hasError || !isLoaded) {
        setHasError(false);
        setStreamKey(Date.now());
      }
    }
  }, [lastEventTime]);

  // Auto-reconnect watchdog on error or disconnect (retries every 2.0s)
  useEffect(() => {
    if (hasError) {
      const retryTimer = setTimeout(() => {
        console.log(`[LiveFeed] Reconnecting stream for ${cameraId}...`);
        setStreamKey(Date.now());
        setHasError(false);
      }, 2000);
      return () => clearTimeout(retryTimer);
    }
  }, [hasError, cameraId]);

  const handleRefresh = () => {
    setHasError(false);
    setIsLoaded(false);
    setStreamKey(Date.now());
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

  return (
    <div className="card live-feed-card" role="region" aria-label="Live Video Surveillance Stream">
      {/* Feed Panel Header */}
      <div className="card-header live-feed-header">
        <div className="live-feed-title-wrap">
          <div className={`status-indicator ${isCamOnline ? 'online' : 'standby'}`}>
            <span className="pulse-dot" />
            {isCamOnline ? 'LIVE FEED' : 'STANDBY'}
          </div>

          {/* Camera Selector Dropdown */}
          <div className="camera-selector-wrap">
            <Radio size={15} className="cam-icon" />
            <select
              className="camera-dropdown"
              value={cameraId}
              onChange={(e) => onSelectCamera?.(e.target.value)}
              aria-label="Select Monitored Camera"
            >
              {validCameras.map((cam) => (
                <option key={cam.camera_id} value={cam.camera_id}>
                  {cam.name || cam.camera_id} ({cam.location || 'Perimeter Sector'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls & Instant 1-Click Camera Launcher */}
        <div className="feed-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {isProcessRunning ? (
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
              {isControllingStream ? <Loader2 size={13} className="spin-icon" /> : <Square size={13} fill="currentColor" />}
              <span>Stop Stream</span>
            </button>
          ) : (
            <>
              {/* Instant Webcam Button */}
              <button
                className="icon-btn"
                onClick={handleStartWebcam}
                disabled={isControllingStream}
                title="Activate Local Webcam Instant Ingestion"
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#34d399',
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
                {isControllingStream ? <Loader2 size={13} className="spin-icon" /> : <Video size={13} />}
                <span>Start Webcam</span>
              </button>

              {/* Instant Test Video Button */}
              <button
                className="icon-btn"
                onClick={handleStartTestVideo}
                disabled={isControllingStream}
                title="Run Recorded Surveillance Video Pipeline"
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
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
                <span>Test Video</span>
              </button>
            </>
          )}

          <button
            className="icon-btn"
            onClick={handleRefresh}
            title="Refresh Stream Ingestion"
            aria-label="Refresh Camera Stream"
          >
            <RefreshCw size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            aria-label="Toggle Fullscreen Video View"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        ref={videoContainerRef}
        className={`video-viewport ${isFullscreen ? 'fullscreen-mode' : ''}`}
      >
        {/* Optical HUD Crosshair & Reticles */}
        <div className="reticle top-left" />
        <div className="reticle top-right" />
        <div className="reticle bottom-left" />
        <div className="reticle bottom-right" />

        {/* Tactical Crosshair watermark in center */}
        <div className="tactical-crosshair" />

        {/* Loading Radar Overlay if stream is initializing */}
        {!isLoaded && !hasError && (
          <div className="stream-loader-overlay">
            <div className="radar-spinner" />
            <div className="stream-loader-text">
              <Activity size={14} />
              CONNECTING TO MJPEG VIDEO INGESTION STREAM...
            </div>
          </div>
        )}

        {/* Live MJPEG Image Stream */}
        <img
          key={streamKey}
          src={feedUrl}
          alt={`Live Security Stream - ${cameraId}`}
          className={`live-stream-img ${isLoaded ? 'loaded' : 'loading'}`}
          onLoad={() => {
            setIsLoaded(true);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
            setIsLoaded(false);
          }}
        />

        {/* Stream Overlay HUD */}
        <div className="viewport-hud top">
          <div className="hud-metric">
            <span className="rec-dot" />
            <span className="hud-label">REC</span>
            <span className="hud-val">MJPEG STREAM</span>
          </div>
          <div className="hud-metric">
            <Layers size={12} style={{ color: '#06b6d4' }} />
            <span className="hud-label">ZONE:</span>
            <span className="hud-val">POLYGON α</span>
          </div>
          <div className="hud-metric">
            <Users size={12} style={{ color: '#38bdf8' }} />
            <span className="hud-label">OCCUPANCY:</span>
            <span className="hud-val" style={{ color: '#38bdf8', fontWeight: 700 }}>
              {camTelemetry.occupancy} INSIDE
            </span>
          </div>
        </div>

        {/* Fallback Display if stream disconnects */}
        {hasError && (
          <div className="stream-error-overlay">
            <AlertTriangle size={38} style={{ color: '#fbbf24', marginBottom: '0.6rem' }} />
            <div className="error-heading">CAMERA FEED DISCONNECTED</div>
            <p className="error-sub">
              Unable to reach MJPEG feed for {cameraId}. Ensure the backend server and video ingestion engine are active.
            </p>
            <button className="action-btn retry-btn" onClick={handleRefresh}>
              <RefreshCw size={14} />
              Reconnect Stream
            </button>
          </div>
        )}
      </div>

      {/* Feed Panel Footer */}
      <div className="live-feed-footer">
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
    </div>
  );
}
