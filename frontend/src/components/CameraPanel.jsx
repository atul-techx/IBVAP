import React, { useState } from 'react';
import { Camera, Play, Radio, CheckCircle2, Shield, AlertCircle, Loader2, Plus } from 'lucide-react';
import { triggerPipeline } from '../services/api';
import CctvConnectModal from './CctvConnectModal';

export default function CameraPanel({
  cameras = [],
  selectedCameraId = 'CAM_01',
  onSelectCamera,
  onPipelineTriggered,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [isCctvModalOpen, setIsCctvModalOpen] = useState(false);

  const validCameras = (cameras || []).filter(
    (c) => c?.camera_id && !c.camera_id.toUpperCase().startsWith('SYSTEM') && !c.camera_id.toUpperCase().startsWith('AUTH')
  );
  const physicalCamerasCount = validCameras.filter(c => c.camera_id === 'CAM_01' || c.camera_id === 'CAM_02').length;

  const handleRunDemo = async () => {
    setIsRunning(true);
    setTriggerMsg('Running YOLOv8 + ByteTrack pipeline...');
    try {
      await triggerPipeline();
      setTriggerMsg('Pipeline active! Streaming events...');
      if (onPipelineTriggered) onPipelineTriggered();
    } catch (err) {
      setTriggerMsg('Failed to trigger pipeline: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsRunning(false);
        setTriggerMsg('');
      }, 8000);
    }
  };

  return (
    <div className="panel-card" role="region" aria-label="Camera Management Panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="panel-title">
          <Camera size={18} style={{ color: 'var(--color-cyan)' }} />
          Border Sector Cameras
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            onClick={() => setIsCctvModalOpen(true)}
            style={{
              background: 'rgba(14, 165, 233, 0.16)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '0.22rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="Connect external IP camera or RTSP CCTV stream"
          >
            <Plus size={13} />
            <span>+ Connect CCTV</span>
          </button>
          <span
            className="badge-tag"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}
          >
            {physicalCamerasCount} PHYSICAL CAM / {validCameras.length || 4} SECTORS
          </span>
        </div>
      </div>

      <div className="camera-list-container">
        {validCameras.length === 0 ? (
          // Skeleton loading
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="skeleton" style={{ height: 20, width: '60%' }} />
            <div className="skeleton" style={{ height: 60, width: '100%' }} />
          </div>
        ) : (
          validCameras.map((cam) => {
            const isSelected = cam.camera_id === selectedCameraId;
            const isPhys = cam.camera_id === 'CAM_01' || cam.camera_id === 'CAM_02';

            return (
              <div
                key={cam.camera_id}
                className={`camera-card ${isSelected ? 'selected-active' : ''}`}
                onClick={() => onSelectCamera && onSelectCamera(cam.camera_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectCamera && onSelectCamera(cam.camera_id);
                  }
                }}
                title={`Switch live feed view to ${cam.name}`}
              >
                <div className="camera-header">
                  <div className="camera-name" style={{ color: isSelected ? '#38bdf8' : '#fff' }}>
                    <Radio size={15} style={{ color: isPhys ? '#34d399' : '#f59e0b' }} />
                    <span>{cam.name}</span>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          background: isPhys ? '#0ea5e9' : '#d97706',
                          color: '#fff',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        ACTIVE VIEW
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: isPhys ? '#34d399' : '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {isPhys ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {isPhys ? 'PHYSICAL CAM' : 'NO SENSOR'}
                  </span>
                </div>

                <div className="camera-meta-grid">
                  <div className="meta-item">
                    <label>CAMERA ID</label>
                    <span>{cam.camera_id}</span>
                  </div>
                  <div className="meta-item">
                    <label>RESOLUTION</label>
                    <span>{cam.resolution || '1280x720'}</span>
                  </div>
                  <div className="meta-item">
                    <label>STREAM FPS</label>
                    <span>{cam.fps ? `${cam.fps} FPS` : '30 FPS'}</span>
                  </div>
                  <div className="meta-item">
                    <label>ZONE GUARD</label>
                    <span style={{ fontSize: '0.72rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {cam.monitored_zone || 'POLYGON α'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Location: <span style={{ color: 'var(--text-secondary)' }}>{cam.location}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="camera-panel-footer">
        <button
          className="action-btn"
          onClick={handleRunDemo}
          disabled={isRunning}
          title="Simulate automated video ingestion and run YOLOv8 + ByteTrack detection"
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="pulse-dot" />
              <span>Processing Ingestion Feed...</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Trigger Video Ingestion Test</span>
            </>
          )}
        </button>

        {triggerMsg && (
          <div
            style={{
              fontSize: '0.76rem',
              color: '#38bdf8',
              background: 'rgba(14, 165, 233, 0.12)',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              border: '1px solid rgba(14, 165, 233, 0.35)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {triggerMsg}
          </div>
        )}

        <div className="protection-spec-box">
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Shield size={14} style={{ color: '#0ea5e9' }} />
            Active AI Perimeter Specs
          </div>
          <div>&bull; Model: YOLOv8n Object Detector</div>
          <div>&bull; Tracking: ByteTrack Multi-Target</div>
          <div>&bull; Virtual Fence: Polygon α Zone Geometry</div>
        </div>
      </div>

      <CctvConnectModal
        isOpen={isCctvModalOpen}
        onClose={() => setIsCctvModalOpen(false)}
        initialCameraId={selectedCameraId || 'CAM_03'}
        onCameraConnected={(camId) => {
          if (onSelectCamera) onSelectCamera(camId);
          if (onPipelineTriggered) onPipelineTriggered();
        }}
      />
    </div>
  );
}
