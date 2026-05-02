// src/pages/AIPredictor.jsx
import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { useLocation } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import StarfieldBackground from "../components/StarfieldBackground";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_UNITS = 1.0;
const KM_TO_UNITS = EARTH_RADIUS_UNITS / EARTH_RADIUS_KM;
const SCALE_FACTOR = 25;
const COLLISION_DISTANCE = 0.3;
const MU = 3.986004418e5;
const MU_MS = 3.986004418e14;

const TEXTURES = {
  earthDiffuse: "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg",
  earthNight: "https://raw.githubusercontent.com/pmndrs/drei-assets/master/textures/earth-night.jpg",
};

const EXPO_OUT = [0.16, 1, 0.3, 1];
const BACK_OUT = [0.34, 1.56, 0.64, 1];

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 48, x = 0, scale = 1, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-72px 0px" });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y, x, scale }}
      animate={inView ? { opacity: 1, y: 0, x: 0, scale: 1 } : {}}
      transition={{ duration: 0.85, delay, ease: EXPO_OUT }}
    >{children}</motion.div>
  );
}

// ─── Stagger ──────────────────────────────────────────────────────────────────
function Stagger({ children, stagger = 0.08, delayStart = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  return (
    <motion.div ref={ref} className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delayStart } } }}
    >{children}</motion.div>
  );
}

const itemUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EXPO_OUT } },
};

// ─── Result components ────────────────────────────────────────────────────────
function DataRow({ label, value, valueClass = "text-white" }) {
  return (
    <motion.div variants={itemUp}
      className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group"
    >
      <span className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors duration-200 tracking-wide">{label}</span>
      <span className={`text-sm font-semibold font-mono ${valueClass}`}>{value}</span>
    </motion.div>
  );
}

function Tile({ label, value, color = "text-cyan-300", span = 1 }) {
  return (
    <motion.div variants={itemUp}
      whileHover={{ scale: 1.025, transition: { duration: 0.18 } }}
      className={`relative bg-white/2.5 hover:bg-white/5 border border-white/[0.07] rounded-2xl p-4 text-center transition-colors duration-300 overflow-hidden ${span === 2 ? "col-span-2" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-gray-600 text-[10px] uppercase tracking-[0.18em] mb-2 font-medium">{label}</p>
      <p className={`font-bold text-xl leading-none ${color}`}>{value}</p>
    </motion.div>
  );
}

function PhaseLabel({ number, label, color }) {
  return (
    <motion.div variants={itemUp} className="flex items-center gap-3 mt-5 mb-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>{number}</div>
      <span className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}30, transparent)` }} />
    </motion.div>
  );
}

// ─── Orbital Mechanics ────────────────────────────────────────────────────────
function getOrbitalElements(rec) {
  if (!rec) return null;
  const meanMotionRadPerSec = (rec.no * 2 * Math.PI) / 60;
  const semiMajorAxisKm = Math.cbrt(MU / Math.pow(meanMotionRadPerSec, 2));
  const eccentricity = rec.ecco ?? 0;
  const inclinationRad = rec.inclo ?? 0;
  const vCirc_m_s = Math.sqrt(MU / semiMajorAxisKm) * 1000;
  const altitudeKm = semiMajorAxisKm - EARTH_RADIUS_KM;
  const periodMin = (2 * Math.PI) / rec.no;
  return { semiMajorAxisKm, eccentricity, inclinationRad, inclinationDeg: inclinationRad * (180 / Math.PI), vCirc_m_s, altitudeKm, periodMin };
}

