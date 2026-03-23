import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Free dark map tiles — no API key needed!
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const ATTACK_COLORS = {
  "DDoS":        "#ff4444",
  "Phishing":    "#ff8c00",
  "Ransomware":  "#ff0066",
  "SQLi":        "#9400d3",
  "XSS":         "#ff6600",
  "Brute Force": "#cc0000",
  "MitM":        "#ff3399",
  "Zero-Day":    "#ff0000",
};

export default function CyberMap({ attacks, liveAttack }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const arcLayer = useRef(null);
  const markerLayer = useRef(null);
  const drawnIds = useRef(new Set());

  // Initialize map once
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [20.5937, 78.9629], // Center of India
      zoom: 5,
      zoomControl: true,
    });

    // Dark tile layer (free, no key)
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Try to add India boundary outline
    fetch("https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson")
      .then(r => r.json())
      .then(geojson => {
        L.geoJSON(geojson, {
          style: {
            color: "#00ff88",
            weight: 1.5,
            opacity: 0.5,
            fillColor: "#00ff88",
            fillOpacity: 0.03,
          },
        }).addTo(map);
      })
      .catch(() => {}); // Silently fail if GeoJSON can't load

    arcLayer.current = L.layerGroup().addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  const drawAttack = useCallback((attack) => {
    if (!mapInstance.current || !attack) return;
    if (drawnIds.current.has(attack.id)) return;
    drawnIds.current.add(attack.id);

    const color = attack.attack_color || ATTACK_COLORS[attack.attack_type] || "#ff4444";
    const from = [attack.source_lat, attack.source_lon];
    const to = [attack.target_lat, attack.target_lon];

    // Create curved arc path
    const midLat = (from[0] + to[0]) / 2 - Math.abs(to[1] - from[1]) * 0.15;
    const midLon = (from[1] + to[1]) / 2;

    const arc = L.polyline([from, [midLat, midLon], to], {
      color,
      weight: 1.5,
      opacity: 0.8,
      dashArray: "5, 8",
    }).addTo(arcLayer.current);

    // Source dot
    const sourceDot = L.circleMarker(from, {
      radius: 4,
      color,
      fillColor: color,
      fillOpacity: 0.7,
      weight: 1,
    })
    .bindTooltip(`🌐 ${attack.source_country} → ${attack.attack_type}`, {
      className: "cyber-tooltip",
    })
    .addTo(markerLayer.current);

    // Target dot
    const targetDot = L.circleMarker(to, {
      radius: 6,
      color: "#00ff88",
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2,
    })
    .bindTooltip(
      `🎯 ${attack.target_city}, ${attack.target_state}<br/>` +
      `Sector: ${attack.target_sector}<br/>` +
      `Attack: <strong>${attack.attack_type}</strong><br/>` +
      `Severity: ${attack.severity}%` +
      (attack.simulated ? "<br/><em>⚠ Simulated data</em>" : ""),
      { className: "cyber-tooltip" }
    )
    .addTo(markerLayer.current);

    // Ripple animation
    let r = 6, op = 0.6;
    const ripple = L.circleMarker(to, {
      radius: r,
      color,
      fillColor: "transparent",
      weight: 1.5,
      opacity: op,
    }).addTo(markerLayer.current);

    const rippleInterval = setInterval(() => {
      r += 2;
      op -= 0.08;
      if (op <= 0) {
        clearInterval(rippleInterval);
        markerLayer.current?.removeLayer(ripple);
        return;
      }
      ripple.setRadius(r);
      ripple.setStyle({ opacity: op });
    }, 80);

    // Fade out arc after 8 seconds
    setTimeout(() => {
      let fadeOp = 0.8;
      const fadeInterval = setInterval(() => {
        fadeOp -= 0.1;
        if (fadeOp <= 0) {
          clearInterval(fadeInterval);
          arcLayer.current?.removeLayer(arc);
          markerLayer.current?.removeLayer(sourceDot);
          markerLayer.current?.removeLayer(targetDot);
        } else {
          arc.setStyle({ opacity: fadeOp });
        }
      }, 200);
    }, 8000);
  }, []);

  // Draw existing attacks on load
  useEffect(() => {
    if (attacks.length > 0) {
      attacks.slice(0, 30).forEach(a => drawAttack(a));
    }
  }, [attacks.length > 0]);

  // Draw new live attack when it arrives
  useEffect(() => {
    if (liveAttack) drawAttack(liveAttack);
  }, [liveAttack]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div className="map-legend">
        <div className="legend-title">Attack Types</div>
        {Object.entries(ATTACK_COLORS).map(([type, color]) => (
          <div key={type} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            <span>{type}</span>
          </div>
        ))}
        <div className="legend-item" style={{ marginTop: 8, opacity: 0.6, fontSize: 10 }}>
          <span className="legend-dot" style={{ background: "#00ff88" }} />
          <span>Indian Target</span>
        </div>
      </div>
    </div>
  );
}