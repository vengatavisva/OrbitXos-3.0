// src/pages/PredictionPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StarfieldBackground from "../components/StarfieldBackground";

// ── GSAP loader ───────────────────────────────────────────────────────────────
function useGSAP(callback, deps = []) {
  useEffect(() => {
    let cleanup;
    const load = async () => {
      if (!window.gsap) {
        await new Promise(res => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
          s.onload = res; document.head.appendChild(s);
        });
        await new Promise(res => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
          s.onload = res; document.head.appendChild(s);
        });
        window.gsap.registerPlugin(window.ScrollTrigger);
      }
      cleanup = callback(window.gsap, window.ScrollTrigger);
    };
    load();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, deps);
}

// ── Risk config ───────────────────────────────────────────────────────────────
const RISK = {
  Critical: { color: "#ff2244", glow: "rgba(255,34,68,0.35)",  border: "rgba(255,34,68,0.4)",  text: "text-red-400",    bg: "rgba(255,34,68,0.08)",    bar: "from-rose-300 to-red-500"    },
  High:     { color: "#ffaa00", glow: "rgba(255,170,0,0.3)",   border: "rgba(255,170,0,0.35)", text: "text-yellow-300", bg: "rgba(255,170,0,0.06)",    bar: "from-yellow-200 to-amber-500" },
  Medium:   { color: "#00ccff", glow: "rgba(0,200,255,0.25)",  border: "rgba(0,200,255,0.3)",  text: "text-cyan-300",   bg: "rgba(0,200,255,0.05)",    bar: "from-cyan-200 to-cyan-500"   },
  Low:      { color: "#00ff88", glow: "rgba(0,255,136,0.2)",   border: "rgba(0,255,136,0.3)",  text: "text-green-300",  bg: "rgba(0,255,136,0.05)",    bar: "from-emerald-200 to-green-500"},
};

