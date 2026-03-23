import { useEffect, useRef } from "react";

const COLORS = ["#ff4444","#ff8c00","#ff0066","#9400d3","#ff6600","#cc0000","#ff3399","#00ccff","#00ff88","#ffcc00"];

function BarChart({ data, title }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || !Object.keys(data).length || !window.Chart) return;
    const ctx = canvasRef.current.getContext("2d");
    if (chartRef.current) chartRef.current.destroy();

    const labels = Object.keys(data).slice(0, 8);
    const values = Object.values(data).slice(0, 8);

    chartRef.current = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: COLORS.slice(0, labels.length), borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: title, color: "#00ff88", font: { size: 13, family: "monospace" } },
        },
        scales: {
          x: { ticks: { color: "#aaa", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#aaa", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);

  return <div style={{ height: 220 }}><canvas ref={canvasRef} /></div>;
}

function DonutChart({ data, title }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || !Object.keys(data).length || !window.Chart) return;
    const ctx = canvasRef.current.getContext("2d");
    if (chartRef.current) chartRef.current.destroy();

    const labels = Object.keys(data).slice(0, 6);
    const values = Object.values(data).slice(0, 6);

    chartRef.current = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: COLORS.slice(0, labels.length), borderColor: "#111", borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#ccc", font: { size: 11 }, padding: 12 } },
          title: { display: true, text: title, color: "#00ff88", font: { size: 13, family: "monospace" } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);

  return <div style={{ height: 220 }}><canvas ref={canvasRef} /></div>;
}

export default function StatsPanel({ stats }) {
  if (!stats || !stats.total_attacks) {
    return <div className="stats-empty"><div className="spinner" /><p>Loading statistics...</p></div>;
  }

  return (
    <div className="stats-panel">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-value">{stats.total_attacks?.toLocaleString()}</div><div className="kpi-label">Total Attacks</div></div>
        <div className="kpi-card"><div className="kpi-value" style={{ color: "#ff4444" }}>{Object.keys(stats.attack_types || {}).length}</div><div className="kpi-label">Attack Vectors</div></div>
        <div className="kpi-card"><div className="kpi-value" style={{ color: "#ff8c00" }}>{Object.keys(stats.states || {}).length}</div><div className="kpi-label">States Targeted</div></div>
        <div className="kpi-card"><div className="kpi-value" style={{ color: "#9400d3" }}>{Object.keys(stats.top_sources || {}).length}</div><div className="kpi-label">Source Countries</div></div>
      </div>

      <div className="charts-grid">
        <div className="chart-card"><BarChart data={stats.attack_types} title="Attack Types (24h)" /></div>
        <div className="chart-card"><DonutChart data={stats.sectors} title="Targeted Sectors" /></div>
        <div className="chart-card"><BarChart data={stats.states} title="States Under Attack" /></div>
        <div className="chart-card"><DonutChart data={stats.top_sources} title="Top Source Countries" /></div>
      </div>

      <div className="table-card">
        <h3>🗺 State Attack Intensity</h3>
        <table className="cyber-table">
          <thead><tr><th>State</th><th>Attacks</th><th>Intensity</th></tr></thead>
          <tbody>
            {Object.entries(stats.states || {}).map(([state, count]) => {
              const max = Math.max(...Object.values(stats.states));
              const pct = Math.round((count / max) * 100);
              return (
                <tr key={state}>
                  <td>{state}</td>
                  <td>{count}</td>
                  <td>
                    <div className="bar-cell">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: pct > 70 ? "#ff4444" : pct > 40 ? "#ff8c00" : "#00ff88" }} />
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#607080" }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}