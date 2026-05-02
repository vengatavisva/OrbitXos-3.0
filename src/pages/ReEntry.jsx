import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Link } from "react-router-dom";
import { FiMenu, FiX, FiHome, FiInfo, FiActivity, FiChevronsDown } from "react-icons/fi";
import { SiTensorflow } from "react-icons/si";
import { Radar, AlertTriangle } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import StarfieldBackground from "../components/StarfieldBackground";
import Navbar from "../components/Navbar";

// ── GSAP lazy loader (CDN — no npm install required) ──────────────────────────
let _gsapInstance = null;
function loadGSAP() {
  return new Promise(resolve => {
    if (_gsapInstance)  return resolve(_gsapInstance);
    if (window.gsap)    { _gsapInstance = window.gsap; return resolve(_gsapInstance); }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    s.onload = () => { _gsapInstance = window.gsap; resolve(_gsapInstance); };
    document.head.appendChild(s);
  });
}

// ── Soft color palette ─────────────────────────────────────────────────────────
const P = {
  bgPanel:   "rgba(0,0,0,0.20)",
  bgCard:    "rgba(255,255,255,0.04)",
  bgCardHov: "rgba(255,255,255,0.07)",
  border:    "rgba(255,255,255,0.10)",
  text:      "#ffffff",
  textSub:   "#ffffff",
  textMuted: "#3d5068",
  sky:       "#ffffff",
  amber:     "#c9a45a",
  coral:     "#c96a5a",
  sage:      "#6aad8a",
  lavender:  "#ffffff",
  warn:      "#c98a5a",
};

// ── Constants ──────────────────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;
const MU              = 3.986004418e5;
const EARTH_R         = 5.0;
const ENTRY_ALT_KM    = 80;
function kmToU(km) { return (km / EARTH_RADIUS_KM) * EARTH_R; }

const SATELLITES = {
  LEO: {
    label:"Low Earth Orbit",    altitudeKm:400,   color:P.sky,
    mass:500,  dragCoeff:2.2, area:4,  icon:"🛰️",
    description:"Fast decay · intense heating · short re-entry",
  },
  MEO: {
    label:"Medium Earth Orbit", altitudeKm:8000,  color:P.amber,
    mass:1200, dragCoeff:2.2, area:6,  icon:"📡",
    description:"Extended coast · multi-day descent",
  },
  GEO: {
    label:"Geostationary Orbit",altitudeKm:35786, color:P.lavender,
    mass:3000, dragCoeff:2.2, area:12, icon:"🌐",
    description:"Weeks-long descent · graveyard orbit",
  },
};

const ATM_LAYERS = [
  { name:"Exosphere",    minKm:700,  maxKm:10000, col:"#8898cc" },
  { name:"Thermosphere", minKm:80,   maxKm:700,   col:"#7aaccc" },
  { name:"Mesosphere",   minKm:50,   maxKm:80,    col:"#7ac4aa" },
  { name:"Stratosphere", minKm:12,   maxKm:50,    col:"#8ec484" },
  { name:"Troposphere",  minKm:0,    maxKm:12,    col:"#a8c894" },
];

const SPEEDS = [1, 5, 10, 15];

function getAtmLayer(altKm) {
  return ATM_LAYERS.find(l => altKm >= l.minKm && altKm <= l.maxKm) || ATM_LAYERS[0];
}
function atmDensity(altKm) {
  if (altKm > 1000) return 1e-13;
  if (altKm > 700)  return 1e-12 * Math.exp(-(altKm - 700) / 100);
  if (altKm > 400)  return 1e-9  * Math.exp(-(altKm - 400) / 80);
  if (altKm > 200)  return 5e-9  * Math.exp(-(altKm - 200) / 50);
  if (altKm > 100)  return 5e-7  * Math.exp(-(altKm - 100) / 30);
  if (altKm > 80)   return 1e-5  * Math.exp(-(altKm - 80)  / 6);
  if (altKm > 50)   return 1e-3  * Math.exp(-(altKm - 50)  / 7);
  if (altKm > 12)   return 0.1   * Math.exp(-(altKm - 12)  / 8);
  return 1.225 * Math.exp(-altKm / 7.4);
}
function orbVel(altKm) { return Math.sqrt(MU / (EARTH_RADIUS_KM + altKm)) * 1000; }
function physStep(state, cfg, dt) {
  const { altKm, velocity, fpa } = state;
  const r   = (EARTH_RADIUS_KM + altKm) * 1000;
  const rho = atmDensity(altKm);
  const { mass, dragCoeff, area } = cfg;
  const drag    = 0.5 * rho * dragCoeff * area * velocity * velocity;
  const dragAcc = drag / mass;
  const gravAcc = (MU * 1e9) / (r * r);
  const vDot   = -dragAcc - gravAcc * Math.sin(fpa);
  const fpaDot = (gravAcc / velocity - velocity / r) * Math.cos(fpa);
  const newVel = Math.max(velocity + vDot * dt, 50);
  const newFpa = Math.max(fpa + fpaDot * dt, -Math.PI / 2);
  const vertV  = newVel * Math.sin(-newFpa);
  const newAlt = altKm - (vertV * dt) / 1000;
  const heatFlux = rho > 0 ? 1.7e-4 * Math.pow(rho, 0.5) * Math.pow(velocity, 3) : 0;
  return {
    altKm: newAlt, velocity: newVel, fpa: newFpa,
    dragForce: drag, heatFlux,
    dynamicPressure: 0.5 * rho * velocity * velocity,
    gForce: dragAcc / 9.81,
    tpsStress: heatFlux / 1e6,
    entryAngleDeg: (newFpa * 180) / Math.PI,
  };
}

// ── Satellite 3-D model ────────────────────────────────────────────────────────
function makeSatModel(color) {
  const g       = new THREE.Group();
  const col     = new THREE.Color(color);
  const bodyMat = new THREE.MeshStandardMaterial({
    color:col, emissive:col, emissiveIntensity:0.38, metalness:0.7, roughness:0.3,
  });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.09), bodyMat));
  const panelMat = new THREE.MeshStandardMaterial({
    color:0x2244aa, emissive:0x111833, emissiveIntensity:0.3, metalness:0.5, roughness:0.4,
  });
  [-1, 1].forEach(side => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.005), panelMat);
    panel.position.x = side * 0.20;
    g.add(panel);
    const strutMat = new THREE.MeshBasicMaterial({ color:0x334466 });
    for (let j = -1; j <= 1; j++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.003, 0.006), strutMat);
      s.position.set(side * 0.20, j * 0.022, 0);
      g.add(s);
    }
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.08, 6),
    new THREE.MeshBasicMaterial({ color:0x8899aa })
  );
  rod.position.y = 0.065;
  g.add(rod);
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.045, 10, 1, true),
    new THREE.MeshBasicMaterial({ color:0xaabbc0, side:THREE.DoubleSide, wireframe:true })
  );
  dish.position.y = 0.10;
  g.add(dish);
  return g;
}