const getRandomSeconds = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatSeconds = (s) => {
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

// ── Animated countdown digits ─────────────────────────────────────────────────
function CountdownDigit({ value }) {
  return (
    <span style={{
      display: "inline-block",
      minWidth: "1.2ch",
      fontVariantNumeric: "tabular-nums",
      fontFamily: "'Rajdhani', monospace",
      transition: "color 0.3s",
    }}>
      {value}
    </span>
  );
}

function Countdown({ seconds, color = "#ff2244" }) {
  const str = formatSeconds(seconds);
  return (
    <span style={{ color, fontFamily: "'Rajdhani', monospace", fontWeight: 800, fontSize: "1.15rem", letterSpacing: "0.05em", textShadow: `0 0 12px ${color}80` }}>
      {str.split("").map((ch, i) => <CountdownDigit key={i} value={ch} />)}
    </span>
  );
}

// ── Probability bar ───────────────────────────────────────────────────────────
function ProbBar({ prob, color, animated }) {
  const pct = parseFloat(prob) || 0;
  return (
    <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
      <div style={{
        height: "100%",
        width: animated ? `${pct}%` : "0%",
        background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${color})`,
        borderRadius: 4,
        transition: animated ? "width 1.4s cubic-bezier(0.22,1,0.36,1)" : "none",
        boxShadow: `0 0 8px ${color}80`,
      }} />
    </div>
  );
}

// ── Prediction Card ───────────────────────────────────────────────────────────
const PredictionCard = ({
  title, target, time, prob, risk, burn, maneuver, confidence,
  isHighlighted, onExecute, index, barAnimated,
}) => {
  const rc   = RISK[risk] || RISK.Low;
  const cardRef = useRef(null);

  // 3D tilt
  const onMove = (e) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 8;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -6;
    el.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) translateZ(4px)`;
  };
  const onLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  };

  return (
    <div
      ref={cardRef}
      className="gsap-card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        opacity: 0,
        position: "relative",
        background: "linear-gradient(135deg, rgba(8,12,24,0.92) 0%, rgba(4,8,20,0.96) 100%)",
        border: isHighlighted ? `1.5px solid ${rc.color}` : `1px solid ${rc.border}`,
        borderRadius: 20,
        padding: "22px 28px",
        boxShadow: isHighlighted
          ? `0 0 50px ${rc.glow}, 0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`
          : `0 0 30px ${rc.bg}, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)`,
        transition: "transform 0.18s ease, box-shadow 0.3s ease, border-color 0.3s",
        willChange: "transform",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Risk accent bar on left edge */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${rc.color}, transparent)`, borderRadius: "20px 0 0 20px" }} />

      {/* Subtle scan line on hover via CSS class */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${rc.color}40, transparent)` }} />

      {/* Index watermark */}
      <div style={{ position: "absolute", top: 14, right: 22, fontFamily: "'Rajdhani', monospace", fontSize: 11, color: "rgba(255,255,255,0.08)", fontWeight: 800, letterSpacing: "2px" }}>
        #{String(index + 1).padStart(3, "0")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>

        {/* ── Satellite + Target ── */}
        <div style={{ minWidth: 180, flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.color, boxShadow: `0 0 8px ${rc.color}`, flexShrink: 0, animation: "dot-pulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'Rajdhani', monospace", fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "0.3px" }}>{title}</span>
          </div>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 15, letterSpacing: "0.5px" }}>
            ↔ {target}
          </div>
        </div>

        {/* ── Time to impact ── */}
        <div style={{ textAlign: "center", minWidth: 120, flex: "0 0 auto" }}>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: 5 }}>TIME TO IMPACT</div>
          <Countdown seconds={time} color="#ff6699" />
        </div>

        {/* ── Probability ── */}
        <div style={{ minWidth: 100, flex: "0 0 auto" }}>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: 4 }}>PROBABILITY</div>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontWeight: 900, fontSize: 22, color: rc.color, lineHeight: 1, textShadow: `0 0 16px ${rc.color}60` }}>{prob}</div>
          <ProbBar prob={prob} color={rc.color} animated={barAnimated} />
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 10, color: rc.color, letterSpacing: "1.5px", marginTop: 5, fontWeight: 700 }}>{risk.toUpperCase()}</div>
        </div>

        {/* ── Maneuver ── */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: 5 }}>MANEUVER</div>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{burn}</div>
        </div>

        {/* ── Confidence ── */}
        <div style={{ textAlign: "center", minWidth: 80, flex: "0 0 auto" }}>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: 4 }}>CONFIDENCE</div>
          <div style={{ fontFamily: "'Rajdhani', monospace", fontWeight: 700, fontSize: 16, color: "#fff" }}>{confidence}</div>
        </div>

        {/* ── Execute button ── */}
        <div style={{ flex: "0 0 auto" }}>
          <button
            onClick={onExecute}
            style={{
              padding: "10px 22px",
              borderRadius: 12,
              border: `1px solid ${rc.border}`,
              background: rc.bg,
              color: rc.color,
              fontFamily: "'Rajdhani', monospace",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "1.5px",
              cursor: "pointer",
              transition: "all 0.22s",
              boxShadow: `0 0 16px ${rc.bg}`,
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = rc.color + "22";
              e.currentTarget.style.boxShadow = `0 0 28px ${rc.glow}`;
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = rc.bg;
              e.currentTarget.style.boxShadow = `0 0 16px ${rc.bg}`;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            EXECUTE ›
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Prediction = () => {
  const [events, setEvents]         = useState([]);
  const [countdowns, setCountdowns] = useState({});
  const [loading, setLoading]       = useState(true);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [barAnimated, setBarAnimated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res  = await fetch("https://orbitxos.onrender.com/predict");
        const data = await res.json();
        if (data.critical_events) {
          setEvents(data.critical_events);
          const initial = {};
          data.critical_events.forEach((ev, i) => {
            const ranges = { Critical:[600,3000], High:[3000,6000], Medium:[6000,12000], Low:[12000,15000] };
            const [min, max] = ranges[ev.risk_level] || [7200, 7200];
            initial[i] = getRandomSeconds(min, max);
          });
          setCountdowns(initial);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!Object.keys(countdowns).length) return;
    const id = setInterval(() => {
      setCountdowns(prev => {
        const next = {};
        for (const k in prev) next[k] = prev[k] > 0 ? prev[k] - 1 : 0;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdowns]);

  // ── GSAP ──────────────────────────────────────────────────────────────────
  useGSAP((gsap, ScrollTrigger) => {
    if (loading) return;

    // 1. Page wrapper
    gsap.set(".gsap-page", { opacity: 1 });

    // 2. Hero header timeline
    const tl = gsap.timeline({ delay: 0.1 });

    tl.fromTo(".gsap-page-line",
      { width: "0px", opacity: 0 },
      { width: "260px", opacity: 1, duration: 0.9, ease: "power3.out" }, 0
    );
    tl.fromTo(".gsap-page-badge",
      { opacity: 0, y: -18, scale: 0.82 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(2)" }, 0.2
    );
    tl.fromTo(".gsap-page-title",
      { opacity: 0, y: 55, skewX: -4 },
      { opacity: 1, y: 0, skewX: 0, duration: 1.0, ease: "expo.out" }, 0.35
    );
    tl.fromTo(".gsap-page-subtitle",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" }, 0.75
    );
    tl.fromTo(".gsap-page-divider",
      { scaleX: 0, transformOrigin: "left" },
      { scaleX: 1, duration: 1.1, ease: "power3.inOut" }, 0.9
    );
    tl.fromTo(".gsap-stat-pill",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" }, 1.0
    );

    // 3. Critical alert banner
    if (document.querySelector(".gsap-alert-banner")) {
      tl.fromTo(".gsap-alert-banner",
        { opacity: 0, x: -40, scale: 0.97 },
        { opacity: 1, x: 0, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, 1.2
      );
    }

    // 4. Section header
    tl.fromTo(".gsap-section-header",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, 1.35
    );

    // 5. Cards — staggered slide up
    gsap.fromTo(".gsap-card",
      { opacity: 0, y: 50, scale: 0.95 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.65, stagger: 0.13, ease: "back.out(1.4)",
        delay: 1.4,
        onComplete: () => setBarAnimated(true),
      }
    );

    // 6. Scroll-triggered cards (if many)
    ScrollTrigger.batch(".gsap-card", {
      start: "top 92%",
      onEnter: els => {
        gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.1, ease: "back.out(1.3)" });
      },
    });

    // 7. Floating particles ambient animation
    gsap.to(".gsap-particle", {
      y: "random(-18, 18)",
      x: "random(-10, 10)",
      opacity: "random(0.1, 0.5)",
      duration: "random(3, 6)",
      repeat: -1, yoyo: true, stagger: 0.4, ease: "sine.inOut",
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [loading]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020408", position: "relative", overflow: "hidden" }}>
        <StarfieldBackground />
        <div style={{ position: "relative", zIndex: 10 }}>
          <Navbar />
        </div>
        <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 64px)" }}>
          {/* Radar loader */}
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(0,200,255,0.15)" }} />
            <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "1px solid rgba(0,200,255,0.1)" }} />
            <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: "1px solid rgba(0,200,255,0.08)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#00c8ff", animation: "spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00c8ff", boxShadow: "0 0 10px #00c8ff" }} />
            </div>
          </div>
          <p style={{ fontFamily: "'Rajdhani', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "3px" }}>FETCHING THREAT INTELLIGENCE</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const firstCritical = events.find(e => e.risk_level === "Critical");
  const firstCriticalIdx = events.findIndex(e => e.risk_level === "Critical");

  return (
    <div
      className="gsap-page"
      style={{ position: "relative", minHeight: "100vh", background: "#020408", color: "#fff", overflowX: "hidden", opacity: 0 }}
    >
      <StarfieldBackground />

      {/* Ambient floating particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="gsap-particle" style={{
            position: "absolute",
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            borderRadius: "50%",
            background: i % 3 === 0 ? "#00c8ff" : i % 3 === 1 ? "#ff2244" : "#00ff88",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: 0.2,
          }} />
        ))}
      </div>

      {/* Grid overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(0,200,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.018) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{ position: "relative", zIndex: 10 }}>
        <Navbar />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px 80px" }}>

          {/* ── HERO HEADER ── */}
          <div style={{ paddingTop: 110, paddingBottom: 50, textAlign: "center", position: "relative" }}>

           

            {/* Badge */}
            <div className="gsap-page-badge" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 18px", borderRadius: 30, marginBottom: 22,
              border: "1px solid rgba(0,200,255,0.25)", background: "rgba(0,200,255,0.05)",
              opacity: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2244", boxShadow: "0 0 8px #ff2244", animation: "dot-pulse 1.4s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'Rajdhani', monospace", fontSize: 10, color: "#00c8ff", letterSpacing: "2.5px", fontWeight: 700 }}>ACTIVE THREAT MONITORING</span>
            </div>

            {/* Title */}
            <div style={{ overflow: "hidden", marginBottom: 10 }}>
              <h1 className="gsap-page-title" style={{
                fontFamily: "'Rajdhani', monospace",
                fontSize: "clamp(2.4rem, 6vw, 5rem)",
                fontWeight: 900, color: "#fff",
                letterSpacing: "-0.02em", lineHeight: 1,
                opacity: 0, transform: "translateY(55px)",
              }}>
                Collision Prediction Center
              </h1>
            </div>

            {/* Subtitle */}
            <p className="gsap-page-subtitle" style={{
              fontFamily: "'Rajdhani', monospace",
              fontSize: 14, color: "rgba(255,255,255,0.38)",
              letterSpacing: "1.5px", maxWidth: 500, margin: "0 auto 28px",
              opacity: 0,
            }}>
              AI-enhanced trajectory analysis and collision avoidance recommendations
            </p>

            {/* Divider */}
            <div className="gsap-page-divider" style={{
              height: 1, marginBottom: 28,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 40%, transparent)",
            }} />

            {/* Stat pills */}
            {/* Stat pills */}
<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
  {[
    { label: "TOTAL EVENTS", value: events.length, color: "#00c8ff" },
    { label: "CRITICAL",     value: events.filter(e => e.risk_level === "Critical").length, color: "#ff2244" },
    { label: "HIGH",         value: events.filter(e => e.risk_level === "High").length,     color: "#ffaa00" },
    { label: "UPDATED",      value: "JUST NOW",     color: "#00ff88" },
  ].map((p, i) => (
    <div
      key={i}
      className="gsap-stat-pill"
      style={{
        padding: "7px 18px",
        borderRadius: 20,
        border: `1px solid ${p.color}30`,
        background: `${p.color}08`,
        opacity: 0,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontFamily: "'Rajdhani', monospace",
          fontSize: 9,
          color: "#ffffff",
          letterSpacing: "2px",
          marginRight: 8
        }}
      >
        {p.label}
      </span>

      {/* Value */}
      <span
        style={{
          fontFamily: "'Rajdhani', monospace",
          fontSize: 14,
          fontWeight: 800,
          color: p.color
        }}
      >
        {p.value}
      </span>
    </div>
  ))}
</div>
          </div>

          {/* ── CRITICAL ALERT BANNER ── */}
          {firstCritical && (
            <div className="gsap-alert-banner" style={{
              marginBottom: 40, opacity: 0,
              position: "relative",
              padding: "18px 24px",
              borderRadius: 18,
              border: "1.5px solid rgba(255,34,68,0.45)",
              background: "linear-gradient(135deg, rgba(255,34,68,0.1) 0%, rgba(8,12,24,0.95) 100%)",
              boxShadow: "0 0 50px rgba(255,34,68,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
              overflow: "hidden",
            }}>
              {/* Animated left pulse bar */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, #ff2244, transparent)", animation: "bar-pulse 1.5s ease-in-out infinite alternate" }} />

              <div style={{ paddingLeft: 12, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, animation: "warn-flash 1s ease-in-out infinite" }}>⚠</span>
                  <span style={{ fontFamily: "'Rajdhani', monospace", fontSize: 11, color: "#ff2244", letterSpacing: "2.5px", fontWeight: 700 }}>CRITICAL CONJUNCTION ALERT</span>
                </div>
                <p style={{ fontFamily: "'Rajdhani', monospace", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
                  <span style={{ color: "#fff", fontWeight: 700 }}>{firstCritical.satellite}</span> requires immediate attention — maneuver window closing in{" "}
                  <Countdown seconds={countdowns[firstCriticalIdx] || 0} color="#ff6699" />
                </p>
              </div>

              <button
                onClick={() => setSelectedSatellite(firstCritical.satellite)}
                style={{
                  flexShrink: 0,
                  padding: "10px 22px", borderRadius: 12,
                  border: "1px solid rgba(255,34,68,0.5)",
                  background: "rgba(255,34,68,0.12)",
                  color: "#ff6688", fontFamily: "'Rajdhani', monospace",
                  fontWeight: 700, fontSize: 12, letterSpacing: "1.5px",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,34,68,0.25)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(255,34,68,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,34,68,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                VIEW DETAILS
              </button>
            </div>
          )}

          {/* ── SECTION HEADER ── */}
          <div className="gsap-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, opacity: 0 }}>
            <div>
              <h2 style={{ fontFamily: "'Rajdhani', monospace", fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: "1px", margin: 0 }}>
                Active Collision Predictions
              </h2>
              <div style={{ height: 1, marginTop: 8, background: "linear-gradient(90deg, rgba(0,200,255,0.4), transparent)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(0,255,136,0.2)", background: "rgba(0,255,136,0.05)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px #00ff88", animation: "dot-pulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'Rajdhani', monospace", fontSize: 10, color: "#00ff88", letterSpacing: "1.5px", fontWeight: 700 }}>UPDATED JUST NOW</span>
            </div>
          </div>

          {/* ── CARDS ── */}
          {events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Rajdhani', monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>
              NO CRITICAL EVENTS AT THIS TIME 🚀
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {events.map((event, i) => {
                let burnText = event.maneuver_suggestion || "N/A";
                let maneuverText = burnText;
                if (burnText.includes("~")) {
                  const parts = burnText.split("~");
                  burnText     = parts[1]?.trim() || "N/A";
                  maneuverText = parts[0].trim();
                }

                return (
                  <PredictionCard
                    key={i}
                    index={i}
                    title={event.satellite}
                    target={event.debris}
                    time={countdowns[i] || 0}
                    prob={event.probability}
                    risk={event.risk_level}
                    burn={burnText}
                    maneuver={maneuverText}
                    confidence={event.confidence}
                    isHighlighted={selectedSatellite === event.satellite}
                    barAnimated={barAnimated}
                    onExecute={() =>
                      navigate("/aipredictor", {
                        state: {
                          satellite: event.satellite,
                          satelliteTLE: event.satellite_tle || "",
                          debris: event.debris,
                          debrisTLE: event.debris_tle || "",
                          risk: event.risk_level,
                          time: formatSeconds(countdowns[i] || 0),
                        },
                      })
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Global keyframes ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes dot-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.5)} }
        @keyframes bar-pulse  { 0%{opacity:0.4} 100%{opacity:1} }
        @keyframes warn-flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
};

export default Prediction;