function computeManeuverDetails(maneuver, risk, satRec) {
  if (!maneuver || !satRec) return null;
  const dv_mps = maneuver.recommended_dv_mps ?? null;
  if (dv_mps == null) return null;
  const el = getOrbitalElements(satRec);
  if (!el) return null;
  const { semiMajorAxisKm, eccentricity, inclinationDeg, vCirc_m_s, altitudeKm, periodMin } = el;
  const vNew_ms = maneuver.type === "lower" ? vCirc_m_s - dv_mps : vCirc_m_s + dv_mps;
  const rCurrent_m = semiMajorAxisKm * 1000;
  const energyNew = (vNew_ms * vNew_ms) / 2 - MU_MS / rCurrent_m;
  const aNew_m = -MU_MS / (2 * energyNew);
  const aNew_km = aNew_m / 1000;
  const altitudeDeltaKm = parseFloat((aNew_km - semiMajorAxisKm).toFixed(2));
  const aTransfer_km = (semiMajorAxisKm + aNew_km) / 2;
  const periodTransfer_min = (2 * Math.PI * Math.sqrt(Math.pow(aTransfer_km, 3) / MU)) / 60;
  const coastMin = parseFloat((periodTransfer_min / 2).toFixed(1));
  const rApo_km = aNew_km;
  const vAtApo_ms = Math.sqrt(MU * (2 / rApo_km - 1 / aTransfer_km)) * 1000;
  const vCircNew_ms = Math.sqrt(MU / aNew_km) * 1000;
  const dvBurn2_ms = parseFloat(Math.abs(vCircNew_ms - vAtApo_ms).toFixed(2));
  let deltaIncDeg = 0;
  if (risk?.delta_inclination_deg != null) {
    deltaIncDeg = Math.abs(risk.delta_inclination_deg);
  } else if (risk?.min_distance_km != null && semiMajorAxisKm > 0) {
    const chordKm = risk.min_distance_km;
    deltaIncDeg = parseFloat(((Math.asin(Math.min(chordKm / (2 * semiMajorAxisKm), 1)) * 180) / Math.PI).toFixed(3));
  }
  const deltaIncRad = (deltaIncDeg * Math.PI) / 180;
  const dvPlane_ms = parseFloat((2 * vCircNew_ms * Math.sin(deltaIncRad / 2)).toFixed(2));
  const progradeDeg = parseFloat((Math.atan2(dv_mps, vCirc_m_s) * (180 / Math.PI)).toFixed(2));
  const radialDeg = parseFloat((eccentricity * 90).toFixed(2));
  const normalDeg_burn1 = 0.0;
  const normalDeg_burn2 = parseFloat(deltaIncDeg > 0 ? (Math.atan2(dvPlane_ms, dvBurn2_ms) * (180 / Math.PI)).toFixed(2) : "0.00");
  const returnProgradeDeg = parseFloat((180 - progradeDeg + normalDeg_burn2 * 0.5).toFixed(2));
  const dvBurn2Combined_ms = parseFloat(Math.sqrt(dvBurn2_ms * dvBurn2_ms + dvPlane_ms * dvPlane_ms).toFixed(2));
  const totalDV = parseFloat((dv_mps + dvBurn2Combined_ms).toFixed(2));
  return {
    vOrb_ms: parseFloat(vCirc_m_s.toFixed(1)), altitudeKm: parseFloat(altitudeKm.toFixed(1)),
    inclinationDeg: parseFloat(inclinationDeg.toFixed(3)), eccentricity: parseFloat(eccentricity.toFixed(6)),
    deltaIncDeg: parseFloat(deltaIncDeg.toFixed(3)), dvBurn1_ms: parseFloat(dv_mps.toFixed(2)),
    progradeDeg, radialDeg, normalDeg_burn1,
    thrustDir: maneuver.type === "raise" ? "Prograde ↑" : maneuver.type === "lower" ? "Retrograde ↓" : maneuver.type ?? "N/A",
    coastMin, dvBurn2_ms, dvPlane_ms, dvBurn2Combined_ms, normalDeg_burn2, returnProgradeDeg,
    returnThrustDir: maneuver.type === "raise" ? "Retrograde ↓" : "Prograde ↑",
    returnCoastMin: parseFloat((periodMin / 2).toFixed(1)), altitudeDeltaKm, totalDV,
    note: maneuver.note,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIPredictor() {
  const location = useLocation();
  const passedState = location.state || {};
  const [tleData, setTleData]         = useState(null);
  const [risk, setRisk]               = useState(null);
  const [maneuver, setManeuver]       = useState(null);
  const [analyzing, setAnalyzing]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const mountRef   = useRef(null);
  const cleanupRef = useRef(() => {});

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setShowResults(false);
    try {
      const res = await fetch("https://orbit-path-predictor.onrender.com/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satellite_tle: passedState.satelliteTLE,
          debris_tle: passedState.debrisTLE,
          horizon_minutes: 60,
          step_seconds: 30,
        }),
      });
      const data = await res.json();
      setTleData({
        satellite: data.tle_output?.satellite_tle,
        debris: data.tle_output?.debris_tle,
        predicted_safe: data.tle_output?.predicted_safe_tle,
      });
      setRisk(data.risk || {});
      setManeuver(data.maneuver || {});
      setTimeout(() => { setAnalyzing(false); setShowResults(true); }, 700);
    } catch (err) {
      console.error("API Error:", err);
      setAnalyzing(false);
    }
  };

  function parseTLE(input) {
    if (!input) return null;
    const lines = String(input).trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    try { return satellite.twoline2satrec(lines[lines.length - 2], lines[lines.length - 1]); }
    catch (e) { return null; }
  }

  useEffect(() => {
    if (!showResults || !tleData) return;
    const container = mountRef.current;
    if (!container) return;
    if (container.hasChildNodes()) container.innerHTML = "";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const loader = new THREE.TextureLoader();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
    camera.position.set(0, 20, 40);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 3, 5);
    scene.add(dir);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.MeshStandardMaterial({
        map: loader.load(TEXTURES.earthDiffuse),
        emissiveMap: loader.load(TEXTURES.earthNight),
        emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.3, roughness: 1, metalness: 0,
      })
    );
    scene.add(earth);
    const sp = [];
    for (let i = 0; i < 2000; i++) {
      const r = 400, t = Math.random() * 2 * Math.PI, p = Math.acos(2 * Math.random() - 1);
      sp.push(r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 })));
    const satRec = parseTLE(tleData.satellite), debrisRec = parseTLE(tleData.debris), safeRec = parseTLE(tleData.predicted_safe);
    const satMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    const debrisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    scene.add(satMesh, debrisMesh);
    const colMarker = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 }));
    colMarker.visible = false;
    scene.add(colMarker);
    const computeOrbit = rec => {
      if (!rec) return [];
      const pts = [], s = 400, step = ((2 * Math.PI) / rec.no * 60) / s, now = new Date();
      for (let i = 0; i < s; i++) {
        const pv = satellite.propagate(rec, new Date(now.getTime() + i * step * 1000));
        if (pv.position) pts.push(new THREE.Vector3(pv.position.x * KM_TO_UNITS * SCALE_FACTOR, pv.position.y * KM_TO_UNITS * SCALE_FACTOR, pv.position.z * KM_TO_UNITS * SCALE_FACTOR));
      }
      return pts;
    };
    const satOrbit = computeOrbit(satRec), debrisOrbit = computeOrbit(debrisRec), safeOrbit = computeOrbit(safeRec);
    const makeTrail = (pts, color) => pts.length ? new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.6 })) : null;
    let satTrail = makeTrail(satOrbit, 0x00ff00);
    const debrisTrail = makeTrail(debrisOrbit, 0xff0000);
    if (satTrail) scene.add(satTrail);
    if (debrisTrail) scene.add(debrisTrail);
    let transitioning = false, tp = 0;
    const startTransition = () => { if (!safeOrbit.length) return; transitioning = true; tp = 0; if (satTrail) scene.remove(satTrail); };
    let frame = 0, animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!transitioning) { if (satOrbit.length) satMesh.position.copy(satOrbit[Math.floor(frame) % satOrbit.length]); }
      else {
        tp += 0.005;
        if (tp >= 1) { transitioning = false; satTrail = makeTrail(safeOrbit, 0x00ccff); if (satTrail) scene.add(satTrail); }
        else { const i = Math.floor(frame) % Math.min(satOrbit.length, safeOrbit.length); satMesh.position.lerpVectors(satOrbit[i], safeOrbit[i], tp); }
      }
      if (debrisOrbit.length) debrisMesh.position.copy(debrisOrbit[Math.floor(frame) % debrisOrbit.length]);
      if (!colMarker.visible && satMesh.position.distanceTo(debrisMesh.position) < COLLISION_DISTANCE) { colMarker.visible = true; colMarker.position.copy(satMesh.position); setTimeout(startTransition, 2000); }
      frame += 0.3; earth.rotation.y += 0.0005; controls.update(); renderer.render(scene, camera);
    };
    animate();
    const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
    window.addEventListener("resize", onResize);
    cleanupRef.current = () => {
      cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); controls.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); });
      renderer.dispose(); if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    return () => cleanupRef.current();
  }, [showResults, tleData]);

  const maneuverDetails = (() => {
    if (!maneuver || !tleData) return null;
    return computeManeuverDetails(maneuver, risk, parseTLE(tleData.satellite));
  })();

  return (
    <div className="relative min-h-screen text-white font-orbitron overflow-hidden">
      <StarfieldBackground />

      <style>{`
        @keyframes floatA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-18px)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-16px,22px)} }
        @keyframes orbitCW  { to{transform:rotate(360deg)} }
        @keyframes orbitCCW { to{transform:rotate(-360deg)} }
        @keyframes shimmerBg { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .glow-a { animation: floatA 10s ease-in-out infinite; }
        .glow-b { animation: floatB 13s ease-in-out infinite 1.5s; }
        .shimmer-text {
          background: linear-gradient(90deg,#f1f5f9 0%,#67e8f9 45%,#f1f5f9 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerBg 4.5s linear infinite;
        }
      `}</style>

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="glow-a absolute -top-40 left-1/4 w-145 h-145 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 65%)" }} />
        <div className="glow-b absolute bottom-20 right-1/4 w-120 h-120 rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 65%)" }} />
      </div>

      <div className="relative z-10">
        <Navbar />
        <section className="max-w-6xl mx-auto px-6 py-20 space-y-10">

          {/* ── PRE-ANALYSIS PANEL ── */}
          <AnimatePresence>
            {!showResults && (
              <motion.div key="tle"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24, scale: 0.98 }}
                transition={{ duration: 0.8, ease: EXPO_OUT }}
              >
                {/* Page title */}
                <motion.div
                  className="mb-10 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.7, ease: EXPO_OUT }}
                >
                  <motion.div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-5"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: BACK_OUT }}
                  >
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"
                      animate={{ opacity: [1, .2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                    <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-medium">
                      AI Trajectory Analysis
                    </span>
                  </motion.div>

                  <h1 className="text-4xl md:text-5xl font-bold shimmer-text mb-3">
                    Satellite &amp; Debris TLE Data
                  </h1>
                  <p className="text-gray-500 text-sm font-sans font-light tracking-wider max-w-sm mx-auto">
                    SGP4 propagation over 60 min horizon · 30 s resolution
                  </p>
                </motion.div>

                {/* Main card */}
                <motion.div
                  className="relative bg-black/50 backdrop-blur-xl rounded-3xl border border-white/8 overflow-hidden"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.8, ease: EXPO_OUT }}
                  style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,.5), 0 0 48px rgba(6,182,212,.05)" }}
                >
                  {/* Window chrome */}
                  <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/6 bg-white/1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                        <div className="w-3 h-3 rounded-full bg-green-500/60" />
                      </div>
                      <div className="w-px h-4 bg-white/8" />
                      <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">TLE_DATA_STREAM.JSON</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"
                        animate={{ opacity: [1, .3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                      <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">LIVE</span>
                    </div>
                  </div>

                  {/* TLE content */}
                  <div className="px-8 pt-6 pb-6">
                    <motion.div
                      className="font-mono text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                    >
                      {/* Satellite block */}
                      <p className="text-gray-600 text-[11px] tracking-widest mb-1.5">SATELLITE</p>
                      <p className="text-cyan-300 font-semibold mb-0.5">{String(passedState.satellite || "").trim()}</p>
                      {String(passedState.satelliteTLE || "").trim().split("\n").map((line, i) => (
                        <p key={i} className="text-green-400/80 leading-6">{line.trim()}</p>
                      ))}
                      <div className="h-5" />
                      <p className="text-gray-600 text-[11px] tracking-widest mb-1.5">DEBRIS OBJECT</p>
                      <p className="text-red-400 font-semibold mb-0.5">{String(passedState.debris || "").trim()}</p>
                      {String(passedState.debrisTLE || "").trim().split("\n").map((line, i) => (
                        <p key={i} className="text-red-300/60 leading-6">{line.trim()}</p>
                      ))}
                    </motion.div>

                    {/* Info chips + CTA */}
                    <motion.div
                      className="mt-8 flex flex-wrap items-center gap-3"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55, duration: 0.6, ease: EXPO_OUT }}
                    >
                      {[
                        { label: "HORIZON", value: "60 min" },
                        { label: "STEP",    value: "30 sec" },
                        { label: "ENGINE",  value: "SGP4"   },
                      ].map(({ label, value }) => (
                        <div key={label}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3"
                        >
                          <span className="text-[10px] text-gray-500 font-mono tracking-widest">{label}</span>
                          <span className="text-[10px] font-bold font-mono text-cyan-400">{value}</span>
                        </div>
                      ))}

                      <div className="ml-auto">
                        <motion.button
                          onClick={handleAnalyze}
                          disabled={analyzing}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="relative group flex items-center gap-3 px-7 py-3.5 rounded-2xl font-bold text-base tracking-wide overflow-hidden"
                          style={{
                            background: "linear-gradient(135deg, rgba(6,182,212,.15), rgba(168,85,247,.12))",
                            border: "1px solid rgba(6,182,212,.35)",
                            boxShadow: "0 0 24px rgba(6,182,212,.12), inset 0 1px 0 rgba(255,255,255,.06)",
                          }}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: "linear-gradient(135deg, rgba(6,182,212,.22), rgba(168,85,247,.16))" }} />
                          <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" className="relative text-cyan-400"
                            animate={analyzing ? { rotate: 360 } : {}}
                            transition={analyzing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                          >
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                            <path d="M12 6v6l4 2" strokeLinecap="round" />
                          </motion.svg>
                          <span className="relative bg-linear-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                            {analyzing ? "Analyzing…" : "Analyze Trajectory"}
                          </span>
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── LOADING ── */}
          <AnimatePresence>
            {analyzing && (
              <motion.div key="loader"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-8 py-24"
              >
                <div className="relative w-28 h-28 flex items-center justify-center">
                  {[{ s: 112, dur: 2.4, dir: 1, c: "rgba(6,182,212,.22)" },
                    { s: 78,  dur: 1.7, dir:-1, c: "rgba(6,182,212,.5)"  },
                    { s: 46,  dur: 1.1, dir: 1, c: "rgba(168,85,247,.65)" }]
                    .map(({ s, dur, dir, c }, i) => (
                      <div key={i} className="absolute rounded-full border-2"
                        style={{ width: s, height: s, borderColor: c, borderTopColor: i > 0 ? "transparent" : c,
                          animation: `${dir > 0 ? "orbitCW" : "orbitCCW"} ${dur}s linear infinite` }} />
                    ))}
                  <motion.div className="w-3.5 h-3.5 rounded-full bg-cyan-400"
                    animate={{ scale: [1, 1.7, 1], opacity: [.7, 1, .7] }}
                    transition={{ duration: 1.4, repeat: Infinity }} />
                </div>
                <div className="text-center space-y-2.5">
                  <p className="text-sm tracking-[0.3em] text-gray-400 uppercase font-light">Processing Trajectory</p>
                  <div className="flex gap-1.5 justify-center">
                    {[0,1,2,3,4].map(i => (
                      <motion.div key={i} className="w-1 h-1 rounded-full bg-cyan-500"
                        animate={{ opacity: [.15, 1, .15] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── RESULTS ── */}
          <AnimatePresence>
            {showResults && tleData && (
              <motion.div key="results"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                <Reveal y={32} className="text-center">
                  <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                      animate={{ opacity: [1,.3,1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                    <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/80 font-medium">Analysis Complete</span>
                  </div>
                  <h2 className="text-3xl font-bold shimmer-text">Orbit Simulator</h2>
                </Reveal>

                <Reveal y={48} delay={0.08}>
                  <div className="relative bg-black/40 backdrop-blur-md rounded-2xl border border-white/[0.07] overflow-hidden"
                    style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.03), 0 0 64px rgba(6,182,212,.07)" }}>
                    <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-3 bg-linear-to-b from-black/70 to-transparent">
                      <div className="flex gap-1.5">
                        {["bg-red-500/50","bg-yellow-500/50","bg-green-500/50"].map(c => <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
                      </div>
                      <span className="text-[10px] text-gray-600 font-mono tracking-widest uppercase">3D Orbital Renderer — SGP4</span>
                      <div className="flex items-center gap-4 text-[10px] text-gray-600 font-mono">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />SAT</span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />DEBRIS</span>
                      </div>
                    </div>
                    <div ref={mountRef} className="w-full rounded-2xl overflow-hidden" style={{ height: "550px" }} />
                    <div className="absolute bottom-0 inset-x-0 h-16 bg-linear-to-t from-black/50 to-transparent pointer-events-none" />
                  </div>
                </Reveal>

                <Reveal y={16} delay={0.12}>
                  <div className="flex justify-center gap-8 text-sm text-gray-400">
                    {[{ bg:"bg-green-500", label:"Satellite" },{ bg:"bg-red-500", label:"Debris" }].map(({ bg, label }) => (
                      <span key={label} className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full ${bg}`} />
                        <span className="tracking-wide font-light">{label}</span>
                      </span>
                    ))}
                  </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8">
                  <Reveal y={40} x={-24} delay={0.18}>
                    <div className="h-full bg-black/40 backdrop-blur-xl rounded-2xl border border-white/[0.07] p-8 relative overflow-hidden"
                      style={{ boxShadow: "0 0 40px rgba(6,182,212,.05), inset 0 1px 0 rgba(255,255,255,.04)" }}>
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-500/30 to-transparent" />
                      <div className="flex items-center gap-3 mb-7">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <motion.div className="w-2.5 h-2.5 rounded-full bg-cyan-400"
                            animate={{ scale:[1,1.5,1] }} transition={{ duration:2.2, repeat:Infinity }} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-600 uppercase tracking-[0.22em] mb-0.5">Proximity Analysis</p>
                          <h3 className="text-xl font-bold text-cyan-300">Risk Analysis</h3>
                        </div>
                      </div>
                      <motion.div initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.32, duration: 0.5, ease: BACK_OUT }} className="mb-6">
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-[0.14em] uppercase
                          ${risk?.risky ? "bg-red-500/10 border border-red-500/30 text-red-300" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"}`}>
                          <motion.span className={`w-2 h-2 rounded-full ${risk?.risky ? "bg-red-400" : "bg-emerald-400"} inline-block`}
                            animate={{ opacity:[1,.25,1] }} transition={{ duration:1.6, repeat:Infinity }} />
                          {risk?.risky ? "⚠ Collision Risk Detected" : "✓ Safe Trajectory"}
                        </span>
                      </motion.div>
                      <Stagger stagger={0.07} delayStart={0.28}>
                        <DataRow label="Minimum Distance" value={risk?.min_distance_km ? `${risk.min_distance_km.toFixed(2)} km` : "N/A"} valueClass="text-red-400" />
                        <DataRow label="Time of Closest Approach" value={risk?.tca ?? "N/A"} valueClass="text-white text-xs" />
                        <DataRow label="Orbit Regime" value={risk?.regime ?? "N/A"} valueClass="text-amber-300" />
                        <DataRow label="Risk Threshold" value={risk?.threshold_km ? `${risk.threshold_km} km` : "N/A"} />
                        {maneuverDetails && (<>
                          <motion.div variants={itemUp}><div className="h-px bg-white/6 my-2" /></motion.div>
                          <DataRow label="Current Altitude"  value={`${maneuverDetails.altitudeKm} km`}   valueClass="text-cyan-300" />
                          <DataRow label="Inclination"       value={`${maneuverDetails.inclinationDeg}°`} valueClass="text-cyan-300" />
                          <DataRow label="Eccentricity"      value={`${maneuverDetails.eccentricity}`}    valueClass="text-cyan-300" />
                          {maneuverDetails.deltaIncDeg > 0 && <DataRow label="Req. Plane Change" value={`${maneuverDetails.deltaIncDeg}°`} valueClass="text-orange-300" />}
                        </>)}
                      </Stagger>
                    </div>
                  </Reveal>

                  <Reveal y={40} x={24} delay={0.24}>
                    <div className="h-full bg-black/40 backdrop-blur-xl rounded-2xl border border-white/[0.07] p-8 relative overflow-hidden"
                      style={{ boxShadow: "0 0 40px rgba(168,85,247,.05), inset 0 1px 0 rgba(255,255,255,.04)" }}>
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-purple-500/30 to-transparent" />
                      <div className="flex items-center gap-3 mb-7">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                          <motion.div className="w-2.5 h-2.5 rounded-full bg-purple-400"
                            animate={{ scale:[1,1.5,1] }} transition={{ duration:2.5, repeat:Infinity }} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-600 uppercase tracking-[0.22em] mb-0.5">Computed Solution</p>
                          <h3 className="text-xl font-bold text-purple-300">Orbital Avoidance Maneuver</h3>
                        </div>
                      </div>
                      {maneuverDetails ? (
                        <Stagger stagger={0.055} delayStart={0.22}>
                          <motion.div variants={itemUp}>
                            <div className="grid grid-cols-2 gap-3 mb-1">
                              <Tile label="Orbital Velocity" value={`${maneuverDetails.vOrb_ms} m/s`} color="text-cyan-300" />
                              <Tile label="Altitude" value={`${maneuverDetails.altitudeKm} km`} color="text-cyan-300" />
                            </div>
                          </motion.div>
                          <PhaseLabel number="1" label="Avoidance Burn" color="#818cf8" />
                          <motion.div variants={itemUp}>
                            <div className="grid grid-cols-2 gap-3">
                              <Tile label="ΔV (Burn 1)" value={`${maneuverDetails.dvBurn1_ms} m/s`} color="text-blue-400" />
                              <Tile label="Thrust Direction" value={maneuverDetails.thrustDir} color="text-blue-400" />
                              <Tile label="Prograde Angle" value={`${maneuverDetails.progradeDeg}°`} color="text-amber-300" />
                              <Tile label="Radial Angle" value={`${maneuverDetails.radialDeg}°`} color="text-amber-300" />
                              <Tile label="Normal (Out-of-Plane)" value={`${maneuverDetails.normalDeg_burn1}°`} color="text-amber-300" span={2} />
                              <Tile label="Altitude Change" value={`${maneuverDetails.altitudeDeltaKm > 0 ? "+" : ""}${maneuverDetails.altitudeDeltaKm} km`} color="text-orange-300" span={2} />
                            </div>
                          </motion.div>
                          <motion.div variants={itemUp} className="flex items-center gap-4 py-3 px-4 rounded-2xl border border-white/5 bg-white/2 my-1">
                            <div className="flex-1 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
                            <div className="text-center">
                              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Transfer Coast · ½ Hohmann</p>
                              <p className="text-gray-300 font-mono font-bold text-sm">~{maneuverDetails.coastMin} min</p>
                            </div>
                            <div className="flex-1 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
                          </motion.div>
                          <PhaseLabel number="2" label="Circularisation + Plane Change" color="#34d399" />
                          <motion.div variants={itemUp}>
                            <div className="grid grid-cols-2 gap-3">
                              <Tile label="ΔV (Circularise)" value={`${maneuverDetails.dvBurn2_ms} m/s`} color="text-emerald-400" />
                              <Tile label="ΔV (Plane Change)" value={`${maneuverDetails.dvPlane_ms} m/s`} color="text-emerald-400" />
                              <Tile label="Normal Angle (Burn 2)" value={`${maneuverDetails.normalDeg_burn2}°`} color="text-emerald-400" />
                              <Tile label="Return Direction" value={maneuverDetails.returnThrustDir} color="text-emerald-400" />
                              <Tile label="Combined ΔV (Burn 2)" value={`${maneuverDetails.dvBurn2Combined_ms} m/s`} color="text-emerald-300" span={2} />
                            </div>
                          </motion.div>
                          <motion.div variants={itemUp} className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2.5 mt-1">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Total ΔV Budget (Burn 1 + Burn 2)</span>
                              <span className="text-purple-300 font-bold text-lg font-mono">{maneuverDetails.totalDV} m/s</span>
                            </div>
                            <div className="h-px bg-purple-500/10" />
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 text-xs">Return Coast (post-danger)</span>
                              <span className="text-purple-300 font-mono font-bold text-sm">~{maneuverDetails.returnCoastMin} min</span>
                            </div>
                          </motion.div>
                          {maneuverDetails.note && (
                            <motion.div variants={itemUp} className="flex gap-3 p-4 rounded-2xl border border-white/5 bg-white/1.5">
                              <span className="text-gray-600 text-xs shrink-0 mt-0.5">📝</span>
                              <p className="text-gray-500 text-xs font-sans leading-relaxed italic">{maneuverDetails.note}</p>
                            </motion.div>
                          )}
                        </Stagger>
                      ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-center justify-center h-40 rounded-2xl border border-white/5">
                          <p className="text-gray-600 text-sm italic">{maneuver?.note ?? "No maneuver data available."}</p>
                        </motion.div>
                      )}
                    </div>
                  </Reveal>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}