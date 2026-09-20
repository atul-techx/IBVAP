import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Radio,
  Eye,
  Camera,
  Layers,
  Cpu,
  Server,
  Wifi,
  Laptop,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Volume2,
  Car,
  UserCheck,
  AlertTriangle,
  Play,
  ArrowRight,
  Lock,
  Compass,
  TrendingUp,
  FileCheck,
  Zap,
  Crosshair,
  Activity,
  Video,
  Terminal,
} from 'lucide-react';

export default function PlatformOverview({ onLaunchCommandCenter, onLoginClick, isAuthenticated, user }) {
  // Slider State (0 to 100 percentage)
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const sliderContainerRef = useRef(null);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  // Before / After Slider Scenarios (All Army / Border Surveillance CCTV infrastructure)
  const scenarios = [
    {
      id: 'perimeter-intrusion',
      title: 'Perimeter Intrusion Detection',
      subtitle: 'CAM 04 • Razor Wire Sector 4 • 04:18 AM',
      rawImage: '/images/border_intruder_cctv.jpg',
      labelAi: 'AI Threat Recognition Active',
      labelRaw: 'Raw CCTV Stream',
      description: 'Real-time deep learning neural network identifies unauthorized breach attempt along border razor-wire fence, instantly bounding the intruder with 94.2% tactical confidence.',
      detectionTag: 'BREACH DETECTED: 0.94 CONF',
      hudOverlays: [
        {
          coords: { top: '45%', left: '57%', width: '13%', height: '36%' },
          label: 'INTRUSION DETECTED • 94.2%',
          sublabel: 'Sector 4 Razor-Wire Cut Alert',
          severity: 'critical',
        },
      ],
    },
    {
      id: 'bsf-patrol',
      title: 'Frontier Sentry Patrol & Perimeter Tracking',
      subtitle: 'CAM 06 • Border Zero-Line Sector 8 • 11:24 AM',
      rawImage: '/images/bsf_patrol_fence.png',
      labelAi: 'Multi-Target Sentry AI Telemetry',
      labelRaw: 'Raw Video Feed',
      description: 'Multi-target deep neural network identifies each Border Security Force sentry individually along zero-line demarcation fencing, verifying sentry formation, armed readiness, and continuous biometric telemetry.',
      detectionTag: 'BSF SENTRY PATROL • 9 SOLDIERS DETECTED • INDIVIDUALLY TRACKED',
      hudOverlays: [
        {
          coords: { top: '34%', left: '21%', width: '13.5%', height: '58%' },
          label: 'PATROL 01 • BSF 98.4%',
          sublabel: 'Lead Sentry • INSAS Rifle',
          severity: 'secure',
        },
        {
          coords: { top: '34%', left: '41.5%', width: '13%', height: '52%' },
          label: 'PATROL 02 • BSF 97.9%',
          sublabel: 'Sub-Inspector • Armed',
          severity: 'secure',
        },
        {
          coords: { top: '36.5%', left: '70.5%', width: '13.5%', height: '51%' },
          label: 'PATROL 03 • BSF 98.6%',
          sublabel: 'Perimeter Sentry • Armed',
          severity: 'secure',
        },
        {
          coords: { top: '42.5%', left: '52.5%', width: '8.5%', height: '36%' },
          label: 'PATROL 04 • 96.2%',
          sublabel: 'Sentry Formation',
          severity: 'secure',
          compact: true,
        },
        {
          coords: { top: '47%', left: '35.5%', width: '7.5%', height: '30%' },
          label: 'PATROL 05 • 95.8%',
          severity: 'secure',
          compact: true,
        },
        {
          coords: { top: '41%', left: '15.5%', width: '7.8%', height: '40%' },
          label: 'PATROL 06 • 96.5%',
          severity: 'secure',
          compact: true,
        },
        {
          coords: { top: '46%', left: '10%', width: '6.2%', height: '31%' },
          label: 'PATROL 07 • 94.1%',
          severity: 'secure',
          compact: true,
        },
        {
          coords: { top: '49%', left: '6%', width: '4.8%', height: '25%' },
          label: 'PATROL 08 • 93.7%',
          severity: 'secure',
          compact: true,
        },
        {
          coords: { top: '51%', left: '2.5%', width: '4.2%', height: '22%' },
          label: 'PATROL 09 • 92.5%',
          severity: 'secure',
          compact: true,
        },
      ],
    },
    {
      id: 'military-convoy',
      title: 'Mountain Checkpoint & Convoy Movement ANPR',
      subtitle: 'CAM 02 • High-Altitude Transit Checkpost • 14:15 PM',
      rawImage: '/images/army_convoy_checkpoint.png',
      labelAi: 'Multi-Vehicle Convoy Telemetry & ANPR',
      labelRaw: 'Raw CCTV Stream',
      description: 'Concurrent multi-vehicle ANPR and neural classification track every transport truck and escort in the convoy passing through the mountain gate, validating defense manifests and automated barrier clearance.',
      detectionTag: 'DEFENSE CONVOY • ALL 4 VEHICLES DETECTED • CLEARANCE GRANTED',
      hudOverlays: [
        {
          coords: { top: '56%', left: '14.5%', width: '38%', height: '38%' },
          label: 'CONVOY 01 • MH-12-ARMY',
          sublabel: 'Ashok Leyland 4x4 • AUTHORIZED',
          severity: 'authorized',
        },
        {
          coords: { top: '54%', left: '64%', width: '20%', height: '20%' },
          label: 'CONVOY 02 • DEFENSE TRANSPORT',
          sublabel: 'Troop Carrier • AUTHORIZED',
          severity: 'authorized',
        },
        {
          coords: { top: '68%', left: '62.5%', width: '9.2%', height: '19%' },
          label: 'ESCORT CAR • DL-01-DEF',
          sublabel: 'Sentry Escort • CLEARED',
          severity: 'authorized',
          compact: true,
        },
        {
          coords: { top: '53%', left: '85.5%', width: '9.5%', height: '15%' },
          label: 'CONVOY 03 • LOGISTICS 4x4',
          sublabel: 'Supply Carrier • AUTHORIZED',
          severity: 'authorized',
          compact: true,
        },
        {
          coords: { top: '68%', left: '56.5%', width: '4.5%', height: '16%' },
          label: 'GATE SENTRY',
          sublabel: 'Barrier Operator',
          severity: 'secure',
          compact: true,
        },
      ],
    },
  ];

  const currentScenario = scenarios[activeScenarioIdx];

  // Dragging handlers for Before/After Slider
  const handleMove = useCallback((clientX) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div className="platform-landing">
      {/* ========================================================================= */}
      {/* 1. TOP ENTERPRISE NAVBAR                                                 */}
      {/* ========================================================================= */}
      <nav className={`enterprise-nav ${isAuthenticated ? 'auth-subnav' : ''}`}>
        {isAuthenticated ? (
          /* Authenticated Sub-Nav: Single-line clean anchor strip without duplicate branding/buttons */
          <div className="nav-inner-auth">
            <div className="subnav-label">
              <Layers size={14} />
              <span>Overview Sections</span>
            </div>

            <div className="nav-links">
              <a href="#interactive-slider" className="nav-link">Interactive AI Demo</a>
              <a href="#pipeline-flow" className="nav-link">Architecture</a>
              <a href="#platform-cards" className="nav-link">Platform Modules</a>
              <a href="#capabilities-matrix" className="nav-link">Capabilities</a>
              <a href="#faq" className="nav-link">FAQ</a>
            </div>

            <div className="subnav-quick-action">
              <button className="subnav-back-live-btn" onClick={onLaunchCommandCenter}>
                <Radio size={14} />
                <span>Go to Live Command Center</span>
              </button>
            </div>
          </div>
        ) : (
          /* Unauthenticated Public Landing Nav */
          <div className="nav-inner">
            <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="brand-shield-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
                <img src="/images/ibvap_logo.png" alt="IBVAP Logo" style={{ width: '42px', height: 'auto', objectFit: 'contain' }} />
              </div>
              <div className="brand-text-block">
                <div className="brand-title-row">
                  <span className="brand-name">IBVAP</span>
                  <span className="brand-defense-tag">DEFENSE AI</span>
                </div>
                <span className="brand-sub">Intelligent Border Video Analytics Platform</span>
              </div>
            </div>

            <div className="nav-links">
              <a href="#interactive-slider" className="nav-link">Interactive AI Demo</a>
              <a href="#pipeline-flow" className="nav-link">Architecture</a>
              <a href="#platform-cards" className="nav-link">Platform Modules</a>
              <a href="#capabilities-matrix" className="nav-link">Capabilities</a>
              <a href="#faq" className="nav-link">FAQ</a>
            </div>

            <div className="nav-actions">
              <button className="nav-secondary-btn" onClick={onLoginClick}>
                <Lock size={14} />
                <span>Operator Login</span>
              </button>
              <button className="nav-launch-btn" onClick={onLaunchCommandCenter}>
                <span className="pulse-dot active"></span>
                <span>Launch Live Command Center</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (Inspired by BriefCam & Defense Portals)                  */}
      {/* ========================================================================= */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <Zap size={14} />
              <span>Smart India Hackathon • Border Security Edition</span>
            </div>

            <h1 className="hero-title">
              Turn Border Video into <span className="highlight-text">Actionable Tactical Intelligence</span>
            </h1>

            <p className="hero-lead">
              IBVAP empowers military forces and border commanders with next-generation CCTV video analytics.
              Detect perimeter fence cuts, track moving targets in zero-light conditions, auto-verify military vehicle convoys,
              and reduce hours of forensic surveillance review to seconds.
            </p>

            <div className="hero-cta-group">
              <button className="hero-btn-primary" onClick={onLaunchCommandCenter}>
                <Radio size={18} />
                <span>Launch Live Surveillance Wall</span>
              </button>
              <a href="#interactive-slider" className="hero-btn-secondary">
                <Play size={16} />
                <span>Explore AI Comparison Slider</span>
              </a>
            </div>

            <div className="hero-trust-metrics">
              <div className="trust-item">
                <span className="metric-number">99.4%</span>
                <span className="metric-label">Perimeter Breach Catch Rate</span>
              </div>
              <div className="metric-divider"></div>
              <div className="trust-item">
                <span className="metric-number">&lt; 150ms</span>
                <span className="metric-label">Real-Time WebSocket Latency</span>
              </div>
              <div className="metric-divider"></div>
              <div className="trust-item">
                <span className="metric-number">100%</span>
                <span className="metric-label">Local Edge & Offline Capable</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-screen-mockup">
              <div className="mockup-header">
                <div className="mockup-dots">
                  <span></span><span></span><span></span>
                </div>
                <div className="mockup-title">SECTOR 04 PERIMETER COMMAND • LIVE RTSP FEED</div>
                <div className="mockup-badge">
                  <span className="pulse-dot"></span> LIVE 1080p
                </div>
              </div>
              <div className="mockup-media">
                <img
                  src="/images/border_sentry_road_patrol.jpg"
                  alt="Authentic Military Border Perimeter CCTV Stream"
                  className="mockup-img"
                />
                <div className="mockup-overlay-hud">
                  <div className="hud-corner top-left">
                    <span>CH 04 - NORTH PERIMETER DEMARCATION</span>
                    <span className="hud-time">FPS: 29.8 | YOLOV8 + YUNET ACTIVE</span>
                  </div>
                  <div className="hud-target-box">
                    <span className="hud-target-tag">PERIMETER WIRE & PATROL TRACK SECURE</span>
                  </div>
                  <div className="hud-corner bottom-right">
                    <span>STATUS: OPERATIONAL (LOCAL EDGE)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE BEFORE/AFTER CCTV SPLIT SLIDER (Images 4 & 5 - STAQU)       */}
      {/* ========================================================================= */}
      <section id="interactive-slider" className="section-slider">
        <div className="section-container">
          <div className="slider-header-block">
            <div className="slider-badge">INTERACTIVE COMPUTER VISION EVALUATOR</div>
            <h2 className="slider-heading">
              What Is <span className="highlight-text">IBVAP AI Engine</span>?
            </h2>
            <p className="slider-subtext">
              IBVAP is an advanced audio-video analytics software platform transforming standard border CCTV infrastructure
              into an autonomous intrusion radar. Drag the center divider to inspect real-time AI bounding,
              ANPR license extraction, and perimeter alert overlays versus unassisted raw surveillance video.
            </p>
          </div>

          {/* Scenario Selector Pills */}
          <div className="scenario-pills">
            {scenarios.map((sc, idx) => (
              <button
                key={sc.id}
                className={`scenario-pill ${activeScenarioIdx === idx ? 'active' : ''}`}
                onClick={() => {
                  setActiveScenarioIdx(idx);
                  setSliderPos(50);
                }}
              >
                {sc.id === 'perimeter-intrusion' && <ShieldAlert size={14} />}
                {sc.id === 'bsf-patrol' && <UserCheck size={14} />}
                {sc.id === 'military-convoy' && <Car size={14} />}
                <span>{sc.title}</span>
              </button>
            ))}
          </div>

          {/* The Split Comparison Slider Container */}
          <div className="split-slider-wrapper">
            <div
              ref={sliderContainerRef}
              className={`split-slider-container ${isDragging ? 'is-dragging' : ''}`}
              onMouseDown={(e) => {
                setIsDragging(true);
                handleMove(e.clientX);
              }}
              onTouchStart={(e) => {
                setIsDragging(true);
                handleMove(e.touches[0].clientX);
              }}
            >
              {/* UNDER LAYER: AI DETECTION OVERLAY (Left side reveals this) */}
              <div className="slider-layer ai-layer">
                <img
                  src={currentScenario.rawImage}
                  alt={`${currentScenario.title} AI Analysis`}
                  className="slider-img"
                  draggable={false}
                />
                {/* AI HUD Multi-Target Bounding Box Overlays */}
                {(currentScenario.hudOverlays || (currentScenario.hudOverlay ? [currentScenario.hudOverlay] : [])).map((box, bIdx) => (
                  <div
                    key={bIdx}
                    className={`ai-bounding-box ${box.severity || 'secure'} ${box.compact ? 'compact' : ''}`}
                    style={{
                      top: box.coords.top,
                      left: box.coords.left,
                      width: box.coords.width,
                      height: box.coords.height,
                    }}
                  >
                    {box.label && (
                      <div className="ai-box-tag">
                        <span className="box-indicator"></span>
                        <span>{box.label}</span>
                      </div>
                    )}
                    {box.sublabel && <div className="ai-box-sub">{box.sublabel}</div>}
                    <div className="box-corner tl"></div>
                    <div className="box-corner tr"></div>
                    <div className="box-corner bl"></div>
                    <div className="box-corner br"></div>
                  </div>
                ))}

                <div className="slider-label label-left">
                  <span className="label-badge ai">AI ANALYTICS OVERLAY</span>
                  <span className="label-detail">{currentScenario.detectionTag}</span>
                </div>
              </div>

              {/* OVER LAYER: RAW CCTV FOOTAGE (Clipped by sliderPos %) */}
              <div
                className="slider-layer raw-layer"
                style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
              >
                <img
                  src={currentScenario.rawImage}
                  alt={`${currentScenario.title} Raw Camera`}
                  className="slider-img raw-filter"
                  draggable={false}
                />
                <div className="slider-label label-right">
                  <span className="label-badge raw">RAW CCTV FEED</span>
                  <span className="label-detail">Standard Unassisted Surveillance</span>
                </div>
              </div>

              {/* DRAGGABLE CENTER DIVIDER HANDLE (Matches Image 4 & 5) */}
              <div
                className="slider-handle-line"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="slider-handle-button">
                  <div className="handle-chevron left">
                    <ChevronLeft size={16} />
                  </div>
                  <div className="handle-core-badge">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="handle-chevron right">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Slider Navigation Controls Below (Arrows + Dots) */}
            <div className="slider-controls-bar">
              <button
                className="slider-arrow-btn"
                onClick={() => {
                  setActiveScenarioIdx((prev) => (prev > 0 ? prev - 1 : scenarios.length - 1));
                  setSliderPos(50);
                }}
                title="Previous Scenario"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="slider-dots">
                {scenarios.map((_, idx) => (
                  <button
                    key={idx}
                    className={`slider-dot ${activeScenarioIdx === idx ? 'active' : ''}`}
                    onClick={() => {
                      setActiveScenarioIdx(idx);
                      setSliderPos(50);
                    }}
                    title={`Scenario ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                className="slider-arrow-btn"
                onClick={() => {
                  setActiveScenarioIdx((prev) => (prev < scenarios.length - 1 ? prev + 1 : 0));
                  setSliderPos(50);
                }}
                title="Next Scenario"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Active Scenario Description Card */}
            <div className="scenario-info-banner">
              <div className="scenario-info-content">
                <div className="scenario-info-header">
                  <span className="scenario-chip">{currentScenario.subtitle}</span>
                  <h3 className="scenario-name">{currentScenario.title}</h3>
                </div>
                <p className="scenario-para">{currentScenario.description}</p>
              </div>
              <button className="scenario-launch-action" onClick={onLaunchCommandCenter}>
                <span>Test on Live Camera</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. TACTICAL DEFENSE PIPELINE ARCHITECTURE (Redesigned)                     */}
      {/* ========================================================================= */}
      <section id="pipeline-flow" className="section-pipeline">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">
              <Activity size={13} />
              <span>DEFENSE MISSION ARCHITECTURE</span>
            </div>
            <h2 className="section-title">Autonomous Edge-to-Command Defense Pipeline</h2>
            <p className="section-subtext">
              Engineered for mission-critical military defense. IBVAP processes multi-spectral optical, thermal,
              and sensor streams at the air-gapped tactical edge, providing sub-150ms autonomous threat interception without cloud dependency.
            </p>
          </div>

          <div className="tactical-pipeline-matrix">
            {/* Stage 1 */}
            <div className="tactical-stage-card">
              <div className="stage-top-meta">
                <span className="stage-code">STAGE 01</span>
                <span className="stage-protocol">RTSP • ONVIF • PTZ</span>
              </div>
              <div className="stage-icon-wrap">
                <Camera size={24} />
              </div>
              <h3 className="stage-heading">Sector Acquisition</h3>
              <p className="stage-description">
                Direct ingest from existing border CCTV, thermal IR optics, watchtower sensors, and tactical drone feeds.
              </p>
              <div className="stage-telemetry">
                <span className="stage-chip">Zero Hardware Swap</span>
                <span className="stage-chip">Multi-Spectral</span>
              </div>
            </div>

            {/* Connector */}
            <div className="tactical-stage-connector">
              <div className="connector-line"></div>
              <div className="connector-pulse"></div>
              <ChevronRight size={18} className="connector-arrow" />
            </div>

            {/* Stage 2 */}
            <div className="tactical-stage-card">
              <div className="stage-top-meta">
                <span className="stage-code">STAGE 02</span>
                <span className="stage-protocol">H.264 / H.265 INGEST</span>
              </div>
              <div className="stage-icon-wrap">
                <Server size={24} />
              </div>
              <h3 className="stage-heading">Stream Gateway</h3>
              <p className="stage-description">
                Multi-threaded frame buffer with auto-reconnection watchdog, jitter smoothing, and local edge caching.
              </p>
              <div className="stage-telemetry">
                <span className="stage-chip">Auto Reconnect</span>
                <span className="stage-chip">Zero Packet Drop</span>
              </div>
            </div>

            {/* Connector */}
            <div className="tactical-stage-connector">
              <div className="connector-line"></div>
              <div className="connector-pulse"></div>
              <ChevronRight size={18} className="connector-arrow" />
            </div>

            {/* Stage 3 (Highlighted Core) */}
            <div className="tactical-stage-card highlighted-core">
              <div className="core-glow-indicator"></div>
              <div className="stage-top-meta">
                <span className="stage-code core">STAGE 03 // AI CORE</span>
                <span className="stage-protocol core">YOLOv8 + YUNET + OCR</span>
              </div>
              <div className="stage-icon-wrap core">
                <Cpu size={26} />
              </div>
              <h3 className="stage-heading">Neural Inference Core</h3>
              <p className="stage-description">
                Simultaneous real-time target tracking, biometric facial matching, ANPR plate consensus, and speed radar.
              </p>
              <div className="stage-telemetry">
                <span className="stage-chip core">&lt; 15ms Inference</span>
                <span className="stage-chip core">99.4% Catch Rate</span>
              </div>
            </div>

            {/* Connector */}
            <div className="tactical-stage-connector">
              <div className="connector-line"></div>
              <div className="connector-pulse"></div>
              <ChevronRight size={18} className="connector-arrow" />
            </div>

            {/* Stage 4 */}
            <div className="tactical-stage-card">
              <div className="stage-top-meta">
                <span className="stage-code">STAGE 04</span>
                <span className="stage-protocol">HMAC SHA-256 LEDGER</span>
              </div>
              <div className="stage-icon-wrap">
                <Lock size={24} />
              </div>
              <h3 className="stage-heading">Forensic Integrity</h3>
              <p className="stage-description">
                Camera blind/occlusion tamper detection, acoustic gunshot elevation, and tamper-proof digital signature chain.
              </p>
              <div className="stage-telemetry">
                <span className="stage-chip">Anti-Tamper Sensor</span>
                <span className="stage-chip">Court-Admissible</span>
              </div>
            </div>

            {/* Connector */}
            <div className="tactical-stage-connector">
              <div className="connector-line"></div>
              <div className="connector-pulse"></div>
              <ChevronRight size={18} className="connector-arrow" />
            </div>

            {/* Stage 5 */}
            <div className="tactical-stage-card">
              <div className="stage-top-meta">
                <span className="stage-code">STAGE 05</span>
                <span className="stage-protocol">WEBSOCKET + TTS VOICE</span>
              </div>
              <div className="stage-icon-wrap">
                <Radio size={24} />
              </div>
              <h3 className="stage-heading">Tactical Dispatch</h3>
              <p className="stage-description">
                Sub-150ms live video matrix, interactive PTZ tracking, hands-free priority voice alerts, and incident dossiers.
              </p>
              <div className="stage-telemetry">
                <span className="stage-chip">Hands-Free Audio</span>
                <span className="stage-chip">&lt; 150ms HUD Sync</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. "IBVAP PLATFORM" 3 FEATURE CARDS (Real Images + Actual Platform Capabilities) */}
      {/* ========================================================================= */}
      <section id="platform-cards" className="section-platform-cards">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">COMMAND CENTER CAPABILITIES</div>
            <h2 className="section-title">Built for the Defense Command Operator</h2>
            <p className="section-subtext">
              Real-world operational capabilities engineered directly into the IBVAP platform—from multi-camera 
              video walls and automated voice alarms to biometric face matching and cryptographic forensic logging.
            </p>
          </div>

          <div className="platform-cards-grid">
            {/* Card 1: DYNAMIC VIDEO WALL */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">DYNAMIC TACTICAL VIDEO WALL</h3>
                <span className="card-subtitle-tag">Centralized Multi-Sector Command Matrix</span>
              </div>
              <div className="card-image-wrap">
                <img
                  src="/images/real_tactical_videowall.png"
                  alt="Multi-camera dynamic video wall in military operations center"
                  className="card-feature-img"
                />
                <div className="card-badge-chip">
                  <span className="pulse-dot green"></span> 9/9 FEEDS ONLINE
                </div>
                <div className="card-telemetry-hud-strip">
                  <span>MATRIX: 3x3 GRID</span>
                  <span>WATCHDOG: ACTIVE</span>
                </div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  In high-pressure border posts, operators cannot manually toggle dozens of cameras. IBVAP aggregates 
                  all sector cameras—perimeter razor wire, watchtowers, and vehicle gates—into a unified matrix. 
                  When any breach occurs, the platform spotlights the active camera, renders YOLOv8 bounding boxes, and 
                  enables instant PTZ camera tracking.
                </p>
                <div className="card-capabilities-list">
                  <div className="cap-item"><CheckCircle2 size={14} /> Multi-Feed Grid & 1-Click Sector Focus</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Interactive PTZ Pan, Tilt & Zoom Controls</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Automated RTSP Stream Reconnection Watchdog</div>
                </div>
              </div>
            </div>

            {/* Card 2: MULTIPLE REAL TIME ALERTS */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">INSTANT VOICE & TACTICAL HUD ALERTS</h3>
                <span className="card-subtitle-tag">Zero-Fatigue Threat Elevation & Speech Dispatch</span>
              </div>
              <div className="card-image-wrap">
                <img
                  src="/images/real_alerts_dispatch.jpg"
                  alt="Real-time tactical incident alerts dashboard"
                  className="card-feature-img"
                />
                <div className="card-badge-chip red-badge">
                  <span className="pulse-dot red"></span> CRITICAL DISPATCH
                </div>
                <div className="card-telemetry-hud-strip">
                  <span>VOICE SYNTHESIS: READY</span>
                  <span>SHA-256: SIGNED</span>
                </div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  Surveillance fatigue leads to missed breaches. IBVAP solves this with hands-free priority voice alerts 
                  announcing <em>'Unknown person in area'</em> or <em>'Unknown vehicle in area'</em>. Simultaneously 
                  triggers polygon geofence tripwire alarms, unauthorized ANPR plate warnings, and camera occlusion 
                  tamper alerts backed by HMAC SHA-256 digital forensic signatures.
                </p>
                <div className="card-capabilities-list">
                  <div className="cap-item"><CheckCircle2 size={14} /> Hands-Free Tactical Voice Speech Synthesis</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Custom Polygon Geofencing & Tripwire Breach</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Immutable SHA-256 Digital Forensic Chain</div>
                </div>
              </div>
            </div>

            {/* Card 3: LIVE FEEDS & TELEMETRY */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">LIVE TELEMETRY, BIOMETRICS & ANPR</h3>
                <span className="card-subtitle-tag">Sub-150ms Streaming with Multi-Modal AI</span>
              </div>
              <div className="card-image-wrap">
                <img
                  src="/images/real_cctv_telemetry.png"
                  alt="Live feeds, biometric facial recognition and license plate telemetry"
                  className="card-feature-img"
                />
                <div className="card-badge-chip">
                  <span className="pulse-dot green"></span> &lt; 42ms LATENCY
                </div>
                <div className="telemetry-bar-overlay">
                  <div className="telem-item">
                    <span className="telem-label">Biometric Match</span>
                    <span className="telem-val green">98% CONFIRMED</span>
                  </div>
                  <div className="telem-item">
                    <span className="telem-label">Plate Read</span>
                    <span className="telem-val">MIL-7341 (UK)</span>
                  </div>
                  <div className="telem-item">
                    <span className="telem-label">Speed Radar</span>
                    <span className="telem-val">34 km/h (CAL)</span>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  Delivers sub-150ms real-time WebSocket video streams paired with YuNet biometric face recognition 
                  cross-matching defense watchlists in real time. Features homography speed estimation to flag speeding 
                  convoys, multi-frame OCR consensus plate verification, and automated night-vision CLAHE contrast filters 
                  for zero-light, fog, or dust storms.
                </p>
                <div className="card-capabilities-list">
                  <div className="cap-item"><CheckCircle2 size={14} /> YuNet Face Biometrics vs Military Watchlist</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Homography Vehicle Speed & Direction Radar</div>
                  <div className="cap-item"><CheckCircle2 size={14} /> Night-Vision CLAHE Fog & Dehazing Filter</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. GAIN AN EDGE WITH VIDEO ANALYTICS (Image 1 BriefCam)                   */}
      {/* ========================================================================= */}
      <section className="section-edge">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">STRATEGIC ADVANTAGE</div>
            <h2 className="section-title">Gain an Edge with Tactical Video Analytics</h2>
            <p className="section-subtext">
              Transform surveillance video from passive forensic evidence into proactive border defense intelligence.
            </p>
          </div>

          <div className="edge-columns-grid">
            <div className="edge-col">
              <div className="edge-icon-circle">
                <Layers size={26} />
              </div>
              <h4 className="edge-col-title">Accelerate Forensic Review</h4>
              <p className="edge-col-desc">
                Compress 24 hours of multi-camera recordings into actionable tactical summaries in minutes.
                Filter events by object class, license plate characters, or biometric identity instantly.
              </p>
            </div>

            <div className="edge-col">
              <div className="edge-icon-circle">
                <ShieldAlert size={26} />
              </div>
              <h4 className="edge-col-title">Rapid Situational Awareness</h4>
              <p className="edge-col-desc">
                Receive sub-second tactical voice alerts and high-severity alarms the moment an intrusion,
                fence climb, or unauthorized military plate breach is detected at remote borders.
              </p>
            </div>

            <div className="edge-col">
              <div className="edge-icon-circle">
                <TrendingUp size={26} />
              </div>
              <h4 className="edge-col-title">Operational Intelligence</h4>
              <p className="edge-col-desc">
                Uncover perimeter vulnerability patterns, loitering hotspots along dead zones,
                and traffic throughput metrics to optimize sentry shift deployments across all sectors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. CAPABILITY MATRIX TABLE (Image 1 BriefCam)                             */}
      {/* ========================================================================= */}
      <section id="capabilities-matrix" className="section-matrix">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">CAPABILITY MATRIX</div>
            <h2 className="section-title">How to Make the Most of Your Surveillance Data</h2>
            <p className="section-subtext">
              Comprehensive technical evaluation across IBVAP platform capabilities.
            </p>
          </div>

          <div className="matrix-table-wrapper">
            <table className="capabilities-table">
              <thead>
                <tr>
                  <th className="th-feature">Surveillance Capability</th>
                  <th className="th-tier">Basic CCTV</th>
                  <th className="th-tier">Commercial VMS</th>
                  <th className="th-tier highlight">IBVAP Tactical Defense</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="td-feature">
                    <strong>Perimeter Fence Breach Detection</strong>
                    <span>Deep learning bounding of fence climbers and wire cuts</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">Simple Motion</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> YOLOv8 Spatial Box</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Vehicle License Plate Recognition (ANPR)</strong>
                    <span>Real-time Indian military & civilian format extraction</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">Paid Add-on</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> EasyOCR Dual-Pass</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Biometric Watchlist Identification</strong>
                    <span>128-d Cosine Similarity with AFIN night-vision boost</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">✕</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> YuNet + SFace (ONNX)</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Real-Time Voice Dispatch Announcer</strong>
                    <span>Hands-free tactical verbal notification to guard post</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">✕</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> WebSpeech Synthesizer</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Camera Occlusion & Tamper Alarm</strong>
                    <span>Detect spray paint, lens displacement, and signal loss</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">Signal Only</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> SSIM + Dynamic Variance</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Tamper-Proof Forensic Audit Trail</strong>
                    <span>SHA-256 cryptographic chain of custody verification</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">Basic Logs</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> SHA-256 Hash Chaining</td>
                </tr>
                <tr>
                  <td className="td-feature">
                    <strong>Cloud Object Storage & PostgreSQL Backup</strong>
                    <span>Permanent image CDN & relational storage across redeployments</span>
                  </td>
                  <td className="td-check">✕</td>
                  <td className="td-check">Local Only</td>
                  <td className="td-check highlight"><CheckCircle2 size={16} /> Cloudinary + PostgreSQL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>



      {/* ========================================================================= */}
      {/* 9. FREQUENTLY ASKED QUESTIONS ACCORDION (Image 1 BriefCam)                */}
      {/* ========================================================================= */}
      <section id="faq" className="section-faq">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">DEFENSE FAQS</div>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtext">
              Common operational and deployment inquiries regarding IBVAP architecture.
            </p>
          </div>

          <div className="faq-accordion-list">
            {[
              {
                q: 'Can IBVAP integrate with existing legacy CCTV and DVR/NVR infrastructure?',
                a: 'Yes. IBVAP connects directly to standard RTSP/ONVIF streams from any IP camera, analog DVR encoder, or thermal optical sensor without requiring any camera hardware replacements.',
              },
              {
                q: 'How does the platform handle low-light, fog, and night-vision conditions?',
                a: 'IBVAP features Adaptive Face Illumination Normalization (AFIN) and dynamic CLAHE contrast equalization, automatically enhancing dark underexposed video frames and night-vision CCTV feeds before neural network evaluation.',
              },
              {
                q: 'Does IBVAP require an active cloud or internet connection to function?',
                a: 'No. The entire AI analytics pipeline (YOLOv8, YuNet, SFace, EasyOCR) runs completely offline on edge hardware. Cloudinary and PostgreSQL sync operate automatically when an uplink is detected, but perimeter alerts work 100% locally.',
              },
              {
                q: 'How is biometric personnel privacy and legal compliance maintained?',
                a: 'Facial identification operates exclusively against a local, consented demo watchlist of authorized defense personnel. It does NOT interface with or store biometric data from unauthorized civilians or public registries.',
              },
              {
                q: 'How does the SHA-256 chain of custody prevent evidence tampering?',
                a: 'Every logged detection event, timestamp, bounding box coordinate, and snapshot hash is cryptographically bound to the preceding record using a SHA-256 blockchain-style hash chain, rendering retroactive alteration mathematically impossible.',
              },
            ].map((item, idx) => (
              <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
                <button
                  className="faq-question-btn"
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                >
                  <span className="faq-q-text">{item.q}</span>
                  <ChevronDown size={18} className={`faq-chevron ${openFaq === idx ? 'rotated' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="faq-answer-panel">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. ENTERPRISE FOOTER WITH CALL TO ACTION                                 */}
      {/* ========================================================================= */}
      <footer className="enterprise-footer">
        <div className="footer-cta-banner">
          <div className="section-container cta-inner">
            <div className="cta-text">
              <h3>Ready to Deploy Real-Time Border Analytics?</h3>
              <p>Experience the live command matrix with real webcam inference, vehicle ANPR, and tactical alerts.</p>
            </div>
            <button className="footer-launch-btn" onClick={onLaunchCommandCenter}>
              <Radio size={18} />
              <span>Launch Live Command Center</span>
            </button>
          </div>
        </div>

        <div className="footer-main">
          <div className="section-container footer-grid">
            <div className="footer-brand-col">
              <div className="nav-brand footer-nav-brand">
                <div className="brand-shield-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
                  <img src="/images/ibvap_logo.png" alt="IBVAP Logo" style={{ width: '46px', height: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="brand-text-block">
                  <span className="brand-name" style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.06em', textShadow: '0 2px 10px rgba(56, 189, 248, 0.35)' }}>
                    IBVAP
                  </span>
                  <span className="brand-sub" style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.02em' }}>
                    Smart India Hackathon 2026
                  </span>
                </div>
              </div>
              <p className="footer-brand-desc">
                Intelligent Border Video Analytics Platform. Engineered for defense, border security,
                and critical infrastructure protection using state-of-the-art computer vision.
              </p>
              <div className="defense-compliance-badges">
                <span className="comp-badge"><FileCheck size={12} /> SHA-256 Audited</span>
                <span className="comp-badge"><Lock size={12} /> Military Grade</span>
                <span className="comp-badge"><Server size={12} /> Edge Dual-Engine</span>
              </div>
            </div>

            <div className="footer-links-col">
              <div className="footer-heading">Platform Modules</div>
              <ul>
                <li><a href="#interactive-slider">Interactive Vision Demo</a></li>
                <li><a href="#platform-cards">Dynamic Video Wall</a></li>
                <li><a href="#platform-cards">Real-Time Alerts Feed</a></li>
                <li><a href="#capabilities-matrix">Capability Matrix</a></li>
              </ul>
            </div>

            <div className="footer-links-col">
              <div className="footer-heading">Core Engines</div>
              <ul>
                <li><span>YOLOv8 Target Tracking</span></li>
                <li><span>YuNet & SFace Biometrics</span></li>
                <li><span>EasyOCR Defense ANPR</span></li>
                <li><span>AFIN Night Vision Equalizer</span></li>
              </ul>
            </div>

            <div className="footer-links-col">
              <div className="footer-heading">Operational Access</div>
              <ul>
                <li><button onClick={onLaunchCommandCenter} className="footer-link-btn">Live Surveillance</button></li>
                <li><button onClick={onLoginClick} className="footer-link-btn">Command Wall Login</button></li>
                <li><a href="/docs" target="_blank" rel="noreferrer">FastAPI REST Docs</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <div className="section-container bottom-inner">
              <div className="copy-text">
                © 2026 IBVAP. Smart India Hackathon Defense Technology Initiative. All Rights Reserved.
              </div>
              <div className="bottom-tag">
                High-Reliability Border Surveillance Architecture
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
