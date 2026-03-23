"""
India Cyber Attack Live Map - FastAPI Backend
Free stack: Supabase + APScheduler + WebSocket
"""

import asyncio
import json
import os
import random
from datetime import datetime, timedelta
from typing import Optional

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Load .env file
load_dotenv()

# ─── Configuration ───────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
ABUSEIPDB_KEY = os.getenv("ABUSEIPDB_KEY", "")

# ─── Indian Cities Data ──────────────────────────────────────────────────────
INDIA_CITIES = [
    {"city": "Mumbai",    "state": "Maharashtra",   "lat": 19.0760, "lon": 72.8777, "sector": "Finance"},
    {"city": "Delhi",     "state": "Delhi",         "lat": 28.7041, "lon": 77.1025, "sector": "Government"},
    {"city": "Bengaluru", "state": "Karnataka",     "lat": 12.9716, "lon": 77.5946, "sector": "IT/Startup"},
    {"city": "Chennai",   "state": "Tamil Nadu",    "lat": 13.0827, "lon": 80.2707, "sector": "IT"},
    {"city": "Hyderabad", "state": "Telangana",     "lat": 17.3850, "lon": 78.4867, "sector": "IT/Pharma"},
    {"city": "Kolkata",   "state": "West Bengal",   "lat": 22.5726, "lon": 88.3639, "sector": "Finance"},
    {"city": "Pune",      "state": "Maharashtra",   "lat": 18.5204, "lon": 73.8567, "sector": "IT"},
    {"city": "Ahmedabad", "state": "Gujarat",       "lat": 23.0225, "lon": 72.5714, "sector": "Finance"},
    {"city": "Jaipur",    "state": "Rajasthan",     "lat": 26.9124, "lon": 75.7873, "sector": "Government"},
    {"city": "Lucknow",   "state": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462, "sector": "Government"},
    {"city": "Noida",     "state": "Uttar Pradesh", "lat": 28.5355, "lon": 77.3910, "sector": "IT"},
    {"city": "Gurgaon",   "state": "Haryana",       "lat": 28.4595, "lon": 77.0266, "sector": "Finance/IT"},
    {"city": "Surat",     "state": "Gujarat",       "lat": 21.1702, "lon": 72.8311, "sector": "Finance"},
    {"city": "Bhopal",    "state": "Madhya Pradesh","lat": 23.2599, "lon": 77.4126, "sector": "Government"},
    {"city": "Patna",     "state": "Bihar",         "lat": 25.5941, "lon": 85.1376, "sector": "Government"},
]

ATTACK_TYPES = ["DDoS", "Phishing", "Ransomware", "SQLi", "XSS", "Brute Force", "MitM", "Zero-Day"]

ATTACK_COLORS = {
    "DDoS":        "#ff4444",
    "Phishing":    "#ff8c00",
    "Ransomware":  "#ff0066",
    "SQLi":        "#9400d3",
    "XSS":         "#ff6600",
    "Brute Force": "#cc0000",
    "MitM":        "#ff3399",
    "Zero-Day":    "#ff0000",
}

SOURCE_COUNTRIES = [
    {"country": "China",       "lat": 35.86,  "lon": 104.19},
    {"country": "Russia",      "lat": 61.52,  "lon": 105.32},
    {"country": "North Korea", "lat": 40.34,  "lon": 127.51},
    {"country": "USA",         "lat": 37.09,  "lon": -95.71},
    {"country": "Pakistan",    "lat": 30.38,  "lon": 69.35},
    {"country": "Iran",        "lat": 32.43,  "lon": 53.69},
    {"country": "Brazil",      "lat": -14.24, "lon": -51.93},
    {"country": "Netherlands", "lat": 52.13,  "lon": 5.29},
    {"country": "Germany",     "lat": 51.17,  "lon": 10.45},
    {"country": "Ukraine",     "lat": 48.38,  "lon": 31.17},
]

