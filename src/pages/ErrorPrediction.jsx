import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import StarfieldBackground from "../components/StarfieldBackground";
import { motion, useInView, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

Chart.register(...registerables);

const API_URL = "http://127.0.0.1:8000/predict/";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXPO_OUT = [0.16, 1, 0.3, 1];
const BACK_OUT = [0.34, 1.56, 0.64, 1];

const COLORS = {
  x_error: "#38bdf8",
  y_error: "#34d399",
  z_error: "#f87171",
  satclockerror: "#fb923c",
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 40, x = 0, className = "", style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-72px 0px" });
  return (
    <motion.div
      ref={ref} className={className} style={style}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: EXPO_OUT }}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger container ────────────────────────────────────────────────────────
function Stagger({ children, stagger = 0.09, delayStart = 0, className = "", style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  return (
    <motion.div
      ref={ref} className={className} style={style}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delayStart } },
      }}
    >
      {children}
    </motion.div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EXPO_OUT } },
};

// ─── Animated number counter ──────────────────────────────────────────────────
function Counter({ to, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(to);
    if (isNaN(num)) { setVal(to); return; }
    const dur = 1400, start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      setVal(decimals > 0 ? (num * ease(t)).toFixed(decimals) : Math.round(num * ease(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, to, decimals]);
  return <span ref={ref}>{val}</span>;
}

// ─── Glowing metric card ──────────────────────────────────────────────────────
function MetricCard({ label, value, sublabel, accent = "#38bdf8" }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.025, transition: { duration: 0.2 } }}
      style={{
        position: "relative", overflow: "hidden",
        borderRadius: 16, padding: 28,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: `0 0 40px ${accent}09`,
      }}
    >
      <div style={{
        position: "absolute", inset: "0 0 auto", height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}70, transparent)`,
      }} />
      <p style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: accent, marginBottom: 10, fontFamily: "monospace" }}>
        {label}
      </p>
      <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: accent, letterSpacing: "-0.03em" }}>
        <Counter to={value} />
      </div>
      {sublabel && (
        <p style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>{sublabel}</p>
      )}
    </motion.div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ eyebrow, title, accent = "#38bdf8" }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <motion.div
          style={{ width: 6, height: 6, borderRadius: "50%", background: accent }}
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
        <span style={{ fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: accent, fontFamily: "monospace" }}>
          {eyebrow}
        </span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
    </div>
  );
}

// ─── Chart wrapper ────────────────────────────────────────────────────────────
function ChartCard({ children, accent = "#38bdf8", style: extraStyle = {} }) {
  return (
    <div style={{
      position: "relative", borderRadius: 16,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      padding: 28, overflow: "hidden",
      ...extraStyle,
    }}>
      <div style={{
        position: "absolute", inset: "0 0 auto", height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}50, transparent)`,
      }} />
      {children}
    </div>
  );
}

