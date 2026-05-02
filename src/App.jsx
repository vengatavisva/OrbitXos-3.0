import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home          from "./pages/Home";
import Dashboard     from "./pages/Dashboard";
import Predictions   from "./pages/Predictions";
import AIPredictor   from "./pages/AIPredictor";
import About         from "./pages/About";
import ErrorPrediction from "./pages/ErrorPrediction";
import ReEntry       from "./pages/ReEntry";
import Login         from "./pages/Login";
import Signup        from "./pages/Signup";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ── Public routes ───────────────────────────── */}
          <Route path="/"       element={<Home />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* ── Protected routes — must be logged in ────── */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/predictions" element={
            <ProtectedRoute><Predictions /></ProtectedRoute>
          } />
          <Route path="/aipredictor" element={
            <ProtectedRoute><AIPredictor /></ProtectedRoute>
          } />
          <Route path="/error-prediction" element={
            <ProtectedRoute><ErrorPrediction /></ProtectedRoute>
          } />
          <Route path="/reentry" element={
            <ProtectedRoute><ReEntry /></ProtectedRoute>
          } />
          <Route path="/about" element={
            <ProtectedRoute><About /></ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}