import { useState, useEffect, useRef, useCallback } from "react";
import CyberMap from "./components/CyberMap";
import StatsPanel from "./components/StatsPanel";
import { AttackFeed, CVEPanel, PhishingPanel } from "./components/Panels";
import "./App.css";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [attacks, setAttacks] = useState([]);
  const [liveAttack, setLiveAttack] = useState(null);
  const [stats, setStats] = useState({});
  const [cves, setCves] = useState([]);
  const [phishing, setPhishing] = useState([]);
  const [connected, setConnected] = useState(false);
  const [attackCount, setAttackCount] = useState(0);
  const [activePanel, setActivePanel] = useState("map");
  const [currentTime, setCurrentTime] = useState(new Date());
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // Update clock every second
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // WebSocket connection
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case "init":
          setAttacks(msg.data);
          setAttackCount(msg.data.length);
          break;
        case "attack":
          setLiveAttack(msg.data);
          setAttacks(prev => [msg.data, ...prev].slice(0, 200));
          setAttackCount(c => c + 1);
          break;
        case "stats":
          setStats(msg.data);
          break;
        case "cves":
          setCves(msg.data);
          break;
        case "phishing":
          setPhishing(msg.data);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectRef.current = setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  // On mount: connect WS + fetch initial REST data
  useEffect(() => {
    connectWS();

    // REST fallback (in case WebSocket fails)
    fetch(`${API_URL}/api/attacks`).then(r => r.json()).then(d => { if (d.attacks?.length) { setAttacks(d.attacks); setAttackCount(d.total); } }).catch(() => {});
    fetch(`${API_URL}/api/cves`).then(r => r.json()).then(setCves).catch(() => {});
    fetch(`${API_URL}/api/phishing`).then(r => r.json()).then(setPhishing).catch(() => {});
    fetch(`${API_URL}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});

    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWS]);

  const tabs = [
    { id: "map",      label: "🗺 Live Map" },
    { id: "stats",    label: "📊 Statistics" },
    { id: "feed",     label: "⚡ Attack Feed" },
    { id: "cve",      label: "🔓 Top CVEs" },
    { id: "phishing", label: "🎣 Phishing" },
  ];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <div>
              <h1>INDIA CYBER THREAT MAP</h1>
              <p className="subtitle">Real-time cyberattack intelligence</p>
            </div>
          </div>
        </div>
        <div className="header-center">
          <div className="attack-counter">
            <span className="counter-value">{attackCount.toLocaleString()}</span>
            <span className="counter-label">ATTACKS TRACKED</span>
          </div>
          <div className="pulse-ring" />
        </div>
        <div className="header-right">
          <div className={`status-badge ${connected ? "online" : "offline"}`}>
            <span className="status-dot" />
            {connected ? "LIVE" : "RECONNECTING..."}
          </div>
          <div className="timestamp">
            {currentTime.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`nav-tab ${activePanel === tab.id ? "active" : ""}`} onClick={() => setActivePanel(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="main-content">
        {activePanel === "map" && (
          <div className="map-layout">
            <div className="map-container"><CyberMap attacks={attacks} liveAttack={liveAttack} /></div>
            <aside className="side-panel"><AttackFeed attacks={attacks.slice(0, 30)} /></aside>
          </div>
        )}
        {activePanel === "stats"    && <StatsPanel stats={stats} />}
        {activePanel === "feed"     && <AttackFeed attacks={attacks} fullscreen />}
        {activePanel === "cve"      && <CVEPanel cves={cves} />}
        {activePanel === "phishing" && <PhishingPanel phishing={phishing} />}
      </main>

      {/* Scrolling ticker at the bottom */}
      <footer className="ticker">
        <span className="ticker-label">LIVE</span>
        <div className="ticker-content">
          {[...attacks.slice(0, 8), ...attacks.slice(0, 8)].map((a, i) => (
            <span key={`${a.id}-${i}`} className="ticker-item">
              <span style={{ color: a.attack_color }}>{a.attack_type}</span>
              {" → "}{a.target_city} ({a.target_sector}) from {a.source_country}
              &nbsp;&nbsp;|&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}