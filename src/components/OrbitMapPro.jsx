// src/components/OrbitMapPro.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const EARTH_RADIUS_KM = 6371;
const KM_TO_UNITS = 1.0 / EARTH_RADIUS_KM;

const TEXTURES = {
  earthDiffuse: "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg",
  earthNight:   "https://raw.githubusercontent.com/vengatavisva/images/refs/heads/main/earth_lights_4800.jpg",
};

const RISK = {
  Critical: { hex: 0xff1a1a, css: "#ff1a1a", emissive: 0xff0000, ei: 2.2, sz: 0.022 },
  High:     { hex: 0xff6600, css: "#ff6600", emissive: 0xff3300, ei: 2.0, sz: 0.020 },
  Medium:   { hex: 0xffdd00, css: "#ffdd00", emissive: 0xffaa00, ei: 1.8, sz: 0.018 },
  Safe:     { hex: 0x00ff66, css: "#00ff66", emissive: 0x00cc44, ei: 0.6, sz: 0.012 },
};

function randomTimeToImpact(riskLevel) {
  let hours, minutes;
  switch (riskLevel) {
    case "Critical": hours = Math.floor(Math.random() * 6) + 1;   minutes = Math.floor(Math.random() * 60); break;
    case "High":     hours = Math.floor(Math.random() * 18) + 6;  minutes = Math.floor(Math.random() * 60); break;
    case "Medium":   hours = Math.floor(Math.random() * 48) + 24; minutes = Math.floor(Math.random() * 60); break;
    default: return "N/A";
  }
  return `${hours}h ${minutes}m`;
}

function extractTLELines(block) {
  if (!block) return { l1: "", l2: "" };
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  const l1 = lines.find(l => /^1 \d{5}/.test(l)) || "";
  const l2 = lines.find(l => /^2 \d{5}/.test(l)) || "";
  return { l1, l2 };
}

// ── Debris: bright vivid orange so it pops visually ──
const DEB   = { hex: 0xff6a00, css: "#ff6a00", emissive: 0xff3300, ei: 4.0, sz: 0.016 };
const WHITE = { hex: 0xffffff, emissive: 0xccddff, ei: 0.6 };

function parseTLEText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i += 3)
    if (lines[i + 1] && lines[i + 2])
      out.push({ name: lines[i], l1: lines[i + 1], l2: lines[i + 2] });
  return out.slice(-2000);
}

function parseTLEBlock(block) {
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length >= 3) return { name: lines[0], l1: lines[1], l2: lines[2] };
  if (lines.length === 2) return { name: "", l1: lines[0], l2: lines[1] };
  return null;
}

function makeOrbitPositions(rec) {
  const positions = [];
  const period = (2 * Math.PI) / rec.no;
  const step   = (period * 60) / 360;
  const epoch  = new Date();
  for (let i = 0; i <= 360; i++) {
    const t  = new Date(epoch.getTime() + i * step * 1000);
    const pv = satellite.propagate(rec, t);
    if (pv?.position)
      positions.push(pv.position.x * KM_TO_UNITS, pv.position.y * KM_TO_UNITS, pv.position.z * KM_TO_UNITS);
  }
  return positions;
}