// ── Enhanced Debris Field ──────────────────────────────────────────────────────
function spawnDebris(scene, altKm) {
  const arr = [];
  const debColors = [
    0x8899aa, 0xaab0b8, 0x7a8898, 0x99887a, 0xb09880,
    0x889aaa, 0x708090, 0x9a9090, 0x807060, 0xaaa090,
    0x687888, 0x908880, 0x788898, 0x9a8878, 0x7890a0,
    0x6a7a88, 0x8a8070, 0xb0a898, 0x9a8860, 0x605848,
  ];
  for (let i = 0; i < 90; i++) {
    const spread = Math.max(altKm * 0.7, 800);
    const off    = (Math.random() - 0.5) * spread;
    const dAlt   = Math.max(altKm * 0.65, altKm + off);
    const r      = EARTH_R + kmToU(dAlt);
    const ang    = Math.random() * Math.PI * 2;
    const incl   = (Math.random() - 0.5) * 1.4;
    const spd    = 0.0005 + Math.random() * 0.003;
    const sz     = 0.010 + Math.random() * 0.060;
    const col    = debColors[Math.floor(Math.random() * debColors.length)];
    const geoType = Math.random();
    let geo;
    if      (geoType < 0.22) geo = new THREE.OctahedronGeometry(sz, 0);
    else if (geoType < 0.44) geo = new THREE.TetrahedronGeometry(sz, 0);
    else if (geoType < 0.60) geo = new THREE.BoxGeometry(sz, sz * 0.55, sz * 0.35);
    else if (geoType < 0.75) geo = new THREE.IcosahedronGeometry(sz, 0);
    else if (geoType < 0.87) geo = new THREE.DodecahedronGeometry(sz * 0.8, 0);
    else                     geo = new THREE.ConeGeometry(sz * 0.6, sz * 1.4, 5, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, metalness: 0.65, roughness: 0.4 }));
    scene.add(mesh);
    arr.push({ mesh, r, ang, incl, spd,
      rotX: (Math.random()-0.5)*0.07, rotY: (Math.random()-0.5)*0.07, rotZ: (Math.random()-0.5)*0.05 });
  }
  for (let i = 0; i < 80; i++) {
    const dAlt = Math.max(50, altKm + (Math.random() - 0.5) * altKm * 0.9);
    const r    = EARTH_R + kmToU(dAlt);
    const ang  = Math.random() * Math.PI * 2;
    const incl = (Math.random() - 0.5) * 1.8;
    const spd  = 0.001 + Math.random() * 0.005;
    const sz   = 0.004 + Math.random() * 0.010;
    const col  = debColors[Math.floor(Math.random() * debColors.length)];
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(sz, 0), new THREE.MeshBasicMaterial({ color: col }));
    scene.add(mesh);
    arr.push({ mesh, r, ang, incl, spd, rotX: 0.09, rotY: 0.06, rotZ: 0.08 });
  }
  for (let i = 0; i < 12; i++) {
    const dAlt = altKm + (Math.random() - 0.5) * altKm * 0.35;
    const r    = EARTH_R + kmToU(Math.max(dAlt, 120));
    const ang  = Math.random() * Math.PI * 2;
    const incl = (Math.random() - 0.5) * 0.7;
    const spd  = 0.0003 + Math.random() * 0.0012;
    const len  = 0.25 + Math.random() * 0.30;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035 + Math.random()*0.025, 0.05 + Math.random()*0.02, len, 8),
      new THREE.MeshStandardMaterial({
        color: [0x778899, 0x6a7a8a, 0x8898a8, 0x5a6a78][Math.floor(Math.random()*4)],
        metalness: 0.85, roughness: 0.22, emissive: 0x0e1620, emissiveIntensity: 0.2,
      })
    );
    scene.add(mesh);
    arr.push({ mesh, r, ang, incl, spd, rotX: 0.008, rotY: 0.012, rotZ: 0.006 });
  }
  for (let i = 0; i < 20; i++) {
    const dAlt = altKm + (Math.random() - 0.5) * altKm * 0.5;
    const r    = EARTH_R + kmToU(Math.max(dAlt, 80));
    const ang  = Math.random() * Math.PI * 2;
    const incl = (Math.random() - 0.5) * 1.0;
    const spd  = 0.0006 + Math.random() * 0.002;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 + Math.random()*0.15, 0.05 + Math.random()*0.10, 0.004),
      new THREE.MeshStandardMaterial({
        color: [0x2a3d6a, 0x334a7a, 0x243360, 0x1e2e58][Math.floor(Math.random()*4)],
        emissive: 0x0a1428, emissiveIntensity: 0.3, metalness: 0.45, roughness: 0.5,
      })
    );
    scene.add(mesh);
    arr.push({ mesh, r, ang, incl, spd,
      rotX: (Math.random()-0.5)*0.04, rotY: (Math.random()-0.5)*0.04, rotZ: (Math.random()-0.5)*0.03 });
  }
  const satArr = [];
  const derelictColors = ["#7aaac0","#b09060","#c08070","#9090b0","#808898","#7aa898","#c08888","#a89858","#8888c0","#b08868"];
  for (let i = 0; i < 10; i++) {
    const r2    = EARTH_R + kmToU(Math.max(100, altKm + (Math.random()-0.5)*altKm*0.45));
    const ang2  = Math.random() * Math.PI * 2;
    const spd2  = 0.0005 + Math.random() * 0.0016;
    const incl2 = (Math.random()-0.5) * 0.85;
    const sm    = makeSatModel(derelictColors[i % derelictColors.length]);
    sm.scale.setScalar(0.4 + Math.random() * 0.65);
    scene.add(sm);
    satArr.push({ mesh: sm, r: r2, ang: ang2, spd: spd2, incl: incl2 });
  }
  return { arr, satArr };
}