// ─── Shiny Transparent NaviC Button ──────────────────────────────────────────
function ShinyNaviCButton({ href }) {
  const [mousePos, setMousePos] = useState({ x: -200, y: -200 });
  const [isHovered, setIsHovered] = useState(false);
  const btnRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.a
      ref={btnRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setMousePos({ x: -200, y: -200 }); }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.975 }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 22,
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
        textDecoration: "none",
        cursor: "pointer",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        border: isHovered
          ? "1px solid rgba(99,102,241,0.5)"
          : "1px solid rgba(255,255,255,0.1)",
        boxShadow: isHovered
          ? "0 0 28px rgba(99,102,241,0.25), 0 0 56px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.12)"
          : "0 0 10px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "border-color 0.35s ease, box-shadow 0.35s ease",
      }}
    >
      {/* Mouse spotlight */}
      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          width: 200,
          height: 200,
          borderRadius: "50%",
          transform: `translate(${mousePos.x - 100}px, ${mousePos.y - 100}px)`,
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(14,165,233,0.08) 45%, transparent 70%)",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.2s ease",
          zIndex: 0,
        }}
      />

      {/* Shimmer sweep on hover */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)",
          backgroundSize: "200% 100%",
          zIndex: 1,
          pointerEvents: "none",
        }}
        animate={isHovered
          ? { backgroundPosition: ["200% 0%", "-200% 0%"] }
          : { backgroundPosition: "200% 0%" }
        }
        transition={{ duration: 0.7, ease: "easeInOut" }}
      />

      {/* Top gloss edge */}
      <div style={{
        position: "absolute",
        top: 0, left: "15%", right: "15%", height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
        zIndex: 2,
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 10 }}>
        {/* Satellite icon */}
        <motion.div
          animate={isHovered ? { rotate: [-6, 6, -3, 0], scale: 1.15 } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          style={{
            filter: isHovered ? "drop-shadow(0 0 5px rgba(129,140,248,0.9))" : "none",
            transition: "filter 0.3s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={isHovered ? "#a5b4fc" : "rgba(255,255,255,0.6)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "stroke 0.3s ease" }}
          >
            <circle cx="12" cy="12" r="2"/>
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49"/>
            <path d="M7.76 16.25a6 6 0 0 1 0-8.49"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>
          </svg>
        </motion.div>

        {/* Label */}
        <span style={{
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.06em",
          fontFamily: '"DM Mono", monospace',
          color: isHovered ? "transparent" : "rgba(255,255,255,0.7)",
          background: isHovered
            ? "linear-gradient(90deg, #a5b4fc, #7dd3fc, #a5b4fc)"
            : "none",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: isHovered ? "text" : "unset",
          WebkitTextFillColor: isHovered ? "transparent" : "rgba(255,255,255,0.7)",
          animation: isHovered ? "shimmerNaviC 1.6s linear infinite" : "none",
          transition: "color 0.3s ease",
        }}>
          Launch NaviC Satellite Simulation
        </span>

        {/* External link arrow */}
        <motion.div
          animate={isHovered ? { x: 3, y: -3 } : { x: 0, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={isHovered ? "#a5b4fc" : "rgba(255,255,255,0.3)"}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "stroke 0.3s ease" }}
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </motion.div>
      </div>
    </motion.a>
  );
}

export default function ErrorPrediction() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [predictionData, setPredictionData] = useState([]);
  const [uploadedData, setUploadedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentView, setCurrentView] = useState("predictions");
  const [accuracyMetrics, setAccuracyMetrics] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { alert("Only CSV files are supported."); return; }
    if (file.size > MAX_FILE_SIZE) { alert(`File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`); return; }
    setSelectedFile(file); setSuccess(false);
    setPredictionData([]); setUploadedData([]);
    setAccuracyMetrics(null); setPerformanceMetrics(null);
  }, []);

  const handleFileInputChange = (e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); };
  const clearFile = (e) => {
    e.stopPropagation(); setSelectedFile(null); setSuccess(false);
    setPredictionData([]); setUploadedData([]);
    setAccuracyMetrics(null); setPerformanceMetrics(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!selectedFile || loading) return;
    setLoading(true); setSuccess(false);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const response = await axios.post(API_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
      });
      const data = response.data;
      const predictions = data.prediction || data.predictions_day8 || [];
      const tableData = data.table_data || [];
      setPredictionData(predictions); setUploadedData(tableData);
      if (predictions.length > 0) {
        const total = predictions.length;
        const lstmCount = predictions.filter(r => r.model_used === "LSTM").length;
        const transformerCount = predictions.filter(r => r.model_used === "Transformer").length;
        setPerformanceMetrics({
          lstm_usage: lstmCount, lstm_percentage: total > 0 ? Math.round((lstmCount / total) * 100) : 0,
          transformer_usage: transformerCount, transformer_percentage: total > 0 ? Math.round((transformerCount / total) * 100) : 0,
        });
      }
      if (data.accuracy_metrics) setAccuracyMetrics(data.accuracy_metrics);
      setCurrentView("predictions"); setSuccess(true);
    } catch {
      alert("Prediction failed. Please make sure the backend is running.");
    } finally { setLoading(false); }
  };

  const activeData = currentView === "predictions" ? predictionData : uploadedData;

  const buildChartData = useCallback((fields) => {
    const source = currentView === "predictions" ? predictionData : uploadedData;
    if (!source?.length) return { labels: [], datasets: [] };
    return {
      labels: source.map(r => r.predicted_time || r.utc_time || ""),
      datasets: fields.map(field => ({
        label: field, fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5, borderWidth: 1.5,
        data: source.map(r => { const v = parseFloat(r[field]); return isFinite(v) ? v : 0; }),
        borderColor: COLORS[field] || "#94a3b8",
        backgroundColor: `${COLORS[field] || "#94a3b8"}18`,
      })),
    };
  }, [predictionData, uploadedData, currentView]);

  const ephemerisChartData = useMemo(() => buildChartData(["x_error", "y_error", "z_error"]), [buildChartData]);
  const satclockChartData  = useMemo(() => buildChartData(["satclockerror"]), [buildChartData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", labels: { boxWidth: 10, font: { size: 11, family: "monospace" }, color: "rgba(255,255,255,0.9)", padding: 20 } },
      tooltip: {
        backgroundColor: "rgba(7,13,26,0.95)", borderColor: "rgba(255,255,255,0.4)", borderWidth: 1,
        titleColor: "#f1f5f9", bodyColor: "rgba(255,255,255,0.9)", padding: 12,
        titleFont: { family: "monospace", size: 11 }, bodyFont: { family: "monospace", size: 11 },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10, maxRotation: 45, font: { size: 10, family: "monospace" }, color: "rgba(255,255,255,0.55)" },
        grid: { color: "rgba(255,255,255,0.4)" }, border: { color: "rgba(255,255,255,0.4)" },
      },
      y: {
        ticks: { font: { size: 10, family: "monospace" }, color: "rgba(255,255,255,0.55)" },
        grid: { color: "rgba(255,255,255,0.4)" }, border: { color: "rgba(255,255,255,0.4)" },
      },
    },
  }), []);

  const getSatclockRMSE = () => {
    if (accuracyMetrics?.satclockerror?.rmse != null) return accuracyMetrics.satclockerror.rmse.toFixed(7);
    if (!predictionData.length) return "N/A";
    return Math.sqrt(predictionData.reduce((s, r) => s + (parseFloat(r.satclockerror) || 0) ** 2, 0) / predictionData.length).toFixed(7);
  };
  const getSatclockMAE = () => {
    if (accuracyMetrics?.satclockerror?.mae != null) return accuracyMetrics.satclockerror.mae.toFixed(7);
    if (!predictionData.length) return "N/A";
    return (predictionData.reduce((s, r) => s + Math.abs(parseFloat(r.satclockerror) || 0), 0) / predictionData.length).toFixed(7);
  };
  const getAxisRMSE = (ax) => {
    if (accuracyMetrics?.per_axis?.[ax]?.rmse != null) return accuracyMetrics.per_axis[ax].rmse.toFixed(4);
    if (!predictionData.length) return "N/A";
    return Math.sqrt(predictionData.reduce((s, r) => s + (parseFloat(r[ax]) || 0) ** 2, 0) / predictionData.length).toFixed(4);
  };
  const getAxisMAE = (ax) => {
    if (accuracyMetrics?.per_axis?.[ax]?.mae != null) return accuracyMetrics.per_axis[ax].mae.toFixed(4);
    if (!predictionData.length) return "N/A";
    return (predictionData.reduce((s, r) => s + Math.abs(parseFloat(r[ax]) || 0), 0) / predictionData.length).toFixed(4);
  };
  const get3DRMSE = () => {
    if (accuracyMetrics?.three_dimensional?.rmse != null) return accuracyMetrics.three_dimensional.rmse.toFixed(4);
    if (!predictionData.length) return "N/A";
    return Math.sqrt(predictionData.reduce((s, r) => { const x = parseFloat(r.x_error)||0, y = parseFloat(r.y_error)||0, z = parseFloat(r.z_error)||0; return s + x*x+y*y+z*z; }, 0) / predictionData.length).toFixed(4);
  };
  const get3DMAE = () => {
    if (accuracyMetrics?.three_dimensional?.mae != null) return accuracyMetrics.three_dimensional.mae.toFixed(4);
    if (!predictionData.length) return "N/A";
    return (predictionData.reduce((s, r) => { const x = parseFloat(r.x_error)||0, y = parseFloat(r.y_error)||0, z = parseFloat(r.z_error)||0; return s + Math.sqrt(x*x+y*y+z*z); }, 0) / predictionData.length).toFixed(4);
  };

  const sampleSize = accuracyMetrics?.sample_size ?? predictionData.length ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#f1f5f9", position: "relative", fontFamily: '"DM Mono", "IBM Plex Mono", monospace' }}>
      <StarfieldBackground />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@700;800&display=swap');

        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes floatA     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(22px,-16px) scale(1.07)} }
        @keyframes floatB     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-16px,22px) scale(1.05)} }
        @keyframes shimmerTxt { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes shimmerNaviC { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes borderFlow {
          0%,100%{background-position:0% 50%}
          50%{background-position:100% 50%}
        }
        @keyframes pulse2     { 0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0.25)} 50%{box-shadow:0 0 0 8px rgba(56,189,248,0)} }

        .glow-a { animation: floatA 11s ease-in-out infinite; }
        .glow-b { animation: floatB 15s ease-in-out infinite 2s; }

        .hero-title {
          font-family: 'Syne', sans-serif;
          background: linear-gradient(100deg, #f1f5f9 0%, #38bdf8 38%, #818cf8 68%, #f1f5f9 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerTxt 5s linear infinite;
        }

        .upload-card {
          position: relative; border-radius: 16px; padding: 28px; overflow: hidden;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .upload-card::before {
          content: '';
          position: absolute; inset: -1px; border-radius: inherit; padding: 1px; z-index: 0;
          background: linear-gradient(135deg, rgba(56,189,248,0.45) 0%, rgba(129,140,248,0.25) 50%, rgba(56,189,248,0.45) 100%);
          background-size: 200% 200%;
          animation: borderFlow 4s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }

        .drop-zone {
          border: 1.5px dashed rgba(255,255,255,0.2);
          border-radius: 12px; padding: 28px 16px; text-align: center;
          transition: all 0.25s; cursor: pointer;
          background: rgba(255,255,255,0.015);
        }
        .drop-zone:hover, .drop-zone.dragging {
          border-color: rgba(56,189,248,0.45);
          background: rgba(56,189,248,0.04);
        }

        .submit-btn {
          width: 100%; padding: 13px 0; border-radius: 10px; border: none;
          font-weight: 600; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          font-family: 'DM Mono', monospace; letter-spacing: 0.04em;
          transition: all 0.2s;
        }
        .submit-btn.active {
          background: linear-gradient(135deg, rgba(56,189,248,0.2), rgba(129,140,248,0.16));
          border: 1px solid rgba(56,189,248,0.38);
          color: #f1f5f9;
          box-shadow: 0 0 28px rgba(56,189,248,0.14);
          animation: pulse2 2.5s ease-in-out infinite;
        }
        .submit-btn.disabled {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.35);
          cursor: not-allowed;
        }

        .toggle-btn {
          padding: 8px 22px; border: none; cursor: pointer;
          font-family: 'DM Mono', monospace; font-size: 12px;
          letter-spacing: 0.05em; transition: all 0.2s;
        }
        .toggle-btn.active {
          background: rgba(56,189,248,0.14);
          color: #38bdf8;
        }
        .toggle-btn.inactive {
          background: transparent;
          color: rgba(255,255,255,0.7);
        }
        .toggle-btn.inactive:hover { background: rgba(255,255,255,0.04); }

        .data-row { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .data-row:hover td { background: rgba(56,189,248,0.03) !important; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.32); }
      `}</style>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="glow-a" style={{ position: "absolute", top: "-8%", left: "12%", width: 640, height: 640, borderRadius: "50%", opacity: 0.065, background: "radial-gradient(circle, #38bdf8 0%, transparent 65%)" }} />
        <div className="glow-b" style={{ position: "absolute", bottom: "5%", right: "8%", width: 520, height: 520, borderRadius: "50%", opacity: 0.045, background: "radial-gradient(circle, #818cf8 0%, transparent 65%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar />

        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 24px 100px" }}>

          {/* ── HERO ─────────────────────────────────────────────────── */}
          <motion.div
            style={{ marginBottom: 64 }}
            initial={{ opacity: 0, y: 52 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, ease: EXPO_OUT }}
          >
            <motion.div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 999, marginBottom: 22,
                border: "1px solid rgba(56,189,248,0.22)",
                background: "rgba(56,189,248,0.06)",
              }}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: BACK_OUT }}
            >
              <motion.span
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(56,189,248,0.85)", fontFamily: "monospace" }}>
                NaviC · GNSS Error Prediction Engine
              </span>
            </motion.div>

            <h1 className="hero-title" style={{ fontSize: "clamp(36px,5vw,58px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18, maxWidth: 680 }}>
              Ephemeris &amp; Clock Error Predictor
            </h1>

            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, maxWidth: 480, fontWeight: 300 }}>
              Upload orbital telemetry CSV · Hybrid LSTM / Transformer inference ·
              Real-time ephemeris error &amp; satellite clock prediction
            </p>

            <motion.div
              style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.6 }}
            >
              {["SGP4 Propagation", "Dual-Model AI", "X/Y/Z Ephemeris", "Clock Drift", "Rolling RMSE"].map((pill, i) => (
                <motion.span
                  key={pill}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.07, duration: 0.45, ease: EXPO_OUT }}
                  style={{
                    padding: "4px 12px", borderRadius: 99, fontSize: 11,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {pill}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>

          {/* ── UPLOAD + METRIC CARDS ROW ─────────────────────────── */}
          <Stagger stagger={0.1} delayStart={0.1}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18, marginBottom: 28 }}
          >
            <motion.div variants={fadeUp} className="upload-card">
              <div style={{ position: "relative", zIndex: 1 }}>
                <SectionLabel eyebrow="Data Input" title="Upload CSV File" accent="#38bdf8" />
                <div
                  className={`drop-zone${isDragging ? " dragging" : ""}`}
                  onClick={() => !selectedFile && fileInputRef.current?.click()}
                  onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  style={{ cursor: selectedFile ? "default" : "pointer", marginBottom: 14 }}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileInputChange} style={{ display: "none" }} />
                  <AnimatePresence mode="wait">
                    {selectedFile ? (
                      <motion.div key="sel" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ fontSize: 30, marginBottom: 10 }}>📄</div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#38bdf8", marginBottom: 4, wordBreak: "break-all" }}>{selectedFile.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>{formatFileSize(selectedFile.size)}</div>
                        <motion.button
                          onClick={clearFile}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.07)", color: "#f87171", cursor: "pointer", fontSize: 11 }}
                        >
                          Remove
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>⬆</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 5, fontWeight: 500 }}>
                          Drop CSV file or click to browse
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Max 10 MB · CSV only</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={handleSubmit}
                  disabled={loading || !selectedFile}
                  whileHover={!loading && selectedFile ? { scale: 1.02 } : {}}
                  whileTap={!loading && selectedFile ? { scale: 0.97 } : {}}
                  className={`submit-btn ${!loading && selectedFile ? "active" : "disabled"}`}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.18)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.75s linear infinite", display: "inline-block" }} />
                      Computing…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/><path d="M12 6v6l4 2" strokeLinecap="round"/></svg>
                      Execute Prediction Analysis
                    </>
                  )}
                </motion.button>

                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ marginTop: 12, padding: "9px 14px", borderRadius: 9, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.22)", color: "#34d399", fontSize: 12, textAlign: "center" }}
                    >
                      ✓ Analysis complete · {predictionData.length} predictions
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {performanceMetrics && (
              <MetricCard label="LSTM Architecture" value={performanceMetrics.lstm_usage} sublabel={`${performanceMetrics.lstm_percentage}% of total predictions`} accent="#38bdf8" />
            )}
            {performanceMetrics && (
              <MetricCard label="Transformer Architecture" value={performanceMetrics.transformer_usage} sublabel={`${performanceMetrics.transformer_percentage}% of total predictions`} accent="#818cf8" />
            )}
          </Stagger>

          {/* ── RESULTS ──────────────────────────────────────────────── */}
          <AnimatePresence>
            {predictionData.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                <Reveal y={20} delay={0.05} style={{ textAlign: "center" }}>
                  <div style={{ display: "inline-flex", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    {[["predictions", "Prediction Output"], ["input", "Input Dataset"]].map(([v, label]) => (
                      <button
                        key={v}
                        onClick={() => setCurrentView(v)}
                        className={`toggle-btn ${currentView === v ? "active" : "inactive"}`}
                        style={{ borderRight: v === "predictions" ? "1px solid rgba(255,255,255,0.07)" : "none" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Reveal>

                {/* Ephemeris chart */}
                <Reveal y={36} delay={0.06}>
                  <ChartCard accent="#38bdf8">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                      <SectionLabel eyebrow="Orbital Position" title="Ephemeris Error Analysis — X · Y · Z" accent="#38bdf8" />
                      <div style={{ display: "flex", gap: 8 }}>
                        {["x_error", "y_error", "z_error"].map(ax => (
                          <span key={ax} style={{
                            padding: "3px 10px", borderRadius: 99, fontSize: 10,
                            border: `1px solid ${COLORS[ax]}35`,
                            background: `${COLORS[ax]}0d`,
                            color: COLORS[ax], letterSpacing: "0.1em",
                          }}>
                            {ax.replace("_error", "").toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Line data={ephemerisChartData} options={chartOptions} />

                    {/* NaviC Button */}
                    <ShinyNaviCButton href="https://devsanjay09.github.io/NaviC/" />
                  </ChartCard>
                </Reveal>

                {/* Clock chart */}
                <Reveal y={36} delay={0.08}>
                  <ChartCard accent="#fb923c">
                    <SectionLabel eyebrow="Temporal Precision" title="Satellite Clock Error — seconds" accent="#fb923c" />
                    <Line data={satclockChartData} options={chartOptions} />
                  </ChartCard>
                </Reveal>

                {/* Accuracy metrics */}
                <Reveal y={28} delay={0.06}>
                  <ChartCard accent="#34d399">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
                      <SectionLabel eyebrow="Model Evaluation" title="Accuracy Metrics — RMSE &amp; MAE" accent="#34d399" />
                      <span style={{
                        padding: "4px 12px", borderRadius: 8, fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.7)",
                      }}>
                        n = {sampleSize}
                      </span>
                    </div>

                    <Stagger stagger={0.08}
                      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}
                    >
                      <motion.div variants={fadeUp} style={{
                        background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.18)",
                        borderRadius: 12, padding: "18px 20px",
                      }}>
                        <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(251,180,100,1)", marginBottom: 14, fontFamily: "monospace" }}>
                          Satclock (s)
                        </p>
                        {[["RMSE", getSatclockRMSE()], ["MAE", getSatclockMAE()]].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12 }}>
                            <span style={{ color: "rgba(255,255,255,0.7)" }}>{k}</span>
                            <span style={{ color: "#fb923c", fontFamily: "monospace", fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </motion.div>

                      <motion.div variants={fadeUp} style={{
                        background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.18)",
                        borderRadius: 12, padding: "18px 20px",
                      }}>
                        <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(56,189,248,1)", marginBottom: 14, fontFamily: "monospace" }}>
                          Ephemeris 3D (m)
                        </p>
                        {[["RMSE", get3DRMSE()], ["MAE", get3DMAE()]].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12 }}>
                            <span style={{ color: "rgba(255,255,255,0.7)" }}>{k}</span>
                            <span style={{ color: "#38bdf8", fontFamily: "monospace", fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </motion.div>

                      <motion.div variants={fadeUp} style={{
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12, padding: "18px 20px",
                      }}>
                        <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 14, fontFamily: "monospace" }}>
                          Axis-level (m)
                        </p>
                        {["x_error", "y_error", "z_error"].map(ax => (
                          <div key={ax} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 11 }}>
                            <span style={{ color: COLORS[ax], letterSpacing: "0.1em", fontFamily: "monospace", fontSize: 10 }}>
                              {ax.replace("_error", "").toUpperCase()}
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "monospace", display: "flex", gap: 10 }}>
                              <span>{getAxisRMSE(ax)}</span>
                              <span style={{ opacity: 0.3 }}>·</span>
                              <span>{getAxisMAE(ax)}</span>
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    </Stagger>
                  </ChartCard>
                </Reveal>

                {/* Data table */}
                <Reveal y={28} delay={0.05}>
                  <ChartCard accent="#818cf8">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                      <SectionLabel
                        eyebrow={currentView === "predictions" ? "Model Inference Output" : "Uploaded Telemetry"}
                        title={currentView === "predictions" ? "Prediction Output" : "Input Dataset"}
                        accent="#818cf8"
                      />
                      <span style={{
                        padding: "4px 12px", borderRadius: 8, fontSize: 11,
                        background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.22)",
                        color: "#818cf8", fontFamily: "monospace", fontWeight: 500,
                      }}>
                        {activeData.length} records
                      </span>
                    </div>

                    <div style={{ maxHeight: 500, overflowY: "auto", overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr>
                            {activeData.length > 0 && Object.keys(activeData[0]).map(col => (
                              <th key={col} style={{
                                padding: "10px 16px", fontWeight: 600, textAlign: "left",
                                fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                                color: "rgba(255,255,255,0.7)", borderBottom: "1px solid rgba(255,255,255,0.06)",
                                position: "sticky", top: 0, background: "rgba(6,12,24,0.97)",
                                whiteSpace: "nowrap", fontFamily: "monospace",
                              }}>
                                {col.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeData.map((row, i) => (
                            <tr key={i} className="data-row">
                              {Object.entries(row).map(([k, v], j) => {
                                const isModel = currentView === "predictions" && k.toLowerCase() === "model_used";
                                const isLSTM = isModel && v === "LSTM";
                                const isTransformer = isModel && v === "Transformer";
                                const isTime = k.toLowerCase().includes("time");
                                let display = v;
                                if (!isModel && !isTime) { const n = Number(v); if (isFinite(n)) display = n.toFixed(6); }
                                return (
                                  <td key={j} style={{
                                    padding: "9px 16px", fontFamily: "monospace", fontSize: 11,
                                    whiteSpace: "nowrap",
                                    color: isLSTM ? "#38bdf8" : isTransformer ? "#fb923c" : "rgba(255,255,255,0.75)",
                                    fontWeight: isModel ? 600 : 300,
                                    background: isLSTM ? "rgba(56,189,248,0.04)" : isTransformer ? "rgba(251,146,60,0.04)" : "transparent",
                                    borderLeft: isLSTM ? "2px solid rgba(56,189,248,0.3)" : isTransformer ? "2px solid rgba(251,146,60,0.3)" : "none",
                                  }}>
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </Reveal>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}