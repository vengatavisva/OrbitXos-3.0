import React, { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, AlertTriangle, BrainCircuit } from "lucide-react";
import Navbar from "../components/Navbar";
import { FiShield, FiActivity, FiTrendingUp, FiCpu } from "react-icons/fi";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CircularGallery from "../components/CircularGallery";

import "@fontsource/orbitron/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";

gsap.registerPlugin(ScrollTrigger);

/* ─── ScrollFloat Component ─────────────────────────────────────────────── */
const ScrollFloat = ({
  children,
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = "back.inOut(2)",
  scrollStart = "center bottom+=50%",
  scrollEnd = "bottom bottom-=40%",
  stagger = 0.03,
}) => {
  const containerRef = useRef(null);

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split("").map((char, index) => (
      <span className="inline-block word" key={index}>
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scroller =
      scrollContainerRef && scrollContainerRef.current
        ? scrollContainerRef.current
        : window;
    const charElements = el.querySelectorAll(".inline-block");
    gsap.fromTo(
      charElements,
      {
        willChange: "opacity, transform",
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: "50% 0%",
      },
      {
        duration: animationDuration,
        ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: true,
        },
      }
    );
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <h2 ref={containerRef} className={`my-5 overflow-hidden ${containerClassName}`}>
      <span
        className={`inline-block text-[clamp(1.6rem,4vw,3rem)] leading-normal ${textClassName}`}
      >
        {splitText}
      </span>
    </h2>
  );
};

/* ─── Feature Card ───────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, index }) {
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // Scroll entrance only — no conflicting loop tweens
    gsap.fromTo(
      el,
      { opacity: 0, y: 70, scale: 0.88 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.85,
        ease: "back.out(1.5)",
        delay: index * 0.12,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
      }
    );

    // Hover: glow in/out via GSAP only — no transform fighting
    const glow = glowRef.current;
    const onEnter = () => gsap.to(glow, { opacity: 1, duration: 0.35, ease: "power2.out" });
    const onLeave = () => gsap.to(glow, { opacity: 0, duration: 0.4, ease: "power2.in" });
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [index]);

  const accentColors = [
    { glow: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.5)", icon: "#ffffff", float: `float-card-0` },
    { glow: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.5)", icon: "#ffffff", float: `float-card-1` },
    { glow: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.5)", icon: "#ffffff", float: `float-card-2` },
    { glow: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.5)", icon: "#ffffff", float: `float-card-3` },
  ];
  const ac = accentColors[index % accentColors.length];

  return (
    <div
      ref={cardRef}
      className={`relative p-8 rounded-2xl overflow-hidden cursor-pointer group ${ac.float}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(18px)",
        // CSS hover handled purely via transition — no GSAP transform conflict
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), border-color 0.3s ease, box-shadow 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-10px) scale(1.03)";
        e.currentTarget.style.borderColor = ac.border;
        e.currentTarget.style.boxShadow = `0 20px 50px -10px ${ac.glow}, 0 0 0 1px ${ac.border}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px) scale(1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Radial glow blob — GSAP opacity only */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          opacity: 0,
          background: `radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.10), transparent 60%)`,
          boxShadow: "inset 0 0 60px rgba(255,255,255,0.05)",
        }}
      />

      {/* Top edge accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${ac.icon}, transparent)`,
          opacity: 0.5,
        }}
      />

      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
          animation: `shimmer ${4 + index * 0.8}s linear infinite`,
        }}
      />

      {/* Icon */}
      <div
        className="relative z-10 mb-5 w-12 h-12 flex items-center justify-center rounded-xl"
        style={{
          background: `radial-gradient(circle, ${ac.glow} 0%, transparent 70%)`,
          color: ac.icon,
          filter: `drop-shadow(0 0 10px ${ac.icon})`,
          border: `1px solid ${ac.glow}`,
          transition: "transform 0.3s ease, filter 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "rotate(8deg) scale(1.15)";
          e.currentTarget.style.filter = `drop-shadow(0 0 18px ${ac.icon})`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotate(0deg) scale(1)";
          e.currentTarget.style.filter = `drop-shadow(0 0 10px ${ac.icon})`;
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        className="relative z-10 font-orbitron text-base md:text-lg font-semibold mb-3 tracking-wide uppercase"
        style={{
          color: "#fff",
          textShadow: `0 0 18px ${ac.icon}80`,
        }}
      >
        {title}
      </h3>

      {/* Desc */}
      <p className="relative z-10 text-gray-400 font-inter text-sm leading-relaxed tracking-wide">
        {desc}
      </p>

    </div>
  );
}

