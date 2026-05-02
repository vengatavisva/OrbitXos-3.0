import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiMail,
  FiLock,
  FiUser,
  FiUserPlus,
  FiAlertCircle,
  FiCheck,
  FiEye,
  FiEyeOff
} from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { Meteors } from "@/components/ui/meteors";

import "@fontsource/orbitron/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";

/* ---------- Reusable Input Field ---------- */
function Field({ label, icon, type, value, onChange, placeholder, right }) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-[10px] tracking-[0.25em] uppercase font-inter"
        style={{ color: "rgba(180,200,230,0.5)" }}
      >
        {label}
      </label>

      <div className="relative">
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "rgba(150,180,220,0.45)" }}
        >
          {icon}
        </span>

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="
            w-full pl-11 py-3.5 rounded-2xl text-sm text-white font-inter
            outline-none transition-all duration-300
            bg-white/5 border border-white/10
            focus:border-blue-400/40
            focus:ring-2 focus:ring-blue-400/20
          "
          style={{
            paddingRight: right ? "2.75rem" : "1rem",
            caretColor: "#fff"
          }}
        />

        {right && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Signup Page ---------- */
export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signupWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await signupWithEmail(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg =
        err.code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : err.code === "auth/invalid-email"
          ? "Invalid email address."
          : err.code === "auth/weak-password"
          ? "Password is too weak."
          : "Signup failed. Please try again.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const passwordsMatch = confirm.length > 0 && password === confirm;

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">

      {/* Meteors background */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black">
        <Meteors number={30} />
      </div>

      {/* Navbar */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-md">

          <div
            className="rounded-3xl px-9 py-10"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(32px)"
            }}
          >

            <h1 className="font-orbitron text-2xl text-white text-center mb-6">
              ORBITXOS
            </h1>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 bg-red-500/10 text-red-300 text-xs">
                <FiAlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Google Signup */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-white bg-white/5 border border-white/10 hover:bg-white/10 mb-5"
            >
              <FcGoogle size={18} />
              Sign up with Google
            </button>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <Field
                label="Full Name"
                icon={<FiUser size={14} />}
                type="text"
                value={name}
                onChange={setName}
                placeholder="Neil Armstrong"
              />

              <Field
                label="Email"
                icon={<FiMail size={14} />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@mission.space"
              />

              <Field
                label="Password"
                icon={<FiLock size={14} />}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Minimum 6 characters"
                right={
                  <button type="button" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                }
              />

              <Field
                label="Confirm Password"
                icon={<FiLock size={14} />}
                type={showCf ? "text" : "password"}
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat password"
                right={
                  <button type="button" onClick={() => setShowCf(!showCf)}>
                    {showCf ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                }
              />

              {confirm && (
                <p
                  className="text-xs"
                  style={{
                    color: passwordsMatch
                      ? "rgba(52,211,153,0.9)"
                      : "rgba(252,165,165,0.9)"
                  }}
                >
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 rounded-xl font-orbitron bg-white text-black"
              >
                {loading ? "Creating account..." : "Launch My Account"}
              </button>
            </form>

            <p className="text-center text-xs mt-6 text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-300">
                Login
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}