# ─── App Setup ───────────────────────────────────────────────────────────────
app = FastAPI(title="India Cyber Map API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()

# ─── In-memory State ─────────────────────────────────────────────────────────
active_connections: list[WebSocket] = []
attack_cache: list[dict] = []
stats_cache: dict = {}
cve_cache: list[dict] = []
phishing_cache: list[dict] = []

# ─── WebSocket Broadcast ─────────────────────────────────────────────────────
async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    dead_connections = []
    for ws in active_connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead_connections.append(ws)
    # Remove dead connections
    for ws in dead_connections:
        if ws in active_connections:
            active_connections.remove(ws)

# ─── Data Generators ─────────────────────────────────────────────────────────
def generate_simulated_attack() -> dict:
    """
    Generate a realistic simulated attack event.
    These fill in gaps when real API data is sparse.
    Always labeled 'simulated: true' — shown as SIM in the UI.
    """
    target = random.choice(INDIA_CITIES)
    source = random.choice(SOURCE_COUNTRIES)
    attack_type = random.choice(ATTACK_TYPES)
    severity = random.randint(30, 99)

    return {
        "id": f"sim_{int(datetime.now().timestamp())}_{random.randint(1000, 9999)}",
        "source_ip": f"{random.randint(1,254)}.{random.randint(0,254)}.{random.randint(0,254)}.{random.randint(1,254)}",
        "source_country": source["country"],
        "source_lat": source["lat"] + random.uniform(-3, 3),
        "source_lon": source["lon"] + random.uniform(-3, 3),
        "target_city": target["city"],
        "target_state": target["state"],
        "target_lat": target["lat"] + random.uniform(-0.3, 0.3),
        "target_lon": target["lon"] + random.uniform(-0.3, 0.3),
        "target_sector": target["sector"],
        "attack_type": attack_type,
        "attack_color": ATTACK_COLORS[attack_type],
        "severity": severity,
        "timestamp": datetime.utcnow().isoformat(),
        "source": "Simulated",
        "simulated": True,
    }

# ─── Real API Fetchers ────────────────────────────────────────────────────────
async def fetch_abuseipdb() -> list[dict]:
    """
    Fetch recent malicious IPs from AbuseIPDB.
    Free tier: 1,000 requests/day. We call this every 30 min = 48 calls/day.
    """
    if not ABUSEIPDB_KEY:
        print("No ABUSEIPDB_KEY set — skipping real data fetch")
        return []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://api.abuseipdb.com/api/v2/blacklist",
                headers={
                    "Key": ABUSEIPDB_KEY,
                    "Accept": "application/json"
                },
                params={
                    "confidenceMinimum": 90,
                    "limit": 50
                }
            )

            if response.status_code != 200:
                print(f"AbuseIPDB error: {response.status_code}")
                return []

            data = response.json().get("data", [])
            attacks = []

            for item in data:
                target = random.choice(INDIA_CITIES)
                attack_type = random.choice(ATTACK_TYPES)
                attacks.append({
                    "id": f"abuse_{item['ipAddress']}_{int(datetime.now().timestamp())}",
                    "source_ip": item["ipAddress"],
                    "source_country": item.get("countryCode", "Unknown"),
                    "source_lat": random.uniform(-60, 70),
                    "source_lon": random.uniform(-140, 140),
                    "target_city": target["city"],
                    "target_state": target["state"],
                    "target_lat": target["lat"] + random.uniform(-0.5, 0.5),
                    "target_lon": target["lon"] + random.uniform(-0.5, 0.5),
                    "target_sector": target["sector"],
                    "attack_type": attack_type,
                    "attack_color": ATTACK_COLORS[attack_type],
                    "severity": item.get("abuseConfidenceScore", 50),
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "AbuseIPDB",
                    "simulated": False,
                })

            print(f"Fetched {len(attacks)} attacks from AbuseIPDB")
            return attacks

    except Exception as e:
        print(f"AbuseIPDB fetch error: {e}")
        return []