/* ─── Floating Particles ─────────────────────────────────────────────────── */
function FloatingParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,255,${p.alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

/* ─── Orbit Ring SVG ─────────────────────────────────────────────────────── */
function OrbitRings() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {[340, 500, 660, 820].map((size, i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: size,
            height: size,
            borderColor: `rgba(0,255,255,${0.06 - i * 0.01})`,
            animation: `spin ${20 + i * 10}s linear infinite ${i % 2 === 0 ? "" : "reverse"}`,
          }}
        >
          {/* Dot on ring */}
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              background: i % 2 === 0 ? "#00ffff" : "#a855f7",
              boxShadow: `0 0 12px ${i % 2 === 0 ? "#00ffff" : "#a855f7"}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────── */
export default function App() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const heroContentRef = useRef(null);
  const ctaBtnsRef = useRef(null);
  const subtitleRef = useRef(null);
  const statsRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    // Hero entrance — staggered reveal
    const tl = gsap.timeline({ delay: 0.3 });

    tl.fromTo(
      ".hero-title",
      { opacity: 0, y: 60, scale: 0.9, filter: "blur(12px)" },
      { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "expo.out" }
    )
      .fromTo(
        ".hero-sub",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.15 },
        "-=0.8"
      )
      .fromTo(
        ".cta-btn",
        { opacity: 0, y: 40, scale: 0.8 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(2)", stagger: 0.1 },
        "-=0.4"
      );

    // Parallax on hero content
    gsap.to(".hero-parallax", {
      yPercent: -25,
      ease: "none",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

    // Section divider line animation
    gsap.fromTo(
      ".section-line",
      { scaleX: 0, transformOrigin: "left center" },
      {
        scaleX: 1,
        duration: 1.5,
        ease: "power3.out",
        scrollTrigger: { trigger: ".section-line", start: "top 90%", once: true },
      }
    );

    return () => ScrollTrigger.getAll().forEach((t) => t.kill());
  }, []);

  return (
    <>
      {/* Global animation styles */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        /* Gentle staggered floats — pure CSS, no GSAP conflict */
        .float-card-0 { animation: floatA 5s ease-in-out infinite; }
        .float-card-1 { animation: floatB 6s ease-in-out infinite 0.8s; }
        .float-card-2 { animation: floatA 5.5s ease-in-out infinite 1.4s; }
        .float-card-3 { animation: floatB 6.5s ease-in-out infinite 0.4s; }
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-8px) scale(1.005); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.005); }
        }
        /* Pause float on hover so CSS lift takes over cleanly */
        .float-card-0:hover,
        .float-card-1:hover,
        .float-card-2:hover,
        .float-card-3:hover { animation-play-state: paused; }
        body { background: #000; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.3); border-radius: 4px; }
      `}</style>

      <div className="relative min-h-screen text-white font-inter overflow-hidden bg-black">
        <div className="relative z-10">
          <Navbar />

          {/* ── HERO ─────────────────────────────────────────── */}
          <section
            ref={heroRef}
            className="relative flex flex-col items-center justify-center text-center min-h-screen px-6 pt-28 overflow-hidden"
          >
            {/* Video BG */}
            <video
              className="absolute top-0 left-0 w-full h-full object-cover brightness-105 contrast-110 saturate-120"
              src="/space_bg.MP4"
              autoPlay
              loop
              muted
              playsInline
            />

            {/* Layered overlays */}
            <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/50 to-black/80" />
            
            {/* Scanline effect */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
                zIndex: 2,
              }}
            />

            {/* Particles */}
            <FloatingParticles />

            {/* Orbit Rings */}
            <OrbitRings />

            {/* Hero Content */}
            <div className="hero-parallax relative z-10" ref={heroContentRef}>
              {/* Glow behind title */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  width: 600,
                  height: 300,
                  background: "radial-gradient(ellipse, rgba(0,255,255,0.12) 0%, transparent 70%)",
                  animation: "pulse-glow 4s ease-in-out infinite",
                }}
              />

              <h1
                className="hero-title font-orbitron text-6xl md:text-8xl font-extrabold tracking-widest leading-tight"
                style={{
                  background: "linear-gradient(135deg, #fff 0%, #e0f7ff 40%, #00ffff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 60px rgba(0,255,255,0.5))",
                  letterSpacing: "0.15em",
                }}
              >
                OrbitXOS
              </h1>

              <div className="mt-8 space-y-3">
                <p className="hero-sub text-xl md:text-2xl text-gray-200 font-light tracking-widest">
                  AI-Driven Space Debris Monitoring
                </p>
                <p className="hero-sub text-lg md:text-xl text-cyan-300/80 font-light tracking-widest">
                  Protecting Satellites. Securing Orbits.
                </p>
              </div>

              {/* CTA Buttons */}
