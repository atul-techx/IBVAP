import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import StatsRow from './components/StatsRow';
import LiveAlertFeed from './components/LiveAlertFeed';
import LiveVideoFeed from './components/LiveVideoFeed';
import CameraPanel from './components/CameraPanel';
import EventHistory from './components/EventHistory';
import SnapshotModal from './components/SnapshotModal';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import PlatformOverview from './components/PlatformOverview';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchStats, fetchCameras, fetchEvents, WS_BASE } from './services/api';
import voiceAlertService from './services/voiceAlertService';
import { ShieldAlert } from 'lucide-react';

function DashboardContent() {
  const { isAuthenticated, user, token, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('CAM_01');
  const [liveEvents, setLiveEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isVoiceMuted, setIsVoiceMuted] = useState(voiceAlertService.isMuted());
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [lastEventTime, setLastEventTime] = useState(null);
  const wsRef = useRef(null);
  const lastStatsFetchRef = useRef(0);
  const seenEventIdsRef = useRef(new Set());

  // Subscribe to voice alert service state
  useEffect(() => {
    const unsubscribe = voiceAlertService.subscribe(({ isMuted, isSpeaking }) => {
      setIsVoiceMuted(isMuted);
      setIsVoiceSpeaking(isSpeaking);
    });
    return unsubscribe;
  }, []);

  // When user successfully logs in, immediately route them to the Live Command Center
  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab((prev) => (prev === 'overview' ? 'live' : prev));
    }
  }, [isAuthenticated]);

  // Load initial REST data once authenticated
  const loadInitialData = async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, camerasData, eventsData] = await Promise.all([
        fetchStats(),
        fetchCameras(),
        fetchEvents({ limit: 50 }),
      ]);
      const validCams = (camerasData || []).filter(
        (c) => c?.camera_id && !c.camera_id.toUpperCase().startsWith('SYSTEM') && !c.camera_id.toUpperCase().startsWith('AUTH')
      );
      setStats(statsData);
      setCameras(validCams);

      if (validCams && validCams.length > 0) {
        setSelectedCameraId((prev) => {
          const exists = validCams.some((c) => c.camera_id === prev);
          return exists ? prev : validCams[0].camera_id;
        });
      }

      // Seed live events with unique historical events
      setLiveEvents((prev) => {
        const incoming = eventsData.events || [];
        const existingIds = new Set(prev.map((e) => e.event_id));
        const uniqueNew = incoming.filter((e) => !existingIds.has(e.event_id));
        return [...prev, ...uniqueNew];
      });
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
      // Poll camera statuses and summary stats periodically (2.5s for fast auto-discovery)
      const interval = setInterval(async () => {
        try {
          const [statsData, camerasData] = await Promise.all([
            fetchStats(),
            fetchCameras(),
          ]);
          const validCams = (camerasData || []).filter(
            (c) => c?.camera_id && !c.camera_id.toUpperCase().startsWith('SYSTEM') && !c.camera_id.toUpperCase().startsWith('AUTH')
          );
          setStats(statsData);
          setCameras(validCams);
        } catch {
          // Silent failure for background polling
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // WebSocket Connection Management (Active while authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws = null;
    let reconnectTimeout = null;
    let pingInterval = null;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const wsUrl = `${WS_BASE}/ws/events${tokenParam}`;
      console.log('[WS] Connecting securely to', wsUrl.split('?')[0]);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isCleanedUp) {
          ws.close();
          return;
        }
        console.log('WebSocket connection opened:', new Date().toISOString());
        setIsConnected(true);

        // Keep connection active with 10s ping intervals
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('ping');
            } catch (_) {}
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Keepalive / handshake frames
          if (
            data.type === 'connection_established' ||
            data.type === 'pong' ||
            data.type === 'ping' ||
            data.type === 'heartbeat'
          ) {
            return;
          }

          // Handle camera heartbeat / detection pipeline start notification
          if (data.type === 'camera_heartbeat') {
            console.log('[WS] Camera Heartbeat received for', data.camera_id, '-> ONLINE');
            setCameras((prevCams) => {
              const idx = prevCams.findIndex((c) => c.camera_id === data.camera_id);
              if (idx >= 0) {
                const copy = [...prevCams];
                copy[idx] = { ...copy[idx], status: 'online', last_seen: data.last_seen || new Date().toISOString() };
                return copy;
              }
              return [
                ...prevCams,
                {
                  camera_id: data.camera_id,
                  name: data.name || `Sector ${data.camera_id} Gate`,
                  location: data.location || `Perimeter ${data.camera_id}`,
                  status: 'online',
                  last_seen: data.last_seen || new Date().toISOString(),
                },
              ];
            });
            setLastEventTime(Date.now());
            return;
          }

          console.log('[WS] Received Live Security Event:', data.event_id, data.object_class, data.event_type);
          setLastEventTime(Date.now());

          // Deduplicate by event_id synchronously using Ref so voice alerts are never missed
          const eventId = data.event_id;
          let isNewEvent = false;
          if (eventId) {
            if (!seenEventIdsRef.current.has(eventId)) {
              seenEventIdsRef.current.add(eventId);
              if (seenEventIdsRef.current.size > 200) {
                const oldest = seenEventIdsRef.current.values().next().value;
                seenEventIdsRef.current.delete(oldest);
              }
              isNewEvent = true;
            }
          } else {
            isNewEvent = true;
          }

          setLiveEvents((prev) => {
            if (prev.some((e) => e.event_id === data.event_id)) {
              return prev;
            }
            return [data, ...prev].slice(0, 40);
          });

          // Trigger tactical voice alert for high severity events
          if (isNewEvent) {
            voiceAlertService.announceEvent(data);
          }

          // Throttle dashboard metrics refresh (at most once every 3.5s) to eliminate rendering lag
          const now = Date.now();
          if (now - lastStatsFetchRef.current >= 3500) {
            lastStatsFetchRef.current = now;
            fetchStats().then(setStats).catch(() => {});
          }
        } catch (e) {
          console.error('[WS] Error processing message:', e);
        }
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        if (!isCleanedUp) {
          console.log('[WS] Connection dropped, reconnecting in 1.5s...');
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 1500);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Connection error:', err);
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [isAuthenticated, token]);

  // If verifying auth config on initial boot
  if (isAuthLoading) {
    return (
      <div className="login-loading-screen">
        <div className="login-loading-card">
          <ShieldAlert size={36} className="login-spinner-icon" />
          <div className="loading-title">Initializing IBVAP Command Core...</div>
          <div className="loading-sub">Connecting to perimeter security telemetry</div>
        </div>
      </div>
    );
  }

  // Show login screen if requested, otherwise show public platform overview
  if (!isAuthenticated) {
    if (showLoginModal) {
      return <LoginPage onCancel={() => setShowLoginModal(false)} />;
    }
    return (
      <PlatformOverview
        onLaunchCommandCenter={() => setShowLoginModal(true)}
        onLoginClick={() => setShowLoginModal(true)}
        isAuthenticated={false}
        user={null}
      />
    );
  }

  // When authenticated, if activeTab is 'overview', render PlatformOverview inside app container with Header
  if (activeTab === 'overview') {
    return (
      <div className="app-container">
        <Header
          isConnected={isConnected}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          liveCount={liveEvents.length}
          isVoiceMuted={isVoiceMuted}
          isVoiceSpeaking={isVoiceSpeaking}
          onToggleVoiceMute={() => voiceAlertService.toggleMute()}
          onTestVoice={() => voiceAlertService.testVoice()}
        />
        <PlatformOverview
          onLaunchCommandCenter={() => setActiveTab('live')}
          onLoginClick={() => {}}
          isAuthenticated={true}
          user={user}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        isConnected={isConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveCount={liveEvents.length}
        isVoiceMuted={isVoiceMuted}
        isVoiceSpeaking={isVoiceSpeaking}
        onToggleVoiceMute={() => voiceAlertService.toggleMute()}
        onTestVoice={() => voiceAlertService.testVoice()}
      />

      <main className="main-content">
        <StatsRow stats={stats} />

        {activeTab === 'live' ? (
          (() => {
            const currentCam =
              cameras.find((c) => c.camera_id === selectedCameraId) ||
              cameras[0] || {
                camera_id: 'CAM_01',
                name: 'Sector 4 Gate',
                location: 'North Perimeter Fence - Sector 4',
                status: 'online',
              };

            return (
              <div className="dashboard-grid">
                <div className="feed-column">
                  <LiveVideoFeed
                    cameraId={currentCam.camera_id}
                    cameraName={currentCam.name}
                    location={currentCam.location}
                    cameras={cameras}
                    onSelectCamera={setSelectedCameraId}
                    lastEventTime={lastEventTime}
                  />
                  <LiveAlertFeed
                    events={liveEvents}
                    onSelectEvent={setSelectedEvent}
                    isLoading={isLoadingInitial}
                  />
                </div>
                <div className="sidebar-column">
                  <CameraPanel
                    cameras={cameras}
                    selectedCameraId={currentCam.camera_id}
                    onSelectCamera={setSelectedCameraId}
                    onPipelineTriggered={() => {
                      setTimeout(loadInitialData, 1500);
                    }}
                  />
                </div>
              </div>
            );
          })()
        ) : activeTab === 'history' ? (
          <EventHistory onSelectEvent={setSelectedEvent} />
        ) : (
          <AdminPanel />
        )}
      </main>

      <SnapshotModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
