import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiMail, FiLock, FiLogIn, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { Meteors } from "@/components/ui/meteors";

import "@fontsource/orbitron/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";

export default function Login() {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { loginWithEmail, loginWithGoogle } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || "/dashboard";

  /* ── Email/password login ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.code === "auth/user-not-found"   ? "No account with that email."
                : err.code === "auth/wrong-password"    ? "Incorrect password."
                : err.code === "auth/invalid-email"     ? "Invalid email address."
                : err.code === "auth/too-many-requests" ? "Too many attempts. Try later."
                : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Google login ── */
  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Meteors full-screen background ── */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black">
        <Meteors number={30} />
      </div>

      {/* ── Subtle radial vignette ── */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%)" }}
      />

      {/* ── Navbar ── */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* ── Page content ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <div className="relative w-full max-w-105">

          {/* Card aura glow */}
          <div
            className="absolute -inset-10 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, rgba(100,180,255,0.06), transparent 65%)",
              filter: "blur(30px)",
            }}
          />

          {/* ── Card ── */}
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(32px)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            {/* Top shimmer line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }}
            />

            <div className="px-9 py-10">

              {/* ── Logo + Title ── */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: "0 0 40px rgba(100,200,255,0.2)", filter: "blur(8px)" }} />
                  <Link to="/">
                    <img
                      src="/logo.png"
                      alt="OrbitXOS"
                      className="relative w-14 h-14 rounded-full object-cover"
                      style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                    />
                  </Link>
                </div>
                <h1
                  className="font-orbitron text-2xl font-bold tracking-[0.2em] text-white mb-1"
                  style={{ textShadow: "0 0 40px rgba(180,220,255,0.5)" }}
                >
                  ORBITXOS
                </h1>
                <p className="text-[11px] tracking-[0.35em] uppercase font-inter" style={{ color: "rgba(150,180,220,0.6)" }}>
                  Mission Control Access
                </p>
              </div>

              {/* Divider */}
              <div className="mb-7 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />

              {/* ── Error ── */}
              {error && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-5 text-xs font-inter"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "rgba(252,165,165,0.9)" }}
                >
                  <FiAlertCircle size={14} className="shrink-0" /> {error}
                </div>
              )}

              {/* ── Google button ── */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="relative w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-inter text-sm font-medium text-white transition-all duration-300 mb-5 overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {googleLoading ? (
                  <span className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70" style={{ animation: "spin 0.7s linear infinite" }} />
                    Connecting to Google...
                  </span>
                ) : (
                  <>
                    <FcGoogle size={18} />
                    Continue with Google
                  </>
                )}
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-[10px] tracking-widest uppercase font-inter" style={{ color: "rgba(150,170,200,0.35)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              {/* ── Email/Password form ── */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] tracking-[0.25em] uppercase font-inter" style={{ color: "rgba(180,200,230,0.5)" }}>Email Address</label>
                  <div className="relative">
                    <FiMail size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "rgba(150,180,220,0.45)" }} />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@mission.space" autoComplete="email"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm text-white font-inter outline-none transition-all duration-300"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", caretColor: "#fff" }}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(120,180,255,0.35)"; e.target.style.background = "rgba(255,255,255,0.055)"; e.target.style.boxShadow = "0 0 0 3px rgba(100,160,255,0.07)"; }}
                      onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.07)";  e.target.style.background = "rgba(255,255,255,0.03)";  e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] tracking-[0.25em] uppercase font-inter" style={{ color: "rgba(180,200,230,0.5)" }}>Password</label>
                    <Link to="/forgot-password" className="text-[10px] font-inter transition-colors duration-200"
                      style={{ color: "rgba(120,160,220,0.55)" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "rgba(180,210,255,0.9)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "rgba(120,160,220,0.55)"}
                    >Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <FiLock size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "rgba(150,180,220,0.45)" }} />
                    <input
                      type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••" autoComplete="current-password"
                      className="w-full pl-11 pr-11 py-3.5 rounded-2xl text-sm text-white font-inter outline-none transition-all duration-300"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", caretColor: "#fff" }}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(120,180,255,0.35)"; e.target.style.background = "rgba(255,255,255,0.055)"; e.target.style.boxShadow = "0 0 0 3px rgba(100,160,255,0.07)"; }}
                      onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.07)";  e.target.style.background = "rgba(255,255,255,0.03)";  e.target.style.boxShadow = "none"; }}
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
                      style={{ color: "rgba(150,180,220,0.4)" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "rgba(200,220,255,0.8)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "rgba(150,180,220,0.4)"}
                    >
                      {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={loading || googleLoading}
                  className="relative flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-orbitron text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 mt-1 overflow-hidden"
                  style={{
                    background: loading ? "rgba(255,255,255,0.45)" : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(220,235,255,0.95) 100%)",
                    color: "#0a0a0f",
                    boxShadow: loading ? "none" : "0 0 30px rgba(180,210,255,0.2), 0 8px 32px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.boxShadow = "0 0 50px rgba(180,210,255,0.35), 0 12px 40px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-1px) scale(1.01)"; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(180,210,255,0.2), 0 8px 32px rgba(0,0,0,0.3)"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)", backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite" }} />
                  {loading ? (
                    <span className="flex items-center gap-2.5 relative z-10">
                      <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: "rgba(0,0,0,0.2)", borderTopColor: "#0a0a0f", animation: "spin 0.7s linear infinite" }} />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2.5 relative z-10">
                      <FiLogIn size={14} /> Log In to Mission
                    </span>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-[10px] tracking-widest uppercase font-inter" style={{ color: "rgba(150,170,200,0.35)" }}>new here?</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              <p className="text-center text-xs font-inter" style={{ color: "rgba(150,170,200,0.5)" }}>
                No account yet?{" "}
                <Link to="/signup" className="font-medium transition-all duration-200" style={{ color: "rgba(180,210,255,0.8)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.textShadow = "0 0 20px rgba(180,210,255,0.6)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(180,210,255,0.8)"; e.currentTarget.style.textShadow = "none"; }}
                >Create account →</Link>
              </p>

            </div>
          </div>

          {/* Bottom label */}
          <p className="text-center mt-5 text-[10px] tracking-[0.3em] uppercase font-inter" style={{ color: "rgba(150,170,200,0.2)" }}>
            Secured · Encrypted · Orbital
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        input::placeholder { color: rgba(150,170,210,0.3); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px rgba(10,10,20,0.95) inset !important;
          -webkit-text-fill-color: #fff !important;
        }
      `}</style>
    </div>
  );
}