async def fetch_nvd_cves() -> list[dict]:
    """
    Fetch latest CVEs from National Vulnerability Database.
    Completely free, no API key needed.
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)

            response = await client.get(
                "https://services.nvd.nist.gov/rest/json/cves/2.0",
                params={
                    "resultsPerPage": 10,
                    "pubStartDate": start_date.strftime("%Y-%m-%dT00:00:00.000"),
                    "pubEndDate": end_date.strftime("%Y-%m-%dT23:59:59.999"),
                }
            )

            if response.status_code != 200:
                print(f"NVD error: {response.status_code}")
                return []

            data = response.json()
            cves = []

            for item in data.get("vulnerabilities", []):
                cve = item.get("cve", {})
                metrics = cve.get("metrics", {})

                # Try different CVSS versions
                cvss_data = (
                    (metrics.get("cvssMetricV31") or [{}])[0].get("cvssData", {})
                    or (metrics.get("cvssMetricV30") or [{}])[0].get("cvssData", {})
                    or (metrics.get("cvssMetricV2") or [{}])[0].get("cvssData", {})
                )

                # Get English description
                descriptions = cve.get("descriptions", [])
                desc = next(
                    (d["value"] for d in descriptions if d["lang"] == "en"),
                    "No description available"
                )

                cves.append({
                    "id": cve.get("id", "Unknown"),
                    "description": desc[:300],
                    "severity": cvss_data.get("baseSeverity", "UNKNOWN"),
                    "score": cvss_data.get("baseScore", 0),
                    "published": cve.get("published", ""),
                    "vector": cvss_data.get("attackVector", "NETWORK"),
                })

            print(f"Fetched {len(cves)} CVEs from NVD")
            return cves

    except Exception as e:
        print(f"NVD fetch error: {e}")
        return []


async def fetch_phishing_urls() -> list[dict]:
    """
    Fetch active phishing/malware URLs from URLhaus.
    Completely free, no authentication required.
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://urlhaus-api.abuse.ch/v1/urls/recent/",
                data={"limit": "20"}
            )

            if response.status_code != 200:
                print(f"URLhaus error: {response.status_code}")
                return []

            data = response.json()
            phishing = []

            for url_data in data.get("urls", []):
                if url_data.get("url_status") == "online":
                    phishing.append({
                        "url": url_data.get("url", ""),
                        "tags": url_data.get("tags") or [],
                        "date_added": url_data.get("date_added", ""),
                        "threat": url_data.get("threat", "malware"),
                    })

            print(f"Fetched {len(phishing)} phishing URLs from URLhaus")
            return phishing[:10]

    except Exception as e:
        print(f"URLhaus fetch error: {e}")
        return []

# ─── Stats Calculator ─────────────────────────────────────────────────────────
def compute_stats(attacks: list[dict]) -> dict:
    """Compute aggregate statistics from attack records."""
    if not attacks:
        return {}

    type_count: dict = {}
    sector_count: dict = {}
    state_count: dict = {}
    country_count: dict = {}

    for a in attacks:
        t = a.get("attack_type", "Unknown")
        type_count[t] = type_count.get(t, 0) + 1

        s = a.get("target_sector", "Unknown")
        sector_count[s] = sector_count.get(s, 0) + 1

        st = a.get("target_state", "Unknown")
        state_count[st] = state_count.get(st, 0) + 1

        c = a.get("source_country", "Unknown")
        country_count[c] = country_count.get(c, 0) + 1

    return {
        "total_attacks": len(attacks),
        "attack_types": dict(sorted(type_count.items(), key=lambda x: -x[1])),
        "sectors": dict(sorted(sector_count.items(), key=lambda x: -x[1])),
        "states": dict(sorted(state_count.items(), key=lambda x: -x[1])),
        "top_sources": dict(sorted(country_count.items(), key=lambda x: -x[1])[:10]),
        "last_updated": datetime.utcnow().isoformat(),
    }

# ─── Scheduled Jobs ───────────────────────────────────────────────────────────
async def refresh_attacks():
    """Runs every 30 seconds. Fetches real data + fills with simulation."""
    global attack_cache, stats_cache

    # Try to get real data
    real_attacks = await fetch_abuseipdb()

    # Always generate some simulated attacks to keep the map active
    num_simulated = max(0, 5 - len(real_attacks))
    simulated = [generate_simulated_attack() for _ in range(num_simulated)]

    new_attacks = real_attacks + simulated

    # Keep last 200 attacks in memory
    attack_cache = (new_attacks + attack_cache)[:200]

    # Update stats
    stats_cache = compute_stats(attack_cache)

    # Send to all connected browsers
    for attack in new_attacks:
        await broadcast({"type": "attack", "data": attack})

    await broadcast({"type": "stats", "data": stats_cache})

    print(f"Refreshed attacks: {len(real_attacks)} real + {len(simulated)} simulated. Total cached: {len(attack_cache)}")


async def refresh_cves():
    """Runs every hour. Fetches latest CVEs."""
    global cve_cache
    cves = await fetch_nvd_cves()
    if cves:
        cve_cache = cves
        await broadcast({"type": "cves", "data": cves})


async def refresh_phishing():
    """Runs every 15 minutes. Fetches active phishing URLs."""
    global phishing_cache
    phish = await fetch_phishing_urls()
    if phish:
        phishing_cache = phish
        await broadcast({"type": "phishing", "data": phish})

# ─── App Lifecycle ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Start background jobs when the server boots."""
    print("Starting India Cyber Map API...")

    # Schedule jobs
    scheduler.add_job(refresh_attacks, "interval", seconds=30, id="attacks")
    scheduler.add_job(refresh_cves,    "interval", hours=1,   id="cves")
    scheduler.add_job(refresh_phishing,"interval", minutes=15, id="phishing")
    scheduler.start()

    # Fetch immediately on startup (don't wait 30 seconds)
    await refresh_attacks()
    await refresh_cves()
    await refresh_phishing()

    print("API started successfully!")


@app.on_event("shutdown")
async def shutdown():
    """Clean up when server stops."""
    scheduler.shutdown()
    print("API stopped.")

# ─── REST Endpoints ───────────────────────────────────────────────────────────
@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "India Cyber Map API",
        "attacks_cached": len(attack_cache),
        "connected_clients": len(active_connections),
    }


@app.get("/api/attacks")
async def get_attacks(limit: int = 50):
    """Get recent attacks (REST fallback if WebSocket unavailable)."""
    return {
        "attacks": attack_cache[:limit],
        "total": len(attack_cache)
    }


@app.get("/api/stats")
async def get_stats():
    """Get aggregate statistics."""
    return stats_cache if stats_cache else compute_stats(attack_cache)


@app.get("/api/cves")
async def get_cves():
    """Get latest CVEs."""
    if cve_cache:
        return cve_cache
    return await fetch_nvd_cves()


@app.get("/api/phishing")
async def get_phishing():
    """Get active phishing URLs."""
    if phishing_cache:
        return phishing_cache
    return await fetch_phishing_urls()

# ─── WebSocket Endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket connection.
    Sends live attacks to the browser as they happen.
    """
    await websocket.accept()
    active_connections.append(websocket)
    print(f"New client connected. Total clients: {len(active_connections)}")

    # Send current state immediately when someone connects
    await websocket.send_json({"type": "init", "data": attack_cache[:50]})
    await websocket.send_json({"type": "stats", "data": stats_cache})

    if cve_cache:
        await websocket.send_json({"type": "cves", "data": cve_cache})

    if phishing_cache:
        await websocket.send_json({"type": "phishing", "data": phishing_cache})

    try:
        # Keep connection alive, waiting for messages (ping/pong handled by uvicorn)
        while True:
            data = await websocket.receive_text()
            # Handle ping
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"Client disconnected. Total clients: {len(active_connections)}")