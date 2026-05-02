import { useState, useRef, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  FiMenu, FiX, FiHome, FiInfo, FiActivity,
  FiUser, FiLogIn, FiUserPlus, FiLogOut, FiSettings, FiChevronsDown
} from "react-icons/fi";
import { SiTensorflow } from "react-icons/si";
import { Radar, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [open, setOpen]       = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const authRef  = useRef(null);
  const navigate = useNavigate();

  // ── Real Firebase auth state ─────────────────────────────────────────────
  const { user, isLoggedIn, logout } = useAuth();

  const handleLogout = async () => {
    setAuthOpen(false);
    setOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  const links = [
    { name: "Home",             icon: <FiHome size={14} />,        path: "/" },
    { name: "Dashboard",        icon: <Radar size={14} />,          path: "/dashboard" },
    { name: "Predictions",      icon: <AlertTriangle size={14} />,  path: "/predictions" },
    { name: "Error Prediction", icon: <FiActivity size={14} />,     path: "/error-prediction" },
    { name: "AIPredictor",      icon: <SiTensorflow size={14} />,   path: "/aipredictor" },
    { name: "Re-Entry",         icon: <FiChevronsDown size={14} />, path: "/reentry" },
    { name: "About",            icon: <FiInfo size={14} />,         path: "/about" },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (authRef.current && !authRef.current.contains(e.target)) setAuthOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Display name: Firebase displayName → email prefix → fallback
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Astronaut";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <header
      className="fixed top-4 left-1/2 -translate-x-1/2 w-[96%] z-50 rounded-2xl px-4 py-2.5 transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.11)",
        boxShadow: "0 0 30px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center gap-3">

        {/* ── LEFT: Logo ── */}
        <Link to="/" className="hidden md:flex items-center gap-2 shrink-0">
          <img
            src="/logo.png" alt="OrbitXOS Logo"
            className="w-8 h-8 object-cover rounded-full"
            style={{ boxShadow: "0 0 12px rgba(255,255,255,0.25)" }}
          />
          <span className="font-orbitron text-sm font-semibold text-white tracking-widest hidden lg:block">
            OrbitXOS
          </span>
        </Link>

        {/* ── CENTER: Nav links ── */}
        <nav className="hidden md:flex items-center flex-1 justify-center gap-0.5 min-w-0">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              end={link.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-200 font-inter
                ${isActive
                  ? "text-white bg-white/10 border border-white/14"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {link.icon}
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* ── RIGHT: Auth dropdown ── */}
        <div className="relative shrink-0 hidden md:block" ref={authRef}>
          <button
            onMouseEnter={() => setAuthOpen(true)}
            onMouseLeave={() => setAuthOpen(false)}
            onClick={() => setAuthOpen((v) => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
            style={{
              border: "1px solid rgba(255,255,255,0.13)",
              background: authOpen ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
              boxShadow: authOpen ? "0 0 16px rgba(255,255,255,0.12)" : "none",
            }}
          >
            {isLoggedIn ? (
              user?.photoURL ? (
                <img src={user.photoURL} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-orbitron text-white"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.06))",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {avatarLetter}
                </div>
              )
            ) : (
              <FiUser size={16} className="text-gray-300" />
            )}
          </button>

          {/* Dropdown panel */}
          {authOpen && (
            <div
              className="absolute right-0 top-full pt-2"
              onMouseEnter={() => setAuthOpen(true)}
              onMouseLeave={() => setAuthOpen(false)}
              style={{ zIndex: 60 }}
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  width: "176px",
                  background: "rgba(8,8,8,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                  animation: "dropIn 0.16s ease-out",
                }}
              >
                {/* ── GUEST ── */}
                {!isLoggedIn ? (
                  <div className="p-2 flex flex-col gap-1.5">
                    <p className="text-[10px] text-gray-600 font-inter tracking-widest uppercase px-2 pt-1 pb-0.5">Account</p>
                    <button
                      onClick={() => { navigate("/login"); setAuthOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all font-inter"
                      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                    >
                      <FiLogIn size={13} /> Log In
                    </button>
                    <button
                      onClick={() => { navigate("/signup"); setAuthOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-black transition-all font-orbitron"
                      style={{ background: "rgba(255,255,255,0.92)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 18px rgba(255,255,255,0.35)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.92)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <FiUserPlus size={13} /> Sign Up
                    </button>
                  </div>

                ) : (
                  /* ── LOGGED IN ── */
                  <>
                    {/* User info header */}
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-[10px] text-gray-500 font-inter">Signed in as</p>
                      <p className="text-sm text-white font-medium font-inter truncate">{displayName}</p>
                      {user?.email && (
                        <p className="text-[10px] text-gray-600 font-inter truncate mt-0.5">{user.email}</p>
                      )}
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                    
                      {/* Sign Out */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all font-inter"
                        >
                          <FiLogOut size={13} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MOBILE: Logo + Hamburger ── */}
        <Link to="/" className="md:hidden flex items-center gap-2 mx-auto">
          <img src="/logo.png" alt="OrbitXOS" className="w-7 h-7 rounded-full object-cover" />
          <span className="font-orbitron text-sm font-semibold text-white tracking-widest">OrbitXOS</span>
        </Link>
        <button className="md:hidden text-white p-1 shrink-0" onClick={() => setOpen(!open)} aria-label="Toggle Menu">
          {open ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </div>

      {/* ── MOBILE DROPDOWN ── */}
      {open && (
        <div
          className="md:hidden mt-3 rounded-xl overflow-hidden"
          style={{
            background: "rgba(5,5,5,0.97)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            animation: "dropIn 0.18s ease-out",
          }}
        >
          <div className="px-3 py-3 flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                end={link.path === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 text-sm py-2.5 px-3 rounded-lg transition-all font-inter
                  ${isActive
                    ? "text-white bg-white/10 border border-white/12"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {link.icon}
                {link.name}
              </NavLink>
            ))}
          </div>

          {/* Mobile auth buttons */}
          <div className="px-3 pb-3 pt-1 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => { navigate("/login"); setOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-gray-300 font-inter"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <FiLogIn size={13} /> Log In
                </button>
                <button
                  onClick={() => { navigate("/signup"); setOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-black font-orbitron"
                  style={{ background: "rgba(255,255,255,0.92)" }}
                >
                  <FiUserPlus size={13} /> Sign Up
                </button>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-red-400 font-inter"
                style={{ border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <FiLogOut size={13} /> Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}