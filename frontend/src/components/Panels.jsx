const ATTACK_ICONS = { DDoS:"🌊", Phishing:"🎣", Ransomware:"🔒", SQLi:"💉", XSS:"📜", "Brute Force":"🔨", MitM:"🕵️", "Zero-Day":"💣" };
const SEVERITY_COLORS = { CRITICAL:"#ff0000", HIGH:"#ff4444", MEDIUM:"#ff8c00", LOW:"#ffcc00", UNKNOWN:"#666" };

export function AttackFeed({ attacks, fullscreen }) {
  return (
    <div className={`attack-feed ${fullscreen ? "fullscreen" : ""}`}>
      <div className="feed-header">
        <span className="feed-title">⚡ LIVE ATTACK FEED</span>
        <span className="feed-count">{attacks.length} events</span>
      </div>
      <div className="feed-list">
        {attacks.map(a => (
          <div key={a.id} className="feed-item" style={{ borderLeft: `3px solid ${a.attack_color || "#ff4444"}` }}>
            <div className="feed-item-header">
              <span>{ATTACK_ICONS[a.attack_type] || "⚠️"}</span>
              <span className="feed-type" style={{ color: a.attack_color || "#ff4444" }}>{a.attack_type}</span>
              {a.simulated && <span className="simulated-badge">SIM</span>}
              <span className="feed-time">{new Date(a.timestamp).toLocaleTimeString("en-IN")}</span>
            </div>
            <div className="feed-route">
              <span className="feed-source">{a.source_country}</span>
              <span className="feed-arrow"> ──▶ </span>
              <span className="feed-target">{a.target_city}</span>
            </div>
            <div className="feed-meta">
              <span>🏢 {a.target_sector}</span>
              <span className="severity-badge" style={{ background: a.severity > 70 ? "#ff4444" : a.severity > 40 ? "#ff8c00" : "#555" }}>
                {a.severity}%
              </span>
            </div>
            <div className="feed-ip">IP: {a.source_ip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CVEPanel({ cves }) {
  return (
    <div className="cve-panel">
      <div className="panel-header">
        <h2>🔓 Top CVEs This Week</h2>
        <p className="panel-sub">Source: National Vulnerability Database (NVD) — Free API</p>
      </div>
      <div>
        {cves.length === 0 && <div className="empty-state"><div className="spinner" /><p>Fetching CVEs...</p></div>}
        {cves.map(cve => (
          <div key={cve.id} className="cve-card">
            <div className="cve-header">
              <a className="cve-id" href={`https://nvd.nist.gov/vuln/detail/${cve.id}`} target="_blank" rel="noreferrer">{cve.id}</a>
              <span className="severity-pill" style={{ background: SEVERITY_COLORS[cve.severity] || "#666" }}>{cve.severity}</span>
              {cve.score > 0 && <span className="score-pill">CVSS {cve.score}</span>}
              {cve.vector && <span className="vector-pill">{cve.vector}</span>}
            </div>
            <p className="cve-desc">{cve.description}</p>
            <div className="cve-published">Published: {cve.published ? new Date(cve.published).toLocaleDateString("en-IN") : "Unknown"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhishingPanel({ phishing }) {
  return (
    <div className="phishing-panel">
      <div className="panel-header">
        <h2>🎣 Active Phishing URLs Today</h2>
        <p className="panel-sub">Source: URLhaus (abuse.ch) — Free, No Auth Required</p>
      </div>
      <div>
        {phishing.length === 0 && <div className="empty-state"><div className="spinner" /><p>Fetching phishing feed...</p></div>}
        {phishing.map((p, i) => (
          <div key={i} className="phishing-card">
            <div className="phishing-header">
              <span className="phishing-threat">{p.threat?.replace(/_/g, " ") || "Malware"}</span>
              <span style={{ fontSize: 11, color: "#607080" }}>{p.date_added ? new Date(p.date_added).toLocaleDateString("en-IN") : ""}</span>
            </div>
            <div className="phishing-url"><code>{p.url?.substring(0, 80)}{p.url?.length > 80 ? "…" : ""}</code></div>
            {p.tags?.length > 0 && (
              <div className="tag-list">{p.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}