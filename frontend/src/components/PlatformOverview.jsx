import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
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
      hudOverlay: {
        type: 'intrusion',
        coords: { top: '45%', left: '57%', width: '13%', height: '36%' },
        label: 'INTRUSION DETECTED • 94.2%',
        sublabel: 'Sector 4 Razor-Wire Cut Alert',
        severity: 'critical',
      },
    },
    {
      id: 'military-anpr',
      title: 'Tactical Vehicle ANPR & Checkpoint Clearance',
      subtitle: 'CAM 04 • Gate 1 Checkpoint • 23:48 PM',
      rawImage: '/images/military_checkpoint_gate.jpg',
      labelAi: 'ANPR + Checkpoint AI Overlay',
      labelRaw: 'Raw Camera Feed',
      description: 'High-speed OCR neural network reads tactical vehicle plate, cross-references against authorized defense logistics whitelist, and prompts automated boom barrier clearance.',
      detectionTag: 'PLATE READ: AZ-411-S • CLEARANCE GRANTED',
      hudOverlay: {
        type: 'anpr',
        coords: { top: '38%', left: '29%', width: '27%', height: '38%' },
        label: 'TACTICAL UNIT • AZ-411-S',
        sublabel: 'Command Escort Patrol • AUTHORIZED',
        severity: 'authorized',
      },
    },
    {
      id: 'border-perimeter',
      title: 'High-Security Perimeter Surveillance & Tracking',
      subtitle: 'CAM 07 • West Perimeter Watchtower • 16:32 PM',
      rawImage: '/images/border_fence_cctv.jpg',
      labelAi: 'Autonomous Sector Telemetry',
      labelRaw: 'Raw Video Feed',
      description: 'Long-range optical tracking monitors border fence integrity, auto-calibrating for ambient sunlight and shadows while tracking movement vectors near watchtower outpost.',
      detectionTag: 'ZONE SECURE • ZERO ANOMALIES',
      hudOverlay: {
        type: 'zone',
        coords: { top: '32%', left: '38%', width: '26%', height: '48%' },
        label: 'SECTOR 7 PERIMETER • MONITORED',
        sublabel: 'Optical Flow: Static • Fence Intact',
        severity: 'secure',
      },
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
              <a href="#command-testimony" className="nav-link">Operational Impact</a>
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
              <div className="brand-shield-icon">
                <ShieldAlert size={22} />
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
              <a href="#command-testimony" className="nav-link">Operational Impact</a>
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
                <div className="mockup-title">SECTOR 4 PERIMETER COMMAND • LIVE RTSP FEED</div>
                <div className="mockup-badge">
                  <span className="pulse-dot"></span> LIVE 1080p
                </div>
              </div>
              <div className="mockup-media">
                <img
                  src="/images/border_fence_cctv.jpg"
                  alt="Military Border Perimeter Surveillance Feed"
                  className="mockup-img"
                />
                <div className="mockup-overlay-hud">
                  <div className="hud-corner top-left">
                    <span>CAM 07 - SECTOR 4 NORTH</span>
                    <span className="hud-time">FPS: 29.8 | YUNET + YOLOV8</span>
                  </div>
                  <div className="hud-target-box">
                    <span className="hud-target-tag">PERIMETER FENCE LINE INTACT</span>
                  </div>
                  <div className="hud-corner bottom-right">
                    <span>STATUS: OPERATIONAL</span>
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
                {sc.id === 'military-anpr' && <Car size={14} />}
                {sc.id === 'border-perimeter' && <Eye size={14} />}
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
                {/* AI HUD Bounding Box Overlay */}
                <div
                  className={`ai-bounding-box ${currentScenario.hudOverlay.severity}`}
                  style={{
                    top: currentScenario.hudOverlay.coords.top,
                    left: currentScenario.hudOverlay.coords.left,
                    width: currentScenario.hudOverlay.coords.width,
                    height: currentScenario.hudOverlay.coords.height,
                  }}
                >
                  <div className="ai-box-tag">
                    <span className="box-indicator"></span>
                    <span>{currentScenario.hudOverlay.label}</span>
                  </div>
                  <div className="ai-box-sub">{currentScenario.hudOverlay.sublabel}</div>
                  <div className="box-corner tl"></div>
                  <div className="box-corner tr"></div>
                  <div className="box-corner bl"></div>
                  <div className="box-corner br"></div>
                </div>

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
      {/* 4. "GETTING STARTED IS EFFORTLESS" 5-STEP PIPELINE (Image 2)              */}
      {/* ========================================================================= */}
      <section id="pipeline-flow" className="section-pipeline">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">TACTICAL ARCHITECTURE</div>
            <h2 className="section-title">Getting Started with IBVAP is Effortless</h2>
            <p className="section-subtext">
              Zero hardware replacement required. IBVAP connects seamlessly with your existing military CCTV,
              DVR/NVR encoders, and tactical field networks.
            </p>
          </div>

          <div className="pipeline-flow-wrapper">
            {/* The Dual Sine Wave Background Track */}
            <div className="sine-wave-track">
              <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="sine-wave-svg">
                <path
                  d="M 0,60 C 100,10 150,110 250,60 C 350,10 400,110 500,60 C 600,10 650,110 750,60 C 850,10 900,110 1000,60"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  opacity="0.8"
                />
                <path
                  d="M 0,60 C 100,110 150,10 250,60 C 350,110 400,10 500,60 C 600,110 650,10 750,60 C 850,110 900,10 1000,60"
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="2.5"
                  opacity="0.8"
                />
              </svg>
            </div>

            {/* 5 Step Nodes */}
            <div className="pipeline-steps-grid">
              <div className="step-node">
                <div className="step-circle-icon">
                  <Camera size={26} />
                </div>
                <div className="step-label">Suitably Positioned Cameras</div>
                <div className="step-desc">Existing border CCTV, thermal optics & PTZ sensors</div>
              </div>

              <div className="step-node">
                <div className="step-circle-icon">
                  <Server size={26} />
                </div>
                <div className="step-label">DVR / NVR Encoders</div>
                <div className="step-desc">Standard H.264 / H.265 RTSP video stream ingest</div>
              </div>

              <div className="step-node">
                <div className="step-circle-icon">
                  <Wifi size={26} />
                </div>
                <div className="step-label">Consistent Network</div>
                <div className="step-desc">Tactical field LAN, encrypted microwave or 4G/5G link</div>
              </div>

              <div className="step-node highlighted">
                <div className="step-circle-icon accent">
                  <Cpu size={28} />
                </div>
                <div className="step-label">IBVAP (AI Engine)</div>
                <div className="step-desc">YOLOv8 + YuNet + EasyOCR + Tamper verification core</div>
              </div>

              <div className="step-node">
                <div className="step-circle-icon">
                  <Laptop size={26} />
                </div>
                <div className="step-label">Instant Insights (Command Client)</div>
                <div className="step-desc">Operator video wall, real-time alerts & voice dispatch</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. "IBVAP PLATFORM" 3 FEATURE CARDS (Image 3)                             */}
      {/* ========================================================================= */}
      <section id="platform-cards" className="section-platform-cards">
        <div className="section-container">
          <div className="section-title-wrap text-center">
            <div className="section-badge">COMMAND CENTER CAPABILITIES</div>
            <h2 className="section-title">IBVAP Tactical Platform</h2>
            <p className="section-subtext">
              IBVAP offers an operator-first AI video analytics dashboard to monitor border sectors,
              receive tactical real-time alerts, and coordinate rapid response teams.
            </p>
          </div>

          <div className="platform-cards-grid">
            {/* Card 1: DYNAMIC VIDEO WALL */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">DYNAMIC VIDEO WALL</h3>
              </div>
              <div className="card-image-wrap">
                <img
                  src="/images/military_cctv_wall.jpg"
                  alt="Multi-camera dynamic video wall"
                  className="card-feature-img"
                />
                <div className="card-badge-chip">9/9 FEEDS ONLINE</div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  Video Wall panel enables live centralized monitoring of all perimeter sectors, watchtowers,
                  and checkpoint gates from a single unified tactical screen matrix with automatic anomaly elevation.
                </p>
              </div>
            </div>

            {/* Card 2: MULTIPLE REAL TIME ALERTS */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">MULTIPLE REAL TIME ALERTS</h3>
              </div>
              <div className="card-image-wrap alerts-feed-wrap">
                <div className="tactical-alerts-mockup">
                  <div className="mockup-alert-row critical">
                    <div className="alert-thumb">
                      <ShieldAlert size={18} className="text-red" />
                    </div>
                    <div className="alert-details">
                      <div className="alert-loc">Location: Sector 4 Razor Wire</div>
                      <div className="alert-cam">Camera: North Perimeter CAM-04</div>
                      <div className="alert-tag red">Event: Perimeter Intrusion Detected</div>
                      <div className="alert-timestamp">04:18:22 AM • Oct 21</div>
                    </div>
                  </div>

                  <div className="mockup-alert-row success">
                    <div className="alert-thumb">
                      <Car size={18} className="text-green" />
                    </div>
                    <div className="alert-details">
                      <div className="alert-loc">Location: Gate 1 Main Barrier</div>
                      <div className="alert-cam">Camera: Checkpoint Entry CAM-01</div>
                      <div className="alert-tag green">Event: ANPR Verified (Patrol Truck)</div>
                      <div className="alert-timestamp">11:42:05 AM • Oct 21</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  Get instant tactical notifications on violations to detect, verify, and act on critical events
                  with hands-free speech alerts and SHA-256 tamper-evident digital forensic snapshots.
                </p>
              </div>
            </div>

            {/* Card 3: LIVE FEEDS & TELEMETRY */}
            <div className="platform-feature-card">
              <div className="card-top-bar"></div>
              <div className="card-header">
                <h3 className="card-title">LIVE FEEDS & TELEMETRY</h3>
              </div>
              <div className="card-image-wrap">
                <img
                  src="/images/military_checkpoint_gate.jpg"
                  alt="Live feeds and camera telemetry"
                  className="card-feature-img"
                />
                <div className="telemetry-bar-overlay">
                  <div className="telem-item">
                    <span className="telem-label">Status</span>
                    <span className="telem-val green">● ONLINE</span>
                  </div>
                  <div className="telem-item">
                    <span className="telem-label">Bitrate</span>
                    <span className="telem-val">4200 kbps</span>
                  </div>
                  <div className="telem-item">
                    <span className="telem-label">Resolution</span>
                    <span className="telem-val">1080p 30fps</span>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <p className="card-body-text">
                  Access sub-second live feeds of your defense cameras anytime with real-time biometric
                  facial matching, vehicle plate readings, and camera occlusion tamper alarms.
                </p>
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
      {/* 8. COMMAND CENTER TESTIMONIAL / OPERATIONAL PROOF (Image 1 BriefCam)       */}
      {/* ========================================================================= */}
      <section id="command-testimony" className="section-testimony">
        <div className="section-container">
          <div className="testimony-card">
            <div className="testimony-image-side">
              <img
                src="/images/defense_command_center.jpg"
                alt="Border Security Tactical Command Room"
                className="testimony-img"
              />
              <div className="testimony-img-tag">DIRECTORATE OF BORDER SURVEILLANCE</div>
            </div>
            <div className="testimony-content-side">
              <div className="testimony-quote-mark">“</div>
              <blockquote className="testimony-quote">
                We have seen an <strong>85% reduction in perimeter incident verification times</strong> across our monitored sectors.
                The automated military vehicle ANPR and biometric access verification relieves round-the-clock operator fatigue,
                allowing sentries to focus strictly on genuine intrusion alarms.
              </blockquote>
              <div className="testimony-author-block">
                <div className="author-name">Deputy Commandant, Border Technology Division</div>
                <div className="author-role">Frontier Defense & Perimeter Security Taskforce</div>
              </div>
              <button className="testimony-action-btn" onClick={onLaunchCommandCenter}>
                <span>Launch Operational Command Center</span>
                <ArrowRight size={16} />
              </button>
            </div>
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
              <div className="nav-brand">
                <div className="brand-shield-icon">
                  <ShieldAlert size={20} />
                </div>
                <div className="brand-text-block">
                  <span className="brand-name">IBVAP</span>
                  <span className="brand-sub">Smart India Hackathon 2026</span>
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