// ── Plasma sheath ──────────────────────────────────────────────────────────────
function createPlasmaSheath(scene) {
  const group = new THREE.Group();
  const shockMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.55, 16, 1, true),
    new THREE.MeshBasicMaterial({ color:0xd08050, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  shockMesh.rotation.x = Math.PI; shockMesh.position.z = 0.18;
  group.add(shockMesh);
  const innerShock = new THREE.Mesh(
    new THREE.ConeGeometry(0.10, 0.35, 12, 1, true),
    new THREE.MeshBasicMaterial({ color:0xe0a870, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  innerShock.rotation.x = Math.PI; innerShock.position.z = 0.14;
  group.add(innerShock);
  scene.add(group);
  return { group, shockMesh, innerShock };
}

// ── Telemetry row ──────────────────────────────────────────────────────────────
function TRow({ label, value, unit, color = P.sky, hot = false }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 10px", marginBottom:3, borderRadius:6,
      background: hot ? "rgba(150,90,50,0.07)" : "transparent",
      borderLeft:`3px solid ${hot ? color : "transparent"}`,
      transition:"border-color 0.3s, background 0.3s",
    }}>
      <span style={{ color:P.textSub, fontSize:10, fontFamily:"monospace", letterSpacing:1 }}>{label}</span>
      <span style={{ color, fontSize:12, fontWeight:600, fontFamily:"monospace" }}>
        {value}&thinsp;<span style={{ color:P.textMuted, fontSize:9 }}>{unit}</span>
      </span>
    </div>
  );
}

// ── Debris Counter HUD ─────────────────────────────────────────────────────────
function DebrisCounter({ count, warnings }) {
  return (
    <div style={{
      position:"absolute", bottom:14, left:14,
      padding:"10px 16px", borderRadius:10,
      background:"rgba(0,0,0,0.55)",
      border:`1px solid ${P.border}`,
      backdropFilter:"blur(14px)", minWidth:160,
    }}>
      <div style={{ fontSize:7, color:P.textMuted, letterSpacing:3, marginBottom:6 }}>TRACKED OBJECTS</div>
      <div style={{ display:"flex", gap:16, alignItems:"center" }}>
        <div>
          <div style={{ fontSize:9, color:P.textSub, letterSpacing:1 }}>DEBRIS</div>
          <div style={{ fontSize:18, color:P.amber, fontWeight:700, fontFamily:"monospace", lineHeight:1 }}>
            {count.toLocaleString()}
          </div>
        </div>
        <div style={{ width:1, height:30, background:"rgba(255,255,255,0.08)" }} />
        <div>
          <div style={{ fontSize:9, color:P.textSub, letterSpacing:1 }}>WARNINGS</div>
          <div style={{ fontSize:18, color: warnings > 0 ? P.coral : P.textMuted,
                        fontWeight:700, fontFamily:"monospace", lineHeight:1, transition:"color 0.3s" }}>
            {warnings}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Entry Stop Banner ──────────────────────────────────────────────────────────
function EntryStopBanner({ state, elapsed }) {
  const fmt = s => {
    const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600),
          m = Math.floor((s%3600)/60), sc = Math.floor(s%60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sc}s`;
    return `${m}m ${sc}s`;
  };
  const gf = state?.gForce ?? 0;
  let gMsg = "", gColor = P.coral;
  if (gf > 30) {
    gMsg = `At ${gf.toFixed(1)}g, structural disintegration is instantaneous — no spacecraft survives this force.`;
    gColor = "#b05040";
  } else if (gf > 15) {
    gMsg = `At ${gf.toFixed(1)}g, the airframe collapses within milliseconds. Total breakup certain.`;
    gColor = "#b86050";
  } else if (gf > 8) {
    gMsg = `At ${gf.toFixed(1)}g, the satellite's structure is critically overstressed. Re-entry survivability is near zero.`;
    gColor = P.coral;
  } else if (gf > 4) {
    gMsg = `At ${gf.toFixed(1)}g, thermal protection systems are overwhelmed. Partial burnup expected.`;
    gColor = P.warn;
  } else if (gf > 1) {
    gMsg = `At ${gf.toFixed(1)}g, drag deceleration is significant. Controlled descent may be feasible.`;
    gColor = P.amber;
  } else {
    gMsg = `At ${gf.toFixed(1)}g, atmospheric drag is building. Entry corridor successfully reached.`;
    gColor = P.sage;
  }
  return (
    <div style={{
      position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(16px)", zIndex:20,
    }}>
      <div style={{
        maxWidth:520, width:"90%", padding:"40px 44px", borderRadius:18,
        background:"rgba(255,255,255,0.05)", backdropFilter:"blur(20px)",
        border:`1px solid ${P.border}`,
        boxShadow:"0 8px 60px rgba(0,0,0,0.5)", textAlign:"center",
      }}>
        <div style={{ fontSize:46, marginBottom:14 }}>🌍</div>
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:5, color:P.coral,
                      textTransform:"uppercase", marginBottom:6, fontFamily:"monospace" }}>
          ATMOSPHERIC BOUNDARY REACHED
        </div>
        <div style={{ fontSize:10, color:P.textMuted, letterSpacing:3, marginBottom:26,
                      fontFamily:"monospace", textTransform:"uppercase" }}>
          Kármán Line · 80 km · Entry Interface
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:22 }}>
          {[
            { label:"ALTITUDE", value:`${Math.max(state?.altKm ?? 80, 80).toFixed(1)} km`, color:P.sky },
            { label:"VELOCITY", value:`${((state?.velocity ?? 0)/1000).toFixed(2)} km/s`,  color:P.amber },
            { label:"G-FORCE",  value:`${(state?.gForce ?? 0).toFixed(2)} g`,              color:gColor },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding:"10px 8px", borderRadius:10,
              background:"rgba(255,255,255,0.04)", border:`1px solid ${P.border}`,
            }}>
              <div style={{ fontSize:7, color:P.textMuted, letterSpacing:3, marginBottom:5, fontFamily:"monospace" }}>
                {label}
              </div>
              <div style={{ fontSize:13, color, fontWeight:700, fontFamily:"monospace" }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:"14px 18px", borderRadius:12, marginBottom:14,
                      background:"rgba(140,70,50,0.07)", border:`1px solid ${gColor}22` }}>
          <div style={{ fontSize:8, color:P.textMuted, letterSpacing:3, marginBottom:8, fontFamily:"monospace" }}>
            G-FORCE ANALYSIS
          </div>
          <div style={{ fontSize:12, color:gColor, lineHeight:1.75, fontFamily:"monospace" }}>{gMsg}</div>
        </div>
        <div style={{ padding:"12px 18px", borderRadius:12, marginBottom:22,
                      background:"rgba(140,100,50,0.05)", border:"1px solid rgba(170,140,90,0.14)" }}>
          <div style={{ fontSize:8, color:P.textMuted, letterSpacing:3, marginBottom:8, fontFamily:"monospace" }}>
            THERMAL STATUS AT ENTRY
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
            <div>
              <div style={{ fontSize:8, color:P.textMuted, fontFamily:"monospace" }}>HEAT FLUX</div>
              <div style={{ fontSize:12, color:P.warn, fontWeight:700, fontFamily:"monospace" }}>
                {state?.heatFlux > 1e6 ? `${(state.heatFlux/1e6).toFixed(2)} MW/m²` : `${(state?.heatFlux ?? 0).toFixed(1)} W/m²`}
              </div>
            </div>
            <div>
              <div style={{ fontSize:8, color:P.textMuted, fontFamily:"monospace" }}>TPS STRESS</div>
              <div style={{ fontSize:12, color:P.amber, fontWeight:700, fontFamily:"monospace" }}>
                {(state?.tpsStress ?? 0).toFixed(4)} norm
              </div>
            </div>
            <div>
              <div style={{ fontSize:8, color:P.textMuted, fontFamily:"monospace" }}>TOTAL TIME</div>
              <div style={{ fontSize:12, color:P.sky, fontWeight:700, fontFamily:"monospace" }}>
                {fmt(elapsed)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize:10, color:P.textMuted, lineHeight:1.8, fontFamily:"monospace" }}>
          Simulation halted at atmospheric entry interface.<br />
          Beyond this point, plasma sheath, peak heating, and maximum deceleration define survival.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ReEntry() {
  const [selSat,      setSelSat]      = useState(null);
  const [simState,    setSimState]    = useState(null);
  const [running,     setRunning]     = useState(false);
  const [speed,       setSpeed]       = useState(5);
  const [done,        setDone]        = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const [curLayer,    setCurLayer]    = useState(null);
  const [debWarn,     setDebWarn]     = useState(null);
  const [warnCount,   setWarnCount]   = useState(0);
  const [debrisCount, setDebrisCount] = useState(0);

  const mountRef = useRef(null);
  const simRef   = useRef(null);
  const animRef  = useRef(null);
  const threeRef = useRef({});
  const warnTmr  = useRef(null);

  // ── GSAP refs — only used on the selection screen ──────────────────────────
  const refEyebrow = useRef(null);   // "◈ ORBITAL MECHANICS ENGINE v4.2 ◈"
  const refTitle   = useRef(null);   // "SELECT ORBITAL CLASS"
  const refSub     = useRef(null);   // subtitle paragraph
  const refCards   = useRef(null);   // flex wrapper that holds the three sat cards
  const refTicker  = useRef(null);   // bottom debris-environment bar

  // ── Fire the GSAP entrance every time the selection screen appears ─────────
  useEffect(() => {
    if (selSat) return; // simulation active — skip

    loadGSAP().then(g => {
      if (!g) return;

      // Grab the three individual card elements
      const cards = refCards.current
        ? Array.from(refCards.current.querySelectorAll(".re-sat-card"))
        : [];

      // ── Force-set initial hidden states BEFORE animating ──
      g.set(refEyebrow.current, { opacity: 0, y: -28, letterSpacing: "1em" });
      g.set(refTitle.current,   { opacity: 0, y: 52,  skewX: -10, scale: 0.9 });
      g.set(refSub.current,     { opacity: 0, y: 20 });
      g.set(cards,              {
        opacity: 0, y: 64, scale: 0.86, rotationX: 22,
        transformOrigin: "center bottom", transformPerspective: 800,
      });
      g.set(refTicker.current,  { opacity: 0, y: 18 });

      // ── Build the staggered timeline ──
      const tl = g.timeline({ defaults: { ease: "power3.out" } });

      // 1. Eyebrow label: letter-spacing collapses inward from wide to normal
      tl.to(refEyebrow.current, {
        opacity: 1, y: 0, letterSpacing: "0.4em",
        duration: 0.9, ease: "expo.out",
      }, 0.05);

      // 2. Main title crashes down with skew snap + back overshoot
      tl.to(refTitle.current, {
        opacity: 1, y: 0, skewX: 0, scale: 1,
        duration: 0.75, ease: "back.out(1.7)",
      }, 0.3);

      // 3. Subtitle drifts up
      tl.to(refSub.current, {
        opacity: 1, y: 0,
        duration: 0.6,
      }, 0.56);

      // 4. Cards flip up one-by-one with 3-D tilt & back easing
      tl.to(cards, {
        opacity: 1, y: 0, scale: 1, rotationX: 0,
        duration: 0.72, ease: "back.out(1.4)",
        stagger: 0.15,
      }, 0.72);

      // 5. Footer ticker slides up last
      tl.to(refTicker.current, {
        opacity: 1, y: 0,
        duration: 0.55,
      }, 1.26);
    });
  }, [selSat]); // re-fires on "← BACK" so animation replays fresh

  // ── Three.js scene init (identical to original) ────────────────────────────
  const initScene = useCallback((cfg, key) => {
    const container = mountRef.current;
    if (!container) return;
    container.innerHTML = "";
    const scene = new THREE.Scene();
    scene.background = null;
    const W = container.clientWidth, H = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.01, 3000);
    const startR = EARTH_R + kmToU(cfg.altitudeKm);
    camera.position.set(startR * 0.6, startR * 0.3, startR * 0.9);
    const renderer = new THREE.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.minDistance = EARTH_R + 0.3; controls.maxDistance = startR * 4;
    scene.add(new THREE.AmbientLight(0x1a2a3a, 2.8));
    const sun = new THREE.DirectionalLight(0xf0e8d8, 3.0);
    sun.position.set(20, 10, 12); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x1a2a44, 1.0);
    rim.position.set(-15, -5, -10); scene.add(rim);
    scene.add(new THREE.PointLight(0x3355aa, 0.8, 40));
    const loader = new THREE.TextureLoader();
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 128, 128),
      new THREE.MeshStandardMaterial({
        map: loader.load("https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg"),
        roughness:0.85, metalness:0.0,
      })
    );
    scene.add(earthMesh);
    const cityLights = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 0.001, 64, 64),
      new THREE.MeshBasicMaterial({ color:0xe8d890, transparent:true, opacity:0.05 })
    );
    scene.add(cityLights);
    [
      { r:kmToU(10000), col:0x04082a, op:0.28 },{ r:kmToU(3000), col:0x060e3a, op:0.24 },
      { r:kmToU(1200),  col:0x082060, op:0.22 },{ r:kmToU(700),  col:0x0a2e80, op:0.20 },
      { r:kmToU(400),   col:0x0e3ea0, op:0.18 },{ r:kmToU(200),  col:0x1050b8, op:0.22 },
      { r:kmToU(100),   col:0x1468c8, op:0.26 },{ r:kmToU(80),   col:0x1880c0, op:0.24 },
      { r:kmToU(50),    col:0x30a0b0, op:0.22 },{ r:kmToU(20),   col:0x50b898, op:0.20 },
      { r:kmToU(8),     col:0x70cc88, op:0.24 },{ r:kmToU(1),    col:0x98ddb0, op:0.16 },
    ].forEach(({ r, col, op }) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R + r, 64, 64),
        new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:op, side:THREE.BackSide, depthWrite:false })
      ));
    });
    [{ km:700, col:0x2a50aa },{ km:80, col:0x50a888 },{ km:50, col:0x60a870 },{ km:12, col:0x80a860 }]
      .forEach(({ km, col }) => {
        const rr = EARTH_R + kmToU(km), pts = [];
        for (let i = 0; i <= 256; i++) {
          const a = (i/256)*Math.PI*2;
          pts.push(new THREE.Vector3(Math.cos(a)*rr, 0, Math.sin(a)*rr));
        }
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.20 })));
      });
    const entryR2 = EARTH_R + kmToU(ENTRY_ALT_KM), entryPts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i/256)*Math.PI*2;
      entryPts.push(new THREE.Vector3(Math.cos(a)*entryR2, 0, Math.sin(a)*entryR2));
    }
    const entryRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(entryPts),
      new THREE.LineBasicMaterial({ color:0xc08050, transparent:true, opacity:0.48 }));
    scene.add(entryRing);
    const satGrp = makeSatModel(cfg.color);
    const scale  = key === "GEO" ? 3 : key === "MEO" ? 1.8 : 1;
    satGrp.scale.setScalar(scale); scene.add(satGrp);
    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshBasicMaterial({ color:new THREE.Color(cfg.color), transparent:true, opacity:0.07 })
    );
    scene.add(glowMesh);
    const plasma = createPlasmaSheath(scene);
    const TM = 2000;
    const tPos = new Float32Array(TM*3), tCol = new Float32Array(TM*3);
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
    tGeo.setAttribute("color",    new THREE.BufferAttribute(tCol, 3));
    tGeo.setDrawRange(0, 0);
    const tLine = new THREE.Line(tGeo, new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.88 }));
    scene.add(tLine);
    const HP = 380, hPos = new Float32Array(HP*3), hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute("position", new THREE.BufferAttribute(hPos, 3));
    const hPts = new THREE.Points(hGeo, new THREE.PointsMaterial({ color:0xd07040, size:0.065, transparent:true, opacity:0, sizeAttenuation:true }));
    scene.add(hPts);
    const HP2 = 120, hPos2 = new Float32Array(HP2*3), hGeo2 = new THREE.BufferGeometry();
    hGeo2.setAttribute("position", new THREE.BufferAttribute(hPos2, 3));
    const hPts2 = new THREE.Points(hGeo2, new THREE.PointsMaterial({ color:0xf0e0c8, size:0.025, transparent:true, opacity:0, sizeAttenuation:true }));
    scene.add(hPts2);
    const orbitPts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i/256)*Math.PI*2;
      orbitPts.push(new THREE.Vector3(Math.cos(a)*startR, 0, Math.sin(a)*startR));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color:new THREE.Color(cfg.color), transparent:true, opacity:0.12 })));
    const { arr:debArr, satArr:otherSats } = spawnDebris(scene, cfg.altitudeKm);
    setDebrisCount(debArr.length);
    const wLines = debArr.slice(0, 12).map(d => {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const wl = new THREE.Line(wg, new THREE.LineBasicMaterial({ color:0xc07040, transparent:true, opacity:0 }));
      scene.add(wl);
      return { line:wl, deb:d };
    });
    threeRef.current = {
      scene, camera, renderer, controls, earthMesh, cityLights, entryRing,
      satGrp, glowMesh, plasma, tLine, tPos, tCol, tGeo, TM,
      hPts, hPos, hGeo, HP, hPts2, hPos2, hGeo2, HP2, debArr, otherSats, wLines,
    };
    let tHead = 0, tCount = 0, satAngle = 0;
    function animate() {
      animRef.current = requestAnimationFrame(animate);
      earthMesh.rotation.y += 0.00025;
      cityLights.rotation.y += 0.00025;
      const st2 = simRef.current;
      if (st2 && st2.altKm < 250) {
        entryRing.material.opacity = 0.26 + 0.26 * Math.sin(Date.now() * 0.006);
      }
      debArr.forEach(d => {
        d.ang += d.spd;
        d.mesh.position.set(Math.cos(d.ang)*d.r, Math.sin(d.incl)*d.r*0.28, Math.sin(d.ang)*d.r);
        d.mesh.rotation.x += d.rotX ?? 0.025;
        d.mesh.rotation.y += d.rotY ?? 0.018;
        d.mesh.rotation.z += d.rotZ ?? 0.012;
      });
      otherSats.forEach(s => {
        s.ang += s.spd;
        s.mesh.position.set(Math.cos(s.ang)*s.r, Math.sin(s.incl)*s.r*0.22, Math.sin(s.ang)*s.r);
        s.mesh.rotation.y += 0.005;
      });
      const st = simRef.current;
      if (!st) { controls.update(); renderer.render(scene, camera); return; }
      const safeAlt = Math.max(st.altKm, 0);
      const r3 = EARTH_R + kmToU(safeAlt);
      const sx = Math.cos(satAngle) * r3;
      const sz = Math.sin(satAngle) * r3;
      const sy = 0;
      satAngle += 0.006;
      satGrp.position.set(sx, sy, sz);
      satGrp.rotation.y = satAngle + Math.PI * 0.5;
      glowMesh.position.set(sx, sy, sz);
      const hi = Math.min(st.heatFlux / 8e6, 1);
      glowMesh.material.opacity = 0.04 + hi * 0.55;
      glowMesh.material.color.setRGB(0.82 + hi*0.18, 0.62 - hi*0.32, 0.32 - hi*0.32);
      glowMesh.scale.setScalar(1 + hi * 1.5);
      plasma.group.position.set(sx, sy, sz);
      plasma.group.rotation.y = satAngle + Math.PI * 0.5;
      const plasmaI = Math.max(0, (hi - 0.15) / 0.85);
      plasma.shockMesh.material.opacity  = plasmaI * 0.38;
      plasma.innerShock.material.opacity = plasmaI * 0.48;
      plasma.shockMesh.material.color.setRGB(0.80, 0.46+plasmaI*0.1, 0.20);
      plasma.innerShock.material.color.setRGB(0.88, 0.62+plasmaI*0.12, 0.38);
      satGrp.traverse(c => {
        if (c.isMesh && c.material.emissive) {
          c.material.emissiveIntensity = 0.32 + hi * 1.6;
          if (hi > 0.2) c.material.emissive.setRGB(0.82, 0.48 - hi*0.28, 0.10);
        }
      });
      const ib = tHead * 3;
      tPos[ib] = sx; tPos[ib+1] = sy; tPos[ib+2] = sz;
      const tc = Math.min(hi * 2.2, 1);
      tCol[ib]   = 0.50 + tc * 0.44; tCol[ib+1] = 0.65 - tc * 0.22; tCol[ib+2] = 0.82 - tc * 0.70;
      tHead = (tHead + 1) % TM; tCount = Math.min(tCount + 1, TM);
      tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true;
      tGeo.setDrawRange(0, tCount);
      const sp = hi * 1.1;
      for (let i = 0; i < HP; i++) {
        hPos[i*3]   = sx + (Math.random()-0.5)*sp;
        hPos[i*3+1] = sy + (Math.random()-0.5)*sp*0.4;
        hPos[i*3+2] = sz + (Math.random()-0.5)*sp;
      }
      hGeo.attributes.position.needsUpdate = true;
      hPts.material.opacity = hi * 0.78;
      hPts.material.color.setRGB(0.80, 0.42 - hi*0.18, 0.16);
      hPts.material.size    = 0.035 + hi * 0.14;
      const sp2 = hi * 0.35;
      for (let i = 0; i < HP2; i++) {
        hPos2[i*3]   = sx + (Math.random()-0.5)*sp2;
        hPos2[i*3+1] = sy + (Math.random()-0.5)*sp2*0.3;
        hPos2[i*3+2] = sz + (Math.random()-0.5)*sp2;
      }
      hGeo2.attributes.position.needsUpdate = true;
      hPts2.material.opacity = hi * 0.60;
      const warnDist = kmToU(st.altKm > 2000 ? 160 : st.altKm > 300 ? 90 : 50);
      wLines.forEach(({ line, deb }) => {
        const dist = new THREE.Vector3(sx, sy, sz).distanceTo(deb.mesh.position);
        const pa   = line.geometry.attributes.position;
        if (dist < warnDist) {
          pa.setXYZ(0, sx, sy, sz);
          pa.setXYZ(1, deb.mesh.position.x, deb.mesh.position.y, deb.mesh.position.z);
          pa.needsUpdate = true;
          line.material.opacity = Math.min(0.70, ((warnDist-dist)/warnDist)*1.4);
          line.material.color.set(dist < warnDist*0.4 ? 0xb85840 : 0xb89050);
        } else { line.material.opacity = 0; }
      });
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);
    threeRef.current.cleanup = () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const startSim = useCallback((key) => {
    const cfg = SATELLITES[key];
    if (threeRef.current.cleanup) threeRef.current.cleanup();
    setSelSat(key); setDone(false); setElapsed(0); setRunning(false);
    setDebWarn(null); setWarnCount(0);
    const init = {
      altKm: cfg.altitudeKm, velocity: orbVel(cfg.altitudeKm),
      fpa: -0.005, dragForce:0, heatFlux:0, dynamicPressure:0,
      gForce:0, tpsStress:0, entryAngleDeg:-0.3,
    };
    simRef.current = init;
    setSimState(init);
    setCurLayer(getAtmLayer(cfg.altitudeKm));
    setTimeout(() => initScene(cfg, key), 120);
  }, [initScene]);

  useEffect(() => {
    if (!running || !selSat) return;
    const cfg = SATELLITES[selSat];
    const interval = setInterval(() => {
      let st = simRef.current;
      if (!st) return;
      for (let i = 0; i < speed; i++) {
        if (st.altKm <= ENTRY_ALT_KM) {
          st = { ...st, altKm: ENTRY_ALT_KM };
          simRef.current = st; setSimState({...st});
          setRunning(false); setDone(true); clearInterval(interval); return;
        }
        st = physStep(st, cfg, 1);
      }
      simRef.current = st; setSimState({...st});
      setElapsed(p => p + speed);
      setCurLayer(getAtmLayer(st.altKm));
      const warnChance = st.altKm < 500 ? 0.012 : st.altKm < 2000 ? 0.007 : 0.004;
      if (Math.random() < warnChance) {
        const km = (8 + Math.random()*80).toFixed(1);
        const msgs = [
          `△ DEBRIS PROXIMITY · ${km} km`, `△ CLOSE APPROACH · ${km} km`,
          `△ COLLISION RISK · ${km} km`,   `△ DEBRIS FIELD · ${km} km`,
          `△ CONJUNCTION ALERT · ${km} km`,
        ];
        setDebWarn(msgs[Math.floor(Math.random()*msgs.length)]);
        setWarnCount(c => c + 1);
        clearTimeout(warnTmr.current);
        warnTmr.current = setTimeout(() => setDebWarn(null), 3500);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [running, selSat, speed]);

  useEffect(() => () => { if (threeRef.current.cleanup) threeRef.current.cleanup(); }, []);

  const fmt = s => {
    const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600),
          m = Math.floor((s%3600)/60), sc = Math.floor(s%60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sc}s`;
    return `${m}m ${sc}s`;
  };
  const toEntry = (st) => {
    if (!st || st.altKm <= ENTRY_ALT_KM) return "AT BOUNDARY";
    const vv = Math.max(st.velocity * Math.sin(-st.fpa), 0.1);
    return fmt(Math.round(((st.altKm - ENTRY_ALT_KM) * 1000) / vv));
  };

  const sat = selSat ? SATELLITES[selSat] : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen text-gray-200 overflow-hidden"
         style={{ fontFamily:"'Courier New',monospace" }}>
      {/* ① Same StarfieldBackground as Dashboard */}
      <StarfieldBackground />

      {/* ② z-10 content layer — same as Dashboard */}
      <div className="relative z-10 min-h-screen">
        {/* Navbar */}
        <Navbar />

        {/* Sub-header */}
        <div style={{ marginTop:72, padding:"10px 24px",
                      borderBottom:`1px solid ${P.border}`,
                      background:P.bgPanel, backdropFilter:"blur(20px)",
                      display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
                        background: sat ? sat.color : P.sky, opacity:0.85,
                        animation: running ? "blink 0.85s infinite" : "none" }} />
          <h1 style={{ fontSize:13, fontWeight:700, letterSpacing:5, color:P.text,
                       textTransform:"uppercase", margin:0 }}>
            ORBITAL RE-ENTRY SIMULATOR
          </h1>
          {sat && (
            <span style={{ marginLeft:"auto", fontSize:10, color:sat.color,
                           letterSpacing:2, padding:"3px 10px",
                           border:`1px solid ${sat.color}30`, borderRadius:4 }}>
              {sat.label}
            </span>
          )}
        </div>

        {/* ── SELECTION SCREEN ─────────────────────────────────────────────
            Identical to original except:
              • 4 GSAP ref= attributes added (refEyebrow, refTitle, refSub, refTicker)
              • refCards ref= on the flex wrapper
              • className="re-sat-card" added to each card div
              • opacity:0 initial style on GSAP targets (GSAP animates them in)
            Everything else — layout, styles, hover handlers — is unchanged.
        ───────────────────────────────────────────────────────────────── */}
        {!selSat && (
          <div style={{ flex:1, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", padding:40 }}>
            <div style={{ textAlign:"center", marginBottom:44 }}>

              {/* GSAP target ↓ */}
              <div ref={refEyebrow}
                   style={{ fontSize:9, letterSpacing:7, color:P.textMuted,
                            textTransform:"uppercase", marginBottom:10, opacity:0 }}>
                ◈ ORBITAL MECHANICS ENGINE v4.2 ◈
              </div>

              {/* GSAP target ↓ */}
              <h2 ref={refTitle}
                  style={{ fontSize:24, fontWeight:800, letterSpacing:5, color:P.text,
                           fontFamily:"'Orbitron',monospace", marginBottom:10, margin:0, opacity:0 }}>
                SELECT ORBITAL CLASS
              </h2>

              {/* GSAP target ↓ */}
              <p ref={refSub}
                 style={{ fontSize:10, color:P.textMuted, letterSpacing:3, marginTop:10, opacity:0 }}>
                INITIATE DEORBIT · RE-ENTRY SIMULATION · DEBRIS ENVIRONMENT ACTIVE
              </p>
            </div>

            {/* GSAP cards wrapper ↓ — children carry .re-sat-card */}
            <div ref={refCards}
                 style={{ display:"flex", gap:22, flexWrap:"wrap", justifyContent:"center" }}>
              {Object.entries(SATELLITES).map(([k, s]) => (
                <div key={k}
                     className="re-sat-card"
                     onClick={() => startSim(k)}
                     style={{ cursor:"pointer", border:`1px solid ${P.border}`, borderRadius:16,
                              padding:"30px 36px", background:P.bgCard,
                              backdropFilter:"blur(16px)",
                              textAlign:"center", transition:"all 0.28s", minWidth:195,
                              opacity:0 /* GSAP reveals this */ }}
                     onMouseEnter={e => {
                       e.currentTarget.style.borderColor = s.color + "70";
                       e.currentTarget.style.boxShadow   = `0 0 28px ${s.color}18, 0 4px 24px rgba(0,0,0,0.5)`;
                       e.currentTarget.style.transform    = "translateY(-7px) scale(1.02)";
                       e.currentTarget.style.background   = P.bgCardHov;
                     }}
                     onMouseLeave={e => {
                       e.currentTarget.style.borderColor = P.border;
                       e.currentTarget.style.boxShadow   = "none";
                       e.currentTarget.style.transform    = "none";
                       e.currentTarget.style.background   = P.bgCard;
                     }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>{s.icon}</div>
                  <div style={{ color:s.color, fontSize:16, fontWeight:700, letterSpacing:3 }}>{k}</div>
                  <div style={{ color:P.textSub, fontSize:10, marginTop:4, letterSpacing:1 }}>{s.label}</div>
                  <div style={{ color:P.textMuted, fontSize:10, marginTop:12, lineHeight:1.8 }}>{s.description}</div>
                  <div style={{ marginTop:16, paddingTop:10, borderTop:`1px solid ${P.border}`,
                                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:s.color, fontSize:10 }}>ALT · {s.altitudeKm.toLocaleString()} km</span>
                    <span style={{ color:P.textMuted, fontSize:9 }}>202+ objects</span>
                  </div>
                </div>
              ))}
            </div>

            {/* GSAP target ↓ */}
            <div ref={refTicker}
                 style={{ marginTop:34, textAlign:"center", padding:"10px 22px", borderRadius:10,
                          background:"rgba(255,255,255,0.03)", border:`1px solid ${P.border}`,
                          backdropFilter:"blur(10px)", opacity:0 }}>
              <span style={{ fontSize:9, color:P.textMuted, letterSpacing:3 }}>
                DEBRIS ENVIRONMENT · 202 TRACKED OBJECTS PER ORBIT · REAL-TIME CONJUNCTION ANALYSIS
              </span>
            </div>
          </div>
        )}

        {/* ── SIMULATION — 100 % identical to original ─────────────────── */}
        {selSat && (
          <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
            {/* Controls */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 14px",
                          background:P.bgPanel, backdropFilter:"blur(20px)",
                          borderBottom:`1px solid ${P.border}`, flexWrap:"wrap" }}>
              <button onClick={() => setRunning(r => !r)} disabled={done}
                style={{ padding:"6px 16px", borderRadius:7, border:"none", cursor:"pointer",
                         background: running ? "rgba(165,65,55,0.85)" : "rgba(55,110,75,0.85)",
                         color:"#dce8d8", fontFamily:"monospace", fontWeight:700,
                         fontSize:11, letterSpacing:2,
                         opacity: done ? 0.40 : 1, transition:"all 0.2s" }}>
                {done ? "HALTED" : running ? "⏸ PAUSE" : "▶ START"}
              </button>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ color:P.textMuted, fontSize:9, letterSpacing:2 }}>SPEED</span>
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    style={{ padding:"3px 10px", borderRadius:5, border:"none", cursor:"pointer",
                             background: speed===s ? P.sky : "rgba(136,180,212,0.12)",
                             color: speed===s ? "#0a0e14" : P.sky,
                             fontFamily:"monospace", fontSize:10, fontWeight:700 }}>
                    {s}x
                  </button>
                ))}
              </div>
              {debWarn && (
                <div style={{ padding:"4px 12px", borderRadius:6,
                              border:"1px solid rgba(185,130,65,0.35)",
                              background:"rgba(170,100,45,0.12)", color:P.warn,
                              fontSize:10, fontWeight:600, letterSpacing:1,
                              animation:"fw 0.5s infinite alternate" }}>
                  {debWarn}
                </div>
              )}
              <div style={{ marginLeft:"auto", display:"flex", gap:14, alignItems:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:P.textMuted, fontSize:7, letterSpacing:2 }}>ELAPSED</div>
                  <div style={{ color:P.sky, fontSize:11, fontWeight:600 }}>{fmt(elapsed)}</div>
                </div>
                {simState && !done && (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:P.textMuted, fontSize:7, letterSpacing:2 }}>TO ENTRY</div>
                    <div style={{ color:P.amber, fontSize:10, fontWeight:600 }}>{toEntry(simState)}</div>
                  </div>
                )}
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:P.textMuted, fontSize:7, letterSpacing:2 }}>DEBRIS</div>
                  <div style={{ color:P.amber, fontSize:11, fontWeight:600 }}>{debrisCount}</div>
                </div>
                <button
                  onClick={() => {
                    setSelSat(null); setSimState(null); simRef.current = null;
                    setRunning(false); setDone(false); setWarnCount(0);
                    if (threeRef.current.cleanup) threeRef.current.cleanup();
                  }}
                  style={{ padding:"4px 10px", borderRadius:5, border:`1px solid ${P.border}`,
                           background:"transparent", color:P.textSub,
                           cursor:"pointer", fontFamily:"monospace", fontSize:10 }}>
                  ← BACK
                </button>
              </div>
            </div>

            {/* Viewport + Telemetry */}
            <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
              {/* 3-D viewport */}
              <div style={{ flex:1, position:"relative", minWidth:0 }}>
                <div ref={mountRef} style={{ width:"100%", height:"100%", minHeight:460 }} />
                {curLayer && !done && (
                  <div style={{ position:"absolute", top:14, left:14, padding:"8px 14px",
                                borderRadius:8, background:"rgba(0,0,0,0.55)",
                                border:`1px solid ${curLayer.col}22`,
                                backdropFilter:"blur(14px)" }}>
                    <div style={{ fontSize:7, color:P.textMuted, letterSpacing:3, marginBottom:2 }}>CURRENT LAYER</div>
                    <div style={{ fontSize:13, color:curLayer.col, fontWeight:700, letterSpacing:2 }}>
                      {curLayer.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize:9, color:P.textMuted, marginTop:2 }}>
                      {curLayer.minKm}–{curLayer.maxKm} km
                    </div>
                  </div>
                )}
                {!done && <DebrisCounter count={debrisCount} warnings={warnCount} />}
                {!done && (
                  <div style={{ position:"absolute", right:12, top:14, bottom:14,
                                display:"flex", flexDirection:"column",
                                justifyContent:"space-between", alignItems:"flex-end" }}>
                    {[...ATM_LAYERS].reverse().map((l, i) => (
                      <div key={i} style={{ textAlign:"right", transition:"all 0.5s",
                                            opacity: curLayer?.name===l.name ? 1 : 0.22,
                                            fontWeight: curLayer?.name===l.name ? 700 : 400 }}>
                        <div style={{ fontSize:8, color:l.col, letterSpacing:1 }}>
                          {l.name.substring(0,4).toUpperCase()}
                        </div>
                        <div style={{ fontSize:7, color:P.textMuted }}>{l.maxKm}km</div>
                      </div>
                    ))}
                  </div>
                )}
                {done && <EntryStopBanner state={simState} elapsed={elapsed} sat={sat} />}
              </div>

              {/* Telemetry panel */}
              {simState && (
                <div style={{ width:248,
                              background:"rgba(0,0,0,0.40)", backdropFilter:"blur(20px)",
                              borderLeft:`1px solid ${P.border}`,
                              overflowY:"auto", padding:"12px 10px",
                              display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={{ fontSize:8, color:P.sky, letterSpacing:3, marginBottom:5,
                                  paddingBottom:3, borderBottom:`1px solid ${P.sky}20` }}>
                      ◈ POSITION & KINEMATICS
                    </div>
                    <TRow label="ALTITUDE"    value={Math.max(simState.altKm,0).toFixed(1)} unit="km"   color={P.sky} hot />
                    <TRow label="VELOCITY"    value={(simState.velocity/1000).toFixed(3)}    unit="km/s" color={P.sky} hot />
                    <TRow label="ENTRY ANGLE" value={simState.entryAngleDeg.toFixed(3)}      unit="°"    color={P.lavender} />
                  </div>
                  <div>
                    <div style={{ fontSize:8, color:P.amber, letterSpacing:3, marginBottom:5,
                                  paddingBottom:3, borderBottom:`1px solid ${P.amber}20` }}>
                      ◈ FORCES
                    </div>
                    <TRow label="DRAG FORCE"
                          value={simState.dragForce > 1e6 ? (simState.dragForce/1e6).toFixed(3) : simState.dragForce.toFixed(2)}
                          unit={simState.dragForce > 1e6 ? "MN" : "N"} color={P.amber}
                          hot={simState.dragForce > 500} />
                    <TRow label="G-FORCE" value={simState.gForce.toFixed(3)} unit="g"
                          color={simState.gForce > 5 ? P.coral : P.amber} hot={simState.gForce > 1} />
                    <TRow label="DYN PRESS"
                          value={simState.dynamicPressure > 1000
                            ? (simState.dynamicPressure/1000).toFixed(2)
                            : simState.dynamicPressure.toFixed(3)}
                          unit={simState.dynamicPressure > 1000 ? "kPa" : "Pa"}
                          color={P.textSub} />
                  </div>
                  <div>
                    <div style={{ fontSize:8, color:P.coral, letterSpacing:3, marginBottom:5,
                                  paddingBottom:3, borderBottom:`1px solid ${P.coral}20` }}>
                      ◈ THERMAL
                    </div>
                    <TRow label="HEAT FLUX"
                          value={simState.heatFlux > 1e6 ? (simState.heatFlux/1e6).toFixed(3) : simState.heatFlux.toFixed(1)}
                          unit={simState.heatFlux > 1e6 ? "MW/m²" : "W/m²"}
                          color={simState.heatFlux > 1e5 ? P.coral : P.warn}
                          hot={simState.heatFlux > 1e4} />
                    <TRow label="TPS STRESS" value={simState.tpsStress.toFixed(4)} unit="norm"
                          color={simState.tpsStress > 0.5 ? P.coral : P.warn}
                          hot={simState.tpsStress > 0.1} />
                  </div>
                  <div>
                    <div style={{ fontSize:8, color:P.warn, letterSpacing:3, marginBottom:5,
                                  paddingBottom:3, borderBottom:`1px solid ${P.warn}20` }}>
                      ◈ DEBRIS ENVIRONMENT
                    </div>
                    <TRow label="TRACKED"      value={debrisCount} unit="obj" color={P.amber} />
                    <TRow label="CONJUNCTIONS" value={warnCount}   unit="evt"
                          color={warnCount > 3 ? P.coral : P.warn} hot={warnCount > 0} />
                    <TRow label="RISK LEVEL"
                          value={
                            simState.altKm < 300  ? "CRITICAL" :
                            simState.altKm < 800  ? "HIGH"     :
                            simState.altKm < 2000 ? "MODERATE" : "LOW"
                          }
                          unit=""
                          color={
                            simState.altKm < 300  ? P.coral :
                            simState.altKm < 800  ? P.warn  :
                            simState.altKm < 2000 ? P.amber : P.sage
                          }
                          hot={simState.altKm < 800} />
                  </div>
                  <div style={{ marginTop:"auto" }}>
                    <div style={{ fontSize:8, color:P.textMuted, letterSpacing:2, marginBottom:5 }}>
                      DESCENT PROGRESS
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{
                        height:"100%", borderRadius:4, transition:"width 0.12s",
                        width:`${Math.min(100, Math.max(0, ((sat.altitudeKm - simState.altKm) / sat.altitudeKm) * 100))}%`,
                        background:`linear-gradient(90deg, ${sat.color}, ${P.coral})`,
                      }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      <span style={{ fontSize:8, color:P.textMuted }}>{sat.altitudeKm.toLocaleString()} km</span>
                      <span style={{ fontSize:8, color:P.coral }}>80 km ●</span>
                    </div>
                  </div>
                  {done && (
                    <div style={{ padding:"10px", borderRadius:8, textAlign:"center",
                                  background:"rgba(150,70,55,0.08)",
                                  border:`1px solid rgba(170,90,70,0.20)` }}>
                      <div style={{ fontSize:9, color:P.coral, fontWeight:700, letterSpacing:2 }}>
                        ● ENTRY BOUNDARY HIT
                      </div>
                      <div style={{ fontSize:8, color:P.textMuted, marginTop:4, lineHeight:1.6 }}>
                        Simulation stopped at<br />Kármán Line · 80 km
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.25;transform:scale(1.5)} }
        @keyframes fw    { from{opacity:1} to{opacity:0.38} }
        @media (max-width: 768px) {
          .desktop-nav   { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px }
      `}</style>
    </div>
  );
}