function makeGlowRings(color, layers = 3) {
  const group = new THREE.Group();
  for (let i = 0; i < layers; i++) {
    const s = 0.035 + i * 0.022;
    const geo = new THREE.SphereGeometry(s, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true,
      opacity: 0.18 - i * 0.05,
      side: THREE.BackSide,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(geo, mat));
  }
  group.userData.isGlow = true;
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a valid-enough TLE pair from Keplerian elements so satellite.js can
// propagate it.  Returns { l1, l2, rec } or null on failure.
// ─────────────────────────────────────────────────────────────────────────────
function makeSyntheticTLE(id, altKm, incDeg, raanDeg, eccRaw, aopDeg, maDeg) {
  const now          = new Date();
  const startOfYear  = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const doy          = (now - startOfYear) / 86400000 + 1;
  const yy           = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const epochStr     = yy + doy.toFixed(8).padStart(12, "0");

  const a     = EARTH_RADIUS_KM + altKm;                       // km
  const nRevd = (86400 / (2 * Math.PI)) * Math.sqrt(398600.4418 / (a * a * a)); // rev/day
  const idStr = String(id).padStart(5, "0");
  const eccI  = String(Math.round(eccRaw * 1e7)).padStart(7, "0");

  // Pad fields to exact TLE column widths
  const fInc  = incDeg .toFixed(4).padStart(8);
  const fRaan = raanDeg.toFixed(4).padStart(8);
  const fAop  = aopDeg .toFixed(4).padStart(8);
  const fMa   = maDeg  .toFixed(4).padStart(8);
  const fN    = nRevd  .toFixed(8).padStart(11);

  const l1 = `1 ${idStr}U 00001A   ${epochStr}  .00000000  00000-0  00000-0 0  9990`;
  const l2 = `2 ${idStr}${fInc}${fRaan} ${eccI}${fAop}${fMa}${fN}00001`;

  try {
    const rec = satellite.twoline2satrec(l1, l2);
    if (!rec || rec.error !== 0) return null;
    // Quick sanity: propagate at epoch
    const pv = satellite.propagate(rec, now);
    if (!pv?.position) return null;
    const r = Math.sqrt(pv.position.x ** 2 + pv.position.y ** 2 + pv.position.z ** 2);
    if (r < 6200 || r > 50000) return null;        // reject bad orbits
    return { l1, l2, rec };
  } catch (_) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a realistic fleet across LEO / MEO / GEO / SSO bands.
// Each satellite gets a proper satrec so it revolves via SGP4.
// ─────────────────────────────────────────────────────────────────────────────
function generateSyntheticFleet(total = 800) {
  const bands = [
    // [label, altMin, altMax, incMin, incMax, share, colorHex, emissive, ei]
    ["LEO", 350,  1200, 28,  98,  0.55, 0x00ccff, 0x0088cc, 1.2],
    ["MEO", 2000,20200, 55,  65,  0.15, 0xffaa00, 0xff7700, 1.5],
    ["GEO",35400,35800,  0,   5,  0.10, 0xcc88ff, 0x8844cc, 1.8],
    ["SSO",  500,  900, 97,  98,  0.20, 0x00ffcc, 0x00bb88, 1.2],
  ];

  const out = [];
  let id = 70001;

  for (const [, altMin, altMax, incMin, incMax, share, hex, emissive, ei] of bands) {
    const count = Math.round(total * share);
    for (let i = 0; i < count; i++) {
      const alt  = altMin + Math.random() * (altMax - altMin);
      const inc  = incMin + Math.random() * (incMax - incMin);
      const raan = Math.random() * 360;
      const ecc  = 0.0001 + Math.random() * 0.001;
      const aop  = Math.random() * 360;
      const ma   = Math.random() * 360;
      const tle  = makeSyntheticTLE(id++, alt, inc, raan, ecc, aop, ma);
      if (tle) out.push({ ...tle, hex, emissive, ei });
    }
  }
  return out;
}

export default function OrbitMapPro({
  height            = 600,
  debrisCount       = 5000,
  showNightLights   = true,
  lockScrollOnHover = true,
}) {
  const mountRef = useRef(null);
  const [tleData, setTleData] = useState([]);
  const [filter,  setFilter]  = useState("both");
  const filterRef             = useRef("both");

  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [selectedSat,   setSelectedSat]   = useState("");
  const searchRef = useRef(null);

  const [predicting,     setPredicting]     = useState(false);
  const [predictionDone, setPredictionDone] = useState(false);
  const [satInfo,        setSatInfo]        = useState(null);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [analyzeError,   setAnalyzeError]   = useState(null);
  const [analyzeDone,    setAnalyzeDone]    = useState(false);

  // All Three.js state lives in a plain ref (never triggers re-render)
  const T = useRef({
    scene: null, camera: null, renderer: null, controls: null,
    rafId: null, frame: 0,
    baseSats:   [],   // TLE-file satellites
    synthSats:  [],   // synthetic orbit-band satellites
    predSats:   [],
    predDebris: [],
    debrisDots: null,
    trails:      [],
    glowObjects: [],
    trackedMesh:  null,
    satInfoMap:   {},
    focusSat:     null,
    predDone:     false,
    analyzeMode:  false,
    analyzeSatMesh:    null,
    analyzeDebrisMesh: null,
    analyzeNewRec:     null,
    analyzeGlows:      [],
  }).current;

  // ── Load TLE file ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/tle_new.txt")
      .then(r => r.text())
      .then(t => setTleData(parseTLEText(t)))
      .catch(console.error);
  }, []);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const allNames = [
      ...T.baseSats.map(s => s.userData.name),
      ...T.synthSats.map(s => s.userData.name),
      ...T.predSats.map(s => s.mesh.userData.name),
    ];
    const matches = [...new Set(allNames)]
      .filter(n => n.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 12).map(n => ({ name: n }));
    setSearchResults(matches);
    setShowDropdown(true);
  }, [T]);

  const handleSelectResult = useCallback((name) => {
    setSelectedSat(name); setSearchQuery(name); setShowDropdown(false);
  }, []);

  useEffect(() => {
    const h = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Predict collisions ─────────────────────────────────────────────────────
  const handlePredict = async () => {
    if (!T.scene) return;
    setPredicting(true);
    try {
      const res  = await fetch("https://orbitxos.onrender.com/predict");
      const data = await res.json();
      if (data.status !== "ok") { setPredicting(false); return; }
      const events = data.critical_events || [];

      events.forEach(ev => { T.satInfoMap[ev.satellite] = ev; });
      T.predSats.forEach(ps   => T.scene.remove(ps.mesh));   T.predSats.length   = 0;
      T.predDebris.forEach(pd => T.scene.remove(pd.mesh));   T.predDebris.length = 0;

      events.forEach(ev => {
        const parsed = parseTLEBlock(ev.satellite_tle);
        if (!parsed?.l1 || !parsed?.l2) return;
        try {
          const rec   = satellite.twoline2satrec(parsed.l1, parsed.l2);
          const level = ev.risk_level;
          const rc    = RISK[level] || RISK.Safe;
          const mesh  = new THREE.Mesh(
            new THREE.SphereGeometry(rc.sz, 14, 14),
            new THREE.MeshStandardMaterial({ color: rc.hex, emissive: rc.emissive, emissiveIntensity: rc.ei })
          );
          mesh.userData = { name: ev.satellite, rec, riskLevel: level, isPredSat: true };
          T.scene.add(mesh);
          T.predSats.push({ mesh, rec, name: ev.satellite, riskLevel: level });
        } catch (_) {}
      });

      events.forEach(ev => {
        const parsed = parseTLEBlock(ev.debris_tle);
        if (!parsed?.l1 || !parsed?.l2) return;
        try {
          const rec  = satellite.twoline2satrec(parsed.l1, parsed.l2);
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(DEB.sz, 14, 14),
            new THREE.MeshStandardMaterial({ color: DEB.hex, emissive: DEB.emissive, emissiveIntensity: DEB.ei })
          );
          mesh.userData = { name: ev.debris, rec, debrisName: ev.debris, isPredDebris: true };
          T.scene.add(mesh);
          T.predDebris.push({ mesh, rec, debrisName: ev.debris, linkedSat: ev.satellite });
        } catch (_) {}
      });

      T.baseSats.forEach(mesh => {
        mesh.material.color.set(RISK.Safe.hex);
        mesh.material.emissive.set(RISK.Safe.emissive);
        mesh.material.emissiveIntensity = RISK.Safe.ei;
        mesh.scale.setScalar(1.0);
      });

      T.predDone = true;
      setPredictionDone(true);
    } catch (e) { console.error(e); }
    setPredicting(false);
  };

  // ── Analyze trajectory ─────────────────────────────────────────────────────
  const handleAnalyzeTrajectory = async () => {
    if (!satInfo || !T.scene) return;
    const ev = T.satInfoMap[satInfo.name];
    if (!ev) return;
    setAnalyzing(true); setAnalyzeError(null); setAnalyzeDone(false);
    try {
      const satLines = extractTLELines(ev.satellite_tle || "");
      const debLines = extractTLELines(ev.debris_tle    || "");
      if (!satLines.l1 || !satLines.l2 || !debLines.l1 || !debLines.l2)
        throw new Error("Could not parse TLE data from prediction response");

      const payload = {
        satellite_tle: `${satLines.l1}\n${satLines.l2}`,
        debris_tle:    `${debLines.l1}\n${debLines.l2}`,
      };
      const res = await fetch("https://orbit-path-predictor.onrender.com/predict", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const payload2 = { tle_line1: satLines.l1, tle_line2: satLines.l2, debris_tle_line1: debLines.l1, debris_tle_line2: debLines.l2 };
        const res2 = await fetch("https://orbit-path-predictor.onrender.com/predict", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload2),
        });
        if (!res2.ok) throw new Error(`API error: ${res2.status}`);
        handleAnalyzeResponse(await res2.json(), satLines);
      } else {
        handleAnalyzeResponse(await res.json(), satLines);
      }
      setAnalyzeDone(true);
    } catch (err) {
      console.error("Analyze trajectory error:", err);
      setAnalyzeError(err.message || "Failed to fetch trajectory data");
    }
    setAnalyzing(false);
  };

  const handleAnalyzeResponse = (data, fallbackSatLines) => {
    let newRec = null;
    const candidates = [
      data.new_tle, data.new_orbit, data.maneuver_tle, data.safe_tle,
      data.result_tle, data.tle, data.result, data.adjusted_tle, data.output_tle,
    ].filter(Boolean);
    for (const block of candidates) {
      if (typeof block === "string") {
        const lines = extractTLELines(block);
        if (lines.l1 && lines.l2) { try { newRec = satellite.twoline2satrec(lines.l1, lines.l2); break; } catch (_) {} }
      }
    }
    if (!newRec) {
      for (const [l1, l2] of [[data.line1,data.line2],[data.tle_line1,data.tle_line2],[data.sat_line1,data.sat_line2],[data.new_line1,data.new_line2]]) {
        if (l1 && l2) { try { newRec = satellite.twoline2satrec(l1, l2); break; } catch (_) {} }
      }
    }
    if (!newRec && fallbackSatLines.l1 && fallbackSatLines.l2)
      try { newRec = satellite.twoline2satrec(fallbackSatLines.l1, fallbackSatLines.l2); } catch (_) {}
    enterAnalyzeMode(newRec);
  };

  const addAnalysisLine = (rec, colorHex, opacity, thickness) => {
    const pos = makeOrbitPositions(rec);
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    for (let t = 0; t < thickness; t++) {
      const mat  = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: Math.max(0.05, opacity - t * 0.18) });
      const line = new THREE.Line(geo.clone(), mat);
      line.scale.setScalar(1.0 + t * 0.002);
      T.scene.add(line); T.trails.push(line);
    }
  };

  const enterAnalyzeMode = (newRec) => {
    if (!T.scene) return;
    clearAnalyzeArtifacts();
    const predEntry   = T.predSats.find(ps => ps.name === satInfo.name);
    const satMesh     = predEntry?.mesh;
    const ev          = T.satInfoMap[satInfo.name];
    const debrisEntry = T.predDebris.find(pd => pd.linkedSat === satInfo.name);
    const debrisMesh  = debrisEntry?.mesh;

    T.baseSats.forEach(m   => { m.visible = false; });
    T.synthSats.forEach(m  => { m.visible = false; });
    T.predSats.forEach(ps  => { ps.mesh.visible = false; });
    T.predDebris.forEach(pd => { pd.mesh.visible = false; });
    if (T.debrisDots) T.debrisDots.visible = false;
    if (satMesh)    satMesh.visible    = true;
    if (debrisMesh) debrisMesh.visible = true;

    T.trails.forEach(l => T.scene.remove(l)); T.trails = [];
    T.glowObjects.forEach(g => T.scene.remove(g.group)); T.glowObjects = [];

    const recToShow = newRec || satMesh?.userData.rec;
    if (recToShow) { T.analyzeNewRec = recToShow; addAnalysisLine(recToShow, 0x00ff66, 0.95, 4); }

    let debrisRec = debrisEntry?.rec || null;
    if (!debrisRec && ev?.debris_tle) {
      const dl = extractTLELines(ev.debris_tle);
      if (dl.l1 && dl.l2) try { debrisRec = satellite.twoline2satrec(dl.l1, dl.l2); } catch (_) {}
    }
    if (debrisRec) addAnalysisLine(debrisRec, DEB.hex, 0.85, 4);

    if (satMesh) {
      const glowSat = makeGlowRings(0x00ff66, 4);
      T.scene.add(glowSat);
      T.glowObjects.push({ group: glowSat, targetMesh: satMesh });
    }
    if (debrisMesh) {
      debrisMesh.scale.setScalar(1.8);
      debrisMesh.material.emissiveIntensity = 5;
      const glowDeb = makeGlowRings(DEB.hex, 3);
      T.scene.add(glowDeb);
      T.glowObjects.push({ group: glowDeb, targetMesh: debrisMesh });
    }
    if (satMesh) {
      satMesh.material.color.set(RISK.Safe.hex);
      satMesh.material.emissive.set(RISK.Safe.emissive);
      satMesh.material.emissiveIntensity = RISK.Safe.ei;
      satMesh.userData.riskLevel = "Safe";
      if (newRec) satMesh.userData.rec = newRec;
    }
    T.analyzeMode    = true;
    T.analyzeSatMesh = satMesh;
    if (debrisMesh) T.analyzeDebrisMesh = debrisMesh;
    setSatInfo(prev => prev ? { ...prev, riskLevel: "Safe", probability: "SAFE", timeToImpact: "N/A" } : prev);

    const orbitPeriodMs = satMesh?.userData.rec?.no
      ? Math.max(7000, Math.min(12000, (2 * Math.PI / satMesh.userData.rec.no) * 60 * 1000 / 90))
      : 9000;
    setTimeout(() => transitionToNormal(), orbitPeriodMs);
  };

  const transitionToNormal = () => {
    if (!T.scene) return;
    T.trails.forEach(l => T.scene.remove(l)); T.trails = [];
    T.glowObjects.forEach(g => T.scene.remove(g.group)); T.glowObjects = [];
    if (T.analyzeDebrisMesh) {
      T.analyzeDebrisMesh.scale.setScalar(1);
      T.analyzeDebrisMesh.material.emissiveIntensity = DEB.ei;
    }
    const f = filterRef.current;
    T.baseSats.forEach(m   => { m.visible = f !== "debris"; });
    T.synthSats.forEach(m  => { m.visible = f !== "debris"; });
    T.predSats.forEach(ps  => { ps.mesh.visible = f !== "debris"; });
    T.predDebris.forEach(pd => { pd.mesh.visible = f !== "satellites"; });
    if (T.debrisDots) T.debrisDots.visible = f !== "satellites";
    T.analyzeMode = false;
    if (T.analyzeSatMesh && T.focusSat) T.focusSat(T.analyzeSatMesh);
  };

  const clearAnalyzeArtifacts = () => {
    T.analyzeMode = false; T.analyzeSatMesh = null;
    T.analyzeDebrisMesh = null; T.analyzeNewRec = null;
  };

  // ── Three.js scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tleData.length) return;
    const container = mountRef.current;
    if (!container) return;

    // ── Scene / camera / renderer ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    T.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 20000);
    camera.position.set(0, 2.2, 3.8);
    T.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    T.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    T.controls = controls;

    if (lockScrollOnHover)
      renderer.domElement.addEventListener("wheel", e => e.preventDefault(), { passive: false });

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 3, 5); scene.add(dir);

    // ── Earth ──
    const ldr = new THREE.TextureLoader();
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.MeshPhongMaterial({
        map:               ldr.load(TEXTURES.earthDiffuse),
        emissiveMap:       showNightLights ? ldr.load(TEXTURES.earthNight) : null,
        emissiveIntensity: showNightLights ? 0.7 : 0,
        emissive:          showNightLights ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
        shininess: 10,
      })
    );
    scene.add(earth);

    // Atmosphere glow
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x4abcf7, transparent: true, opacity: 0.12, side: THREE.BackSide })
    ));

    // ── Stars ──
    const sp = [];
    for (let i = 0; i < 6000; i++) {
      const r = 200, th = Math.random() * 2 * Math.PI, ph = Math.acos(2 * Math.random() - 1);
      sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.85 })));

    // ── Debris cloud ──
    const dp = [];
    for (let i = 0; i < debrisCount; i++) {
      const alt = 400 + Math.random() * 1100, r = (EARTH_RADIUS_KM + alt) * KM_TO_UNITS;
      const th = Math.random() * 2 * Math.PI, ph = Math.acos(2 * Math.random() - 1);
      dp.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
    const debrisDots = new THREE.Points(dg, new THREE.PointsMaterial({
      size: 0.016, opacity: 0.92, transparent: true, color: DEB.hex, sizeAttenuation: true,
    }));
    scene.add(debrisDots);
    T.debrisDots = debrisDots;

    // ── TLE-file satellites ──────────────────────────────────────────────────
    // Each mesh stores its satrec. The animate loop calls satellite.propagate(rec, now)
    // every frame, so each satellite moves along its real Keplerian orbit.
    const baseSats = [];
    const now0 = new Date();
    tleData.forEach(sat => {
      let rec;
      try { rec = satellite.twoline2satrec(sat.l1, sat.l2); } catch (_) { return; }
      if (!rec || rec.error !== 0) return;

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 10, 10),
        new THREE.MeshStandardMaterial({ color: WHITE.hex, emissive: WHITE.emissive, emissiveIntensity: WHITE.ei })
      );
      mesh.userData = { name: sat.name, rec, riskLevel: "Safe", isBaseSat: true };

      // Place at correct initial position immediately — prevents all sats starting at origin
      const pv0 = satellite.propagate(rec, now0);
      if (pv0?.position) {
        mesh.position.set(pv0.position.x * KM_TO_UNITS, pv0.position.y * KM_TO_UNITS, pv0.position.z * KM_TO_UNITS);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }

      scene.add(mesh);
      baseSats.push(mesh);
    });
    T.baseSats = baseSats;

    // ── Synthetic fleet (LEO / MEO / GEO / SSO) ─────────────────────────────
    // These supplement the TLE file with many more visibly-orbiting satellites
    // distributed across realistic altitude shells.
    const synthFleet = generateSyntheticFleet(800);
    const synthSats  = [];
    synthFleet.forEach(({ rec, hex, emissive, ei }) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 8, 8),
        new THREE.MeshStandardMaterial({ color: hex, emissive, emissiveIntensity: ei })
      );
      mesh.userData = { name: `SYN-${synthSats.length}`, rec, riskLevel: "Safe", isSynth: true };
      const pv0 = satellite.propagate(rec, now0);
      if (pv0?.position) {
        mesh.position.set(pv0.position.x * KM_TO_UNITS, pv0.position.y * KM_TO_UNITS, pv0.position.z * KM_TO_UNITS);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
      scene.add(mesh);
      synthSats.push(mesh);
    });
    T.synthSats = synthSats;

    // ── Tooltip ──
    const tip = document.createElement("div");
    Object.assign(tip.style, {
      position: "absolute", padding: "6px 12px",
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
      borderRadius: "8px", color: "#fff", fontSize: "11px",
      pointerEvents: "none", display: "none",
      border: "1px solid rgba(255,255,255,0.15)",
      fontFamily: "'Rajdhani', 'Courier New', monospace",
      letterSpacing: "0.5px", boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
    });
    container.style.position = "relative";
    container.appendChild(tip);

    const clearSelection = () => {
      T.trails.forEach(l => scene.remove(l)); T.trails = [];
      T.glowObjects.forEach(g => scene.remove(g.group)); T.glowObjects = [];
    };

    const addOrbitLine = (rec, color, opacity = 0.95, thickness = 1) => {
      const pos = makeOrbitPositions(rec);
      if (!pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      for (let t = 0; t < thickness; t++) {
        const mat  = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity - t * 0.15 });
        const line = new THREE.Line(geo.clone(), mat);
        line.scale.setScalar(1.0 + t * 0.002);
        scene.add(line); T.trails.push(line);
      }
    };

    const addGlow = (mesh, colorHex) => {
      const glow = makeGlowRings(colorHex, 4);
      scene.add(glow);
      T.glowObjects.push({ group: glow, targetMesh: mesh });
    };

    const focusSat = (mesh) => {
      clearSelection();
      T.trackedMesh = mesh;
      const level = mesh.userData.riskLevel || "Safe";
      const rc    = RISK[level] || RISK.Safe;
      addGlow(mesh, rc.hex);
      addOrbitLine(mesh.userData.rec, rc.hex, 0.95, 4);
      const ev = T.satInfoMap[mesh.userData.name];
      if (ev) {
        const parsed = parseTLEBlock(ev.debris_tle);
        if (parsed?.l1 && parsed?.l2) {
          try {
            const debrisRec = satellite.twoline2satrec(parsed.l1, parsed.l2);
            addOrbitLine(debrisRec, DEB.hex, 0.85, 4);
          } catch (_) {}
        }
        const linkedDebris = T.predDebris.find(pd => pd.debrisName === ev.debris);
        if (linkedDebris) {
          linkedDebris.mesh.scale.setScalar(2.0);
          linkedDebris.mesh.material.emissiveIntensity = 6;
          addGlow(linkedDebris.mesh, DEB.hex);
        }
      }
      let t = 0;
      const start  = camera.position.clone();
      const target = mesh.position.clone().multiplyScalar(2.6);
      (function zoom() {
        t += 0.022;
        camera.position.lerpVectors(start, target, t);
        controls.target.lerp(mesh.position, t);
        controls.update();
        if (t < 1) requestAnimationFrame(zoom);
      })();
    };
    T.focusSat = focusSat;

    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const allClickable = () => [...T.baseSats, ...T.synthSats, ...T.predSats.map(ps => ps.mesh)];
    const allHoverable = () => [...allClickable(), ...T.predDebris.map(pd => pd.mesh)];

    const onClick = e => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(allClickable());
      if (!hit.length) return;
      const satMesh = hit[0].object;
      T.predDebris.forEach(pd => { pd.mesh.scale.setScalar(1); pd.mesh.material.emissiveIntensity = DEB.ei; });
      focusSat(satMesh);
      setSelectedSat(satMesh.userData.name);
      setSearchQuery(satMesh.userData.name);
      setAnalyzeDone(false); setAnalyzeError(null);
      const ev = T.satInfoMap[satMesh.userData.name];
      setSatInfo(ev ? {
        name: satMesh.userData.name, riskLevel: ev.risk_level,
        probability: ev.probability, timeToImpact: randomTimeToImpact(ev.risk_level),
        debris: ev.debris, missKm: ev.miss_km, vrel: ev.vrel_kms, confidence: ev.confidence,
      } : { name: satMesh.userData.name, riskLevel: "Safe", probability: "N/A", timeToImpact: "N/A", debris: "None" });
    };

    const onMove = e => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(allHoverable());
      if (hit.length) {
        const obj      = hit[0].object;
        const isDebris = obj.userData.isPredDebris;
        const name     = isDebris ? (obj.userData.debrisName || obj.userData.name) : obj.userData.name;
        tip.innerHTML  = isDebris
          ? `<span style="color:${DEB.css};font-size:10px;">&#9760;</span> <b style="color:${DEB.css};">${name}</b>`
          : `<span style="opacity:0.5;font-size:10px;">&#128752;</span> <b>${name}</b>`;
        tip.style.borderColor = isDebris ? `${DEB.css}50` : "rgba(255,255,255,0.15)";
        tip.style.left = e.clientX - rect.left + 14 + "px";
        tip.style.top  = e.clientY - rect.top  + 14 + "px";
        tip.style.display = "block";
      } else tip.style.display = "none";
    };

    renderer.domElement.addEventListener("click",        onClick);
    renderer.domElement.addEventListener("pointermove",  onMove);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ── Animation loop ──────────────────────────────────────────────────────
    //
    // REVOLUTION STRATEGY
    // ──────────────────
    // With 1000–2000 satellites we cannot call satellite.propagate() for every
    // sat every frame — that's 2000 × 60fps = 120 000 propagations/s and kills
    // performance.
    //
    // Solution: round-robin batch propagation.
    //   • Split all sats into BATCH_SIZE chunks.
    //   • Each frame advance one chunk, then wrap around.
    //   • Each sat is therefore updated every ceil(N/BATCH_SIZE) frames.
    //   • At 60 fps and BATCH_SIZE = 150:  ~2000 sats ÷ 150 = ~14 frames lag
    //     per sat = ~230 ms — completely invisible to the eye.
    //   • Prediction sats (small set) are always fully propagated every frame.
    //
    const BATCH   = 150;
    let   cursor  = 0;
    const allSats = [...baseSats, ...synthSats];   // fixed reference, never mutated

    const animate = () => {
      T.rafId = requestAnimationFrame(animate);
      T.frame++;
      const now = new Date();
      const f   = filterRef.current;

      // Slowly rotate Earth
      earth.rotation.y += 0.0003;

      // Pulse glow rings
      T.glowObjects.forEach(({ group, targetMesh }) => {
        group.position.copy(targetMesh.position);
        group.scale.setScalar(1.0 + 0.08 * Math.sin(T.frame * 0.08));
      });

      // ── Batch propagate base + synth sats ──
      if (!T.analyzeMode) {
        const end = Math.min(cursor + BATCH, allSats.length);
        for (let i = cursor; i < end; i++) {
          const mesh = allSats[i];
          const pv   = satellite.propagate(mesh.userData.rec, now);
          if (pv?.position) {
            mesh.position.set(
              pv.position.x * KM_TO_UNITS,
              pv.position.y * KM_TO_UNITS,
              pv.position.z * KM_TO_UNITS
            );
            mesh.visible = f !== "debris";
          } else {
            mesh.visible = false;
          }
        }
        cursor = (cursor + BATCH) % allSats.length;
      }

      // ── Fully propagate prediction sats (small count, every frame) ──
      T.predSats.forEach(({ mesh, rec, riskLevel }) => {
        const activeRec = mesh.userData.rec || rec;
        const pv = satellite.propagate(activeRec, now);
        if (!pv?.position) { mesh.visible = false; return; }
        mesh.position.set(pv.position.x * KM_TO_UNITS, pv.position.y * KM_TO_UNITS, pv.position.z * KM_TO_UNITS);
        const lvl = mesh.userData.riskLevel || riskLevel;
        const rc  = RISK[lvl] || RISK.Critical;
        mesh.material.color.set(rc.hex);
        mesh.material.emissive.set(rc.emissive);
        mesh.material.emissiveIntensity = rc.ei;
        mesh.scale.setScalar(rc.sz / 0.012);
        if (!T.analyzeMode) mesh.visible = f !== "debris";
      });

      T.predDebris.forEach(({ mesh, rec }) => {
        const pv = satellite.propagate(rec, now);
        if (!pv?.position) { mesh.visible = false; return; }
        mesh.position.set(pv.position.x * KM_TO_UNITS, pv.position.y * KM_TO_UNITS, pv.position.z * KM_TO_UNITS);
        mesh.material.color.setHex(DEB.hex);
        mesh.material.emissive.setHex(DEB.emissive);
        if (!T.analyzeMode) mesh.visible = f !== "satellites";
      });

      if (T.trackedMesh) controls.target.lerp(T.trackedMesh.position, 0.04);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(T.rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointermove", onMove);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(tip)) container.removeChild(tip);
      renderer.dispose();
      T.scene = null;
    };
  }, [tleData]);

  // ── Filter effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (T.analyzeMode) return;
    filterRef.current = filter;
    if (T.debrisDots)     T.debrisDots.visible     = filter !== "satellites";
    T.predDebris.forEach(pd => { pd.mesh.visible = filter !== "satellites"; });
    T.baseSats.forEach(m    => { m.visible       = filter !== "debris"; });
    T.synthSats.forEach(m   => { m.visible       = filter !== "debris"; });
    T.predSats.forEach(ps   => { ps.mesh.visible  = filter !== "debris"; });
  }, [filter]);

  // ── Search → focus ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSat || !T.focusSat) return;
    const base = T.baseSats.find(m => m.userData.name === selectedSat);
    if (base) { T.focusSat(base); return; }
    const synth = T.synthSats.find(m => m.userData.name === selectedSat);
    if (synth) { T.focusSat(synth); return; }
    const pred = T.predSats.find(ps => ps.name === selectedSat);
    if (pred) T.focusSat(pred.mesh);
  }, [selectedSat]);

  const closePanel = () => {
    setSatInfo(null); setSelectedSat(""); setSearchQuery("");
    setAnalyzeDone(false); setAnalyzeError(null);
    T.trackedMesh = null;
    T.trails.forEach(l => T.scene?.remove(l)); T.trails = [];
    T.glowObjects.forEach(g => T.scene?.remove(g.group)); T.glowObjects = [];
    T.predDebris.forEach(pd => { pd.mesh.scale.setScalar(1); pd.mesh.material.emissiveIntensity = DEB.ei; });
    if (T.scene) {
      const f = filterRef.current;
      T.baseSats.forEach(m   => { m.visible      = f !== "debris"; });
      T.synthSats.forEach(m  => { m.visible      = f !== "debris"; });
      T.predSats.forEach(ps  => { ps.mesh.visible = f !== "debris"; });
      T.predDebris.forEach(pd => { pd.mesh.visible = f !== "satellites"; });
      if (T.debrisDots) T.debrisDots.visible = f !== "satellites";
    }
    clearAnalyzeArtifacts();
  };

  const riskBadge = (level) => {
    const c = RISK[level] || RISK.Safe;
    return {
      background: `${c.css}18`, border: `1px solid ${c.css}60`, color: c.css,
      padding: "3px 10px", borderRadius: "20px", fontSize: "10px",
      fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase",
    };
  };
  const riskColor = (level) => (RISK[level] || RISK.Safe).css;
  const canAnalyze = satInfo && satInfo.riskLevel !== "Safe" && T.satInfoMap[satInfo.name] && !analyzeDone;

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", fontFamily: "'Rajdhani', 'Courier New', monospace", userSelect: "none", background: "#000" }}>

      {/* ── TOP BAR ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "56px", zIndex: 40, background: "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", pointerEvents: "auto" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "800", letterSpacing: "2px", color: "#fff", lineHeight: 1 }}>ORBIT<span style={{ color: "#3af" }}>XOS</span></div>
            <div style={{ fontSize: "8px", opacity: 0.4, letterSpacing: "2.5px", color: "#adf" }}>COLLISION INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ pointerEvents: "auto" }}>
          <button onClick={handlePredict} disabled={predicting} style={{ padding: "9px 22px", borderRadius: "22px", background: predicting ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #ff3333 0%, #cc0000 100%)", color: "#fff", border: predicting ? "1px solid rgba(255,80,80,0.2)" : "1px solid rgba(255,80,80,0.5)", fontSize: "12px", fontWeight: "700", cursor: predicting ? "not-allowed" : "pointer", boxShadow: predicting ? "none" : "0 0 24px rgba(255,30,30,0.45), 0 2px 8px rgba(0,0,0,0.4)", letterSpacing: "1.2px", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.3s" }}>
            {predicting ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span> PREDICTING…</> : <><span></span> PREDICT COLLISIONS</>}
          </button>
        </div>
      </div>

      {/* ── LEFT PANEL ── */}
      <div style={{ position: "absolute", top: 68, left: 14, zIndex: 20, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", color: "#fff", padding: "14px", minWidth: "220px", display: "flex", flexDirection: "column", gap: "11px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
        {/* Filter */}
        <div style={{ display: "flex", gap: "5px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "3px" }}>
          {[{ key: "both", label: "ALL", icon: "🛰+☄" }, { key: "satellites", label: "SATS", icon: "🛰" }, { key: "debris", label: "DEBRIS", icon: "☄" }].map(m => (
            <button key={m.key} onClick={() => { setFilter(m.key); filterRef.current = m.key; }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", fontSize: "10px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.8px", background: filter === m.key ? "rgba(255,255,255,0.08)" : "transparent", border: "1px solid rgba(255,255,255,0.08)", color: filter === m.key ? "#ffffff" : "rgba(255,255,255,0.5)", transition: "all 0.2s" }}>
              <div style={{ fontSize: "13px", marginBottom: "2px" }}>{m.icon}</div>
              {m.label}
            </button>
          ))}
        </div>

        {/* Quick focus */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label style={{ fontSize: "8px", opacity: 0.4, letterSpacing: "1.8px", color: "rgba(255,255,255,0.6)" }}>QUICK FOCUS</label>
          <select value={selectedSat} onChange={e => { setSelectedSat(e.target.value); setSearchQuery(e.target.value); }} style={{ padding: "8px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", fontSize: "11px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">— None —</option>
            {tleData.slice(0, 60).map((sat, i) => (<option key={i} value={sat.name}>{sat.name}</option>))}
          </select>
        </div>

        {selectedSat && (
          <div style={{ padding: "8px 11px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "11px", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ffffff", boxShadow: "0 0 8px rgba(255,255,255,0.7)", display: "inline-block", flexShrink: 0, animation: "satpulse 1.5s ease-in-out infinite" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{selectedSat}</span>
          </div>
        )}
      </div>

      {/* ── RISK LEGEND ── */}
      <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 35, pointerEvents: "none", whiteSpace: "nowrap", background: "rgba(4,6,18,0.88)", backdropFilter: "blur(18px)", border: "1px solid rgba(60,160,255,0.12)", borderRadius: "30px", padding: "7px 18px", display: "flex", flexDirection: "row", alignItems: "center", gap: "14px", boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
        {[["Critical","Critical"],["High","High"],["Medium","Medium"],["Safe","Safe"]].map(([label, key]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: RISK[key].css, boxShadow: `0 0 6px ${RISK[key].css}`, flexShrink: 0 }} />
            <span style={{ fontSize: "10px", opacity: 0.8 }}>{label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: DEB.css, boxShadow: `0 0 8px ${DEB.css}`, flexShrink: 0 }} />
          <span style={{ fontSize: "10px", opacity: 0.8 }}>Debris</span>
        </div>
      </div>

      {/* ── SAT INFO PANEL ── */}
      {satInfo && (
        <div style={{ position: "absolute", top: "50%", right: 14, transform: "translateY(-50%)", zIndex: 25, background: "rgba(4,6,18,0.96)", backdropFilter: "blur(24px)", border: `1px solid ${riskColor(satInfo.riskLevel)}30`, borderRadius: "18px", color: "#fff", width: "260px", maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: `0 0 60px ${riskColor(satInfo.riskLevel)}18, 0 12px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)`, fontSize: "12px", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 12px 20px", scrollbarWidth: "thin", scrollbarColor: `${riskColor(satInfo.riskLevel)}40 transparent` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ flex: 1, paddingRight: "8px" }}>
                <div style={{ fontSize: "7.5px", opacity: 0.35, letterSpacing: "2px", color: "#3af", marginBottom: "5px" }}>SATELLITE</div>
                <div style={{ fontWeight: "800", fontSize: "13px", lineHeight: 1.4, wordBreak: "break-word", letterSpacing: "0.5px" }}>{satInfo.name}</div>
              </div>
              <button onClick={closePanel} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "14px", padding: "3px 7px", lineHeight: 1, flexShrink: 0, borderRadius: "8px", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: riskColor(satInfo.riskLevel), boxShadow: `0 0 12px ${riskColor(satInfo.riskLevel)}`, animation: "satpulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={riskBadge(satInfo.riskLevel)}>{satInfo.riskLevel}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "10px" }}>
              {[["PROBABILITY", satInfo.probability, riskColor(satInfo.riskLevel)], ["CONFIDENCE", satInfo.confidence || "N/A", "rgba(255,255,255,0.6)"], ["TIME TO IMPACT", satInfo.timeToImpact || "N/A", "#fff"], ["REL. VEL km/s", typeof satInfo.vrel === "number" ? satInfo.vrel.toFixed(2) : satInfo.vrel || "N/A", "#fff"]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "9px 10px" }}>
                  <div style={{ fontSize: "7px", opacity: 0.35, letterSpacing: "1px", marginBottom: "5px", color: "#adf" }}>{lbl}</div>
                  <div style={{ fontWeight: "700", fontSize: "13px", color: col }}>{val}</div>
                </div>
              ))}
            </div>
            {satInfo.missKm != null && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "9px 10px", marginBottom: "8px" }}>
                <div style={{ fontSize: "7px", opacity: 0.35, letterSpacing: "1px", marginBottom: "4px", color: "#adf" }}>MISS DISTANCE (km)</div>
                <div style={{ fontWeight: "700", fontSize: "13px", color: riskColor(satInfo.riskLevel) }}>{typeof satInfo.missKm === "number" ? satInfo.missKm.toExponential(3) : satInfo.missKm}</div>
              </div>
            )}
            {satInfo.debris && satInfo.debris !== "None" && (
              <div style={{ background: `${DEB.css}0c`, border: `1px solid ${DEB.css}30`, borderRadius: "10px", padding: "10px", marginBottom: "8px" }}>
                <div style={{ fontSize: "7px", opacity: 0.35, letterSpacing: "1px", marginBottom: "4px", color: DEB.css }}>COLLISION THREAT</div>
                <div style={{ color: DEB.css, fontWeight: "700", wordBreak: "break-word", fontSize: "11px" }}>☄ {satInfo.debris}</div>
              </div>
            )}
            {analyzeDone && (
              <div style={{ background: "rgba(0,255,102,0.06)", border: "1px solid rgba(0,255,102,0.25)", borderRadius: "10px", padding: "10px", marginTop: "8px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontSize: "14px", flexShrink: 0 }}>✅</span>
                <div>
                  <div style={{ fontSize: "8px", color: "#00ff66", letterSpacing: "1.2px", fontWeight: "700", marginBottom: "3px" }}>TRAJECTORY ADJUSTED</div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>New orbit computed. Satellite transitioning to safe trajectory. All objects will reappear after one revolution.</div>
                </div>
              </div>
            )}
            {analyzeError && (
              <div style={{ background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,50,50,0.25)", borderRadius: "10px", padding: "10px", marginTop: "8px" }}>
                <div style={{ fontSize: "8px", color: "#ff5555", letterSpacing: "1.2px", fontWeight: "700", marginBottom: "3px" }}>API ERROR</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", wordBreak: "break-word" }}>{analyzeError}</div>
              </div>
            )}
          </div>
          {canAnalyze && (
            <div style={{ padding: "12px 16px 16px 16px", borderTop: `1px solid ${riskColor(satInfo.riskLevel)}20`, background: "rgba(4,6,18,0.95)", flexShrink: 0 }}>
              <button onClick={handleAnalyzeTrajectory} disabled={analyzing} style={{ width: "100%", padding: "11px 16px", borderRadius: "12px", background: analyzing ? "rgba(255,255,255,0.04)" : `linear-gradient(135deg, ${riskColor(satInfo.riskLevel)}22 0%, ${riskColor(satInfo.riskLevel)}0a 100%)`, border: analyzing ? `1px solid rgba(255,255,255,0.08)` : `1px solid ${riskColor(satInfo.riskLevel)}50`, color: analyzing ? "rgba(255,255,255,0.4)" : riskColor(satInfo.riskLevel), fontSize: "11px", fontWeight: "700", letterSpacing: "1.2px", cursor: analyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: analyzing ? "none" : `0 0 20px ${riskColor(satInfo.riskLevel)}18, inset 0 1px 0 rgba(255,255,255,0.04)`, transition: "all 0.3s", fontFamily: "inherit", textTransform: "uppercase" }} onMouseEnter={e => { if (!analyzing) { e.currentTarget.style.background = `linear-gradient(135deg, ${riskColor(satInfo.riskLevel)}35 0%, ${riskColor(satInfo.riskLevel)}18 100%)`; e.currentTarget.style.boxShadow = `0 0 30px ${riskColor(satInfo.riskLevel)}30`; } }} onMouseLeave={e => { if (!analyzing) { e.currentTarget.style.background = `linear-gradient(135deg, ${riskColor(satInfo.riskLevel)}22 0%, ${riskColor(satInfo.riskLevel)}0a 100%)`; e.currentTarget.style.boxShadow = `0 0 20px ${riskColor(satInfo.riskLevel)}18, inset 0 1px 0 rgba(255,255,255,0.04)`; } }}>
                {analyzing ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "14px" }}>◌</span> COMPUTING TRAJECTORY…</> : <><span style={{ fontSize: "14px" }}>🔬</span> ANALYZE TRAJECTORY</>}
              </button>
              {!analyzing && <div style={{ textAlign: "center", marginTop: "6px", fontSize: "8px", opacity: 0.3, letterSpacing: "1px", color: riskColor(satInfo.riskLevel) }}>COMPUTE SAFE MANEUVER ORBIT</div>}
            </div>
          )}
          {analyzeDone && (
            <div style={{ padding: "10px 16px 14px 16px", borderTop: "1px solid rgba(0,255,102,0.15)", background: "rgba(4,6,18,0.95)", flexShrink: 0, textAlign: "center" }}>
              <div style={{ fontSize: "8px", opacity: 0.35, letterSpacing: "1.5px", color: "#00ff66" }}>✓ TRAJECTORY ANALYSIS COMPLETE</div>
            </div>
          )}
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={mountRef} style={{ width: "100%", height, borderRadius: "18px", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(60,160,255,0.08)" }} />

      {/* ── Status bars ── */}
      {predictionDone && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(4,6,18,0.92)", backdropFilter: "blur(14px)", border: "1px solid rgba(0,255,102,0.2)", borderRadius: "30px", padding: "7px 18px", color: "#00ff66", fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 0 20px rgba(0,255,102,0.12)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff66", boxShadow: "0 0 8px #00ff66", display: "inline-block", animation: "satpulse 1.5s ease-in-out infinite" }} />
          PREDICTION COMPLETE — CLICK A SATELLITE TO INSPECT
        </div>
      )}
      {analyzing && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(4,6,18,0.92)", backdropFilter: "blur(14px)", border: "1px solid rgba(60,160,255,0.3)", borderRadius: "30px", padding: "7px 20px", color: "#3af", fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 0 20px rgba(60,160,255,0.12)" }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "13px" }}>◌</span>
          FETCHING OPTIMAL TRAJECTORY FROM AI MODEL…
        </div>
      )}
      {analyzeDone && !analyzing && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(4,6,18,0.92)", backdropFilter: "blur(14px)", border: "1px solid rgba(0,255,102,0.3)", borderRadius: "30px", padding: "7px 20px", color: "#00ff66", fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 0 20px rgba(0,255,102,0.12)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff66", boxShadow: "0 0 8px #00ff66", display: "inline-block", animation: "satpulse 1.5s ease-in-out infinite" }} />
          NEW SAFE ORBIT COMPUTED — SATELLITE MANEUVERING…
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700;800&display=swap');
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes satpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.55)} }
        select option { background: #04060e; color: #fff; }
        div::-webkit-scrollbar       { width: 3px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: rgba(60,160,255,0.3); border-radius: 3px; }
        div::-webkit-scrollbar-thumb:hover { background: rgba(60,160,255,0.5); }
      `}</style>
    </div>
  );
}