import React, { useState } from 'react';
import {
  X,
  Video,
  Radio,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  Cpu,
  Server,
  Globe,
  Sparkles,
  Loader2,
  Info,
  ExternalLink,
} from 'lucide-react';
import { startStream } from '../services/api';

const BRAND_PRESETS = [
  {
    id: 'cloud_test_1',
    brand: '⚡ 1-Click Cloud Test (Border Outpost)',
    description: 'Instant live test feed optimized for cloud containers without physical IP hardware',
    url: 'sample.mp4',
    sourceType: 'test_video',
    proto: 'Direct AI Feed',
    isCloudReady: true,
  },
  {
    id: 'cloud_test_2',
    brand: '⚡ 1-Click Suspicious Loitering Feed',
    description: 'Autonomous intruder and behavior tracking evaluation scenario',
    url: 'suspicious_behavior_test.mp4',
    sourceType: 'test_video',
    proto: 'Direct AI Feed',
    isCloudReady: true,
  },
  {
    id: 'hikvision',
    brand: 'Hikvision IP Camera',
    description: 'Standard Hikvision NVR/IPC H.264 RTSP channel stream',
    url: 'rtsp://admin:pass123@192.168.1.64:554/Streaming/Channels/101',
    sourceType: 'rtsp',
    proto: 'RTSP over TCP',
  },
  {
    id: 'cpplus',
    brand: 'CP Plus CCTV',
    description: 'CP Plus Orange/Indigo IP Camera realmonitor stream',
    url: 'rtsp://admin:admin123@192.168.1.250:554/cam/realmonitor?channel=1&subtype=0',
    sourceType: 'rtsp',
    proto: 'RTSP over TCP',
  },
  {
    id: 'dahua',
    brand: 'Dahua Technology',
    description: 'Dahua IPC main stream RTSP format',
    url: 'rtsp://admin:pass123@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0',
    sourceType: 'rtsp',
    proto: 'RTSP over TCP',
  },
  {
    id: 'tapo',
    brand: 'TP-Link Tapo',
    description: 'Tapo C200 / C310 ONVIF RTSP High Quality Profile',
    url: 'rtsp://admin:pass123@192.168.1.50:554/stream1',
    sourceType: 'rtsp',
    proto: 'RTSP over TCP',
  },
];

const SECTORS = [
  { id: 'CAM_03', label: 'Sector 03 Southern Outpost (River Boundary)', defaultName: 'Sector 03 Southern CCTV', location: 'South River Boundary - Sector 03' },
  { id: 'CAM_04', label: 'Sector 04 Road Checkpoint Alpha (Highway)', defaultName: 'Sector 04 Checkpoint CCTV', location: 'Main Highway Checkpoint Alpha' },
  { id: 'CAM_01', label: 'Sector 01 Gate (North Perimeter)', defaultName: 'Sector 01 Gate CCTV', location: 'North Perimeter Fence - Sector 01' },
  { id: 'CAM_02', label: 'Sector 02 East Fence Line', defaultName: 'Sector 02 Perimeter CCTV', location: 'East Perimeter Line - Sector 02' },
];

export default function CctvConnectModal({
  isOpen,
  onClose,
  initialCameraId = 'CAM_03',
  onCameraConnected,
}) {
  const [selectedSector, setSelectedSector] = useState(initialCameraId);
  const [selectedPreset, setSelectedPreset] = useState('cloud_test_1');
  const [cameraName, setCameraName] = useState('Sector 03 Southern CCTV');
  const [locationName, setLocationName] = useState('South River Boundary - Sector 03');
  const [streamUrl, setStreamUrl] = useState('sample.mp4');
  const [sourceType, setSourceType] = useState('test_video');
  const [protocol, setProtocol] = useState('Direct AI Feed');
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Sync initial sector selection when opened
  React.useEffect(() => {
    if (initialCameraId) {
      setSelectedSector(initialCameraId);
      const sectorObj = SECTORS.find((s) => s.id === initialCameraId);
      if (sectorObj) {
        setCameraName(sectorObj.defaultName);
        setLocationName(sectorObj.location);
      }
    }
  }, [initialCameraId, isOpen]);

  if (!isOpen) return null;

  const handleSectorChange = (sectorId) => {
    setSelectedSector(sectorId);
    const sectorObj = SECTORS.find((s) => s.id === sectorId);
    if (sectorObj) {
      setCameraName(sectorObj.defaultName);
      setLocationName(sectorObj.location);
    }
  };

  const handleApplyPreset = (preset) => {
    setSelectedPreset(preset.id);
    setStreamUrl(preset.url);
    setSourceType(preset.sourceType);
    setProtocol(preset.proto);
    setStatusMessage({
      type: 'info',
      text: `Loaded ${preset.brand} configuration template.`,
    });
  };

  const handleConnectStream = async (e) => {
    e.preventDefault();
    if (!streamUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide a valid stream source URL or test file.' });
      return;
    }

    setIsConnecting(true);
    setStatusMessage({
      type: 'pending',
      text: `Initializing neural pipeline on ${selectedSector}... verifying stream connection...`,
    });

    try {
      // Determine final source type
      const isRtspOrHttp = streamUrl.startsWith('rtsp://') || streamUrl.startsWith('http://') || streamUrl.startsWith('https://');
      const finalSourceType = isRtspOrHttp ? 'rtsp' : (sourceType || 'test_video');

      await startStream(selectedSector, {
        source: streamUrl.trim(),
        sourceType: finalSourceType,
        cameraName: cameraName.trim(),
        location: locationName.trim(),
        showZone: true,
      });

      setStatusMessage({
        type: 'success',
        text: `Stream successfully linked to ${selectedSector}! Switching live view...`,
      });

      setTimeout(() => {
        setIsConnecting(false);
        if (onCameraConnected) {
          onCameraConnected(selectedSector);
        }
        onClose();
      }, 1200);
    } catch (err) {
      setIsConnecting(false);
      setStatusMessage({
        type: 'error',
        text: `Connection failed: ${err.message || 'Unable to connect to camera source'}`,
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0b1324',
          border: '1px solid rgba(14, 165, 233, 0.45)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(14, 165, 233, 0.15)',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid rgba(30, 41, 59, 0.85)',
            background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.12) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Video size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Connect CCTV / IP Camera Feed
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  RTSP / ONVIF / CLOUD READY
                </span>
              </h2>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                Link physical IP cameras or 1-click cloud evaluator streams into border surveillance sectors.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConnecting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConnectStream} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick instructions alert */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.7rem',
            }}
          >
            <Info size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#38bdf8' }}>Evaluator Note:</strong> Real physical CCTV cameras require public RTSP access or Port 554 forwarding to be reached by cloud servers. For immediate cloud evaluation, click any <strong style={{ color: '#34d399' }}>1-Click Cloud Test</strong> preset below to instantly link a continuous tactical AI scenario!
            </div>
          </div>

          {/* Sector Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Target Surveillance Sector
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem' }}>
              {SECTORS.map((sec) => {
                const isSecSelected = selectedSector === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSectorChange(sec.id)}
                    style={{
                      background: isSecSelected ? 'rgba(14, 165, 233, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSecSelected ? '1.5px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: isSecSelected ? '#f8fafc' : '#94a3b8',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isSecSelected ? '#38bdf8' : '#e2e8f0' }}>
                        {sec.id}
                      </span>
                      {isSecSelected && <CheckCircle2 size={14} style={{ color: '#38bdf8' }} />}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand & Test Stream Presets */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Brand Template or 1-Click Cloud Preset
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {BRAND_PRESETS.map((p) => {
                const isPSelected = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      background: isPSelected
                        ? (p.isCloudReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(14, 165, 233, 0.18)')
                        : 'rgba(15, 23, 42, 0.6)',
                      border: isPSelected
                        ? (p.isCloudReady ? '1.5px solid #34d399' : '1.5px solid #38bdf8')
                        : '1px solid rgba(51, 65, 85, 0.5)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: isPSelected ? '#f8fafc' : '#94a3b8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: p.isCloudReady ? '#34d399' : (isPSelected ? '#38bdf8' : '#e2e8f0') }}>
                      {p.brand}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection URL & Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>
                STREAM SOURCE URL (RTSP / HTTP / TEST VIDEO)
              </label>
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => {
                  setStreamUrl(e.target.value);
                  setSelectedPreset('custom');
                }}
                placeholder="rtsp://admin:password@192.168.1.100:554/live/ch0"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  fontSize: '0.84rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.3rem' }}>
                  CAMERA LABEL / NAME
                </label>
                <input
                  type="text"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  placeholder="e.g. Sector 03 Outpost CCTV"
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.55rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.3rem' }}>
                  PERIMETER LOCATION
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. South River Boundary"
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.55rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                borderRadius: '6px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background:
                  statusMessage.type === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : statusMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(14, 165, 233, 0.15)',
                border:
                  statusMessage.type === 'error'
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : statusMessage.type === 'success'
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(14, 165, 233, 0.4)',
                color:
                  statusMessage.type === 'error'
                    ? '#f87171'
                    : statusMessage.type === 'success'
                    ? '#34d399'
                    : '#38bdf8',
              }}
            >
              {statusMessage.type === 'pending' && <Loader2 size={15} className="pulse-dot" />}
              {statusMessage.type === 'success' && <CheckCircle2 size={15} />}
              {statusMessage.type === 'error' && <AlertTriangle size={15} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isConnecting}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid #475569',
                color: '#cbd5e1',
                padding: '0.65rem 1.25rem',
                borderRadius: '6px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: '1px solid #38bdf8',
                color: '#ffffff',
                padding: '0.65rem 1.4rem',
                borderRadius: '6px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
              }}
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="pulse-dot" />
                  <span>Connecting Stream...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Connect & Activate Stream</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