<div className="mt-12 flex flex-wrap gap-5 justify-center font-orbitron tracking-wide">
  {[
    {
      label: "View Dashboard",
      icon: <Radar className="w-5 h-5" />,
      route: "/dashboard",
      color: "rgba(255,255,255,0.06)",
      glow: "rgba(255,255,255,0.35)",
    },
    {
      label: "See Predictions",
      icon: <AlertTriangle className="w-5 h-5 text-white" />,
      route: "/predictions",
      color: "rgba(255,255,255,0.06)",
      glow: "rgba(255,255,255,0.35)",
    },
    {
      label: "Error Prediction",
      icon: <BrainCircuit className="w-5 h-5 text-white" />,
      route: "/error-prediction",
      color: "rgba(255,255,255,0.06)",
      glow: "rgba(255,255,255,0.35)",
    },
  ].map((btn, i) => (
    <button
      key={i}
      onClick={() => navigate(btn.route)}
      className="cta-btn group flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-base uppercase text-white transition-all duration-300"
      style={{
        border: "1px solid rgba(255,255,255,0.2)",
        background: btn.color,
        backdropFilter: "blur(10px)",
        boxShadow: `0 0 0px ${btn.glow}`,
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 30px ${btn.glow}, 0 0 60px ${btn.glow}`;
        e.currentTarget.style.transform = "scale(1.08) translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0px ${btn.glow}`;
        e.currentTarget.style.transform = "scale(1) translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
      }}
    >
      {btn.icon}
      {btn.label}
    </button>
  ))}
</div>

              {/* Scroll indicator */}
              <div className="mt-16 flex flex-col items-center gap-2 opacity-60">
                <span className="text-xs tracking-[0.3em] text-gray-400 uppercase font-inter">
                  Scroll to explore
                </span>
                <div
                  className="w-px h-12 bg-linear-to-b from-cyan-400 to-transparent"
                  style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
                />
              </div>
            </div>
          </section>

          {/* ── BELOW HERO ───────────────────────────────────── */}
          <div
            className="relative bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/background.JPG')" }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div className="relative z-10">

              {/* ── SCROLL FLOAT HEADING ─────────────────────── */}
              <section className="py-8 px-8 text-center">
                <div className="section-line h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent mb-12 mx-auto max-w-3xl" />
                <ScrollFloat
                  animationDuration={1.2}
                  ease="back.inOut(2)"
                  scrollStart="center bottom+=50%"
                  scrollEnd="bottom bottom-=40%"
                  stagger={0.03}
                  containerClassName="justify-center text-center"
                  textClassName="font-orbitron font-bold tracking-widest uppercase text-white"
                  style={{ textShadow: "0 0 30px rgba(0,255,255,0.5)" }}
                >
                  Advanced Space Protection
                </ScrollFloat>

                <p
                  className="text-gray-300 max-w-2xl mx-auto mb-4 font-inter tracking-wide text-lg"
                  style={{
                    opacity: 0,
                    animation: "none",
                  }}
                  ref={(el) => {
                    if (!el) return;
                    gsap.fromTo(
                      el,
                      { opacity: 0, y: 30 },
                      {
                        opacity: 1,
                        y: 0,
                        duration: 1,
                        ease: "power3.out",
                        scrollTrigger: { trigger: el, start: "top 85%", once: true },
                      }
                    );
                  }}
                >
                  Our AI-powered platform combines real-time tracking, predictive
                  analytics, and automated collision avoidance to safeguard space assets.
                </p>
              </section>

              {/* ── FEATURES SECTION ─────────────────────────── */}
              <section className="relative py-16 px-8 md:px-16 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-7xl mx-auto">
                  <FeatureCard
                    index={0}
                    icon={<FiActivity size={38} />}
                    title="Real-Time Monitoring"
                    desc="Track over 34,000 objects in Earth's orbit with sub-meter precision using our distributed sensor network."
                  />
                  <FeatureCard
                    index={1}
                    icon={<FiCpu size={38} />}
                    title="AI-Powered Predictions"
                    desc="Machine learning algorithms predict collision probabilities up to 7 days ahead with 99.7% accuracy."
                  />
                  <FeatureCard
                    index={2}
                    icon={<FiShield size={38} />}
                    title="Collision Avoidance"
                    desc="Automated trajectory correction suggestions to prevent space debris collisions before they happen."
                  />
                  <FeatureCard
                    index={3}
                    icon={<FiTrendingUp size={38} />}
                    title="Risk Assessment"
                    desc="Dynamic risk scoring based on orbital mechanics, debris characteristics, and historical collision data."
                  />
                </div>

                
              </section>

              {/* ── SATELLITE GALLERY SECTION ────────────────── */}
              <section
                className="relative py-20 overflow-hidden"
                ref={(el) => {
                  if (!el) return;
                  gsap.fromTo(
                    el.querySelector(".gallery-heading"),
                    { opacity: 0, y: 40 },
                    {
                      opacity: 1,
                      y: 0,
                      duration: 1,
                      ease: "power3.out",
                      scrollTrigger: { trigger: el, start: "top 85%", once: true },
                    }
                  );
                }}
              >
                {/* Section header */}
                <div className="gallery-heading text-center px-8 mb-10">
                  <div className="section-line h-px bg-linear-to-r from-transparent via-white/30 to-transparent mb-10 mx-auto max-w-3xl" />
                  <p className="font-orbitron text-xs tracking-[0.4em] text-gray-500 uppercase mb-3">
                    Live Intelligence Feed
                  </p>
                  <ScrollFloat
                    animationDuration={1.1}
                    ease="back.inOut(2)"
                    scrollStart="center bottom+=50%"
                    scrollEnd="bottom bottom-=40%"
                    stagger={0.03}
                    containerClassName="justify-center text-center"
                    textClassName="font-orbitron font-bold tracking-widest uppercase text-white"
                  >
                    Orbital Surveillance
                  </ScrollFloat>
                  <p
                    className="text-gray-400 max-w-xl mx-auto font-inter text-sm tracking-wide"
                    ref={(el) => {
                      if (!el) return;
                      gsap.fromTo(
                        el,
                        { opacity: 0, y: 20 },
                        {
                          opacity: 1,
                          y: 0,
                          duration: 0.9,
                          ease: "power3.out",
                          scrollTrigger: { trigger: el, start: "top 88%", once: true },
                        }
                      );
                    }}
                  >
                    Real imagery from active satellite monitoring zones — drag or scroll to explore the feed.
                  </p>
                </div>

                {/* Gallery wrapper with matching dark aesthetic */}
<div
  className="relative"
  style={{
    height: "600px",
    fontFamily: "Orbitron, sans-serif",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 500,
  }}
  ref={(el) => {
    if (!el) return;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.97 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      }
    );
  }}
>
  {/* Edge fade overlays */}
  <div
    className="absolute left-0 top-0 bottom-0 w-32 pointer-events-none"
    style={{
      background: "linear-gradient(to right, rgba(0,0,0,0.85), transparent)",
      zIndex: 10,
    }}
  />
  <div
    className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none"
    style={{
      background: "linear-gradient(to left, rgba(0,0,0,0.85), transparent)",
      zIndex: 10,
    }}
  />

  <CircularGallery
    items={[
      { image: "/sat1.jpeg", text: "Low Earth Orbit Satellite" },
      { image: "/sat2.jpeg", text: "Weather Monitoring Satellite" },
      { image: "/sat3.jpeg", text: "Communication Satellite" },
      { image: "/sat4.jpeg", text: "Earth Observation Satellite" },
      { image: "/sat5.jpeg", text: "Navigation Satellite (GNSS)" },
      { image: "/sat6.jpeg", text: "Space Telescope Satellite" },
      { image: "/sat7.jpeg", text: "Defense Reconnaissance Satellite" },
      { image: "/sat8.jpeg", text: "Deep Space Probe Satellite" },
    ]}
    bend={1}
    textColor="#ffffff"
    borderRadius={0.05}
    scrollSpeed={2}
    scrollEase={0.05}
  />
</div>

                {/* Bottom fade */}
                <div className="section-line h-px bg-linear-to-r from-transparent via-white/20 to-transparent mt-10 mx-auto max-w-3xl" />
              </section>
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}