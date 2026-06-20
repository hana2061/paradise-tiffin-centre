import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import { LogIn, UserPlus, ShieldAlert, Coffee } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (isRegister && !name) {
      setError("Please enter your name.");
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  // Quick fill demo credentials
  const fillCredentials = (role) => {
    setError("");
    if (role === "owner") {
      setEmail("owner@paradise.com");
      setPassword("owner123");
      setIsRegister(false);
    } else {
      setEmail("rahul@paradise.com");
      setPassword("student123");
      setIsRegister(false);
    }
  };

  return (
    <div className="login-page">
      {/* Brand Header & Logo */}
      <div className="login-brand">
        <Logo size={110} className="login-logo" />
        <h1 className="login-title heading-font">Paradise Tiffin Centre</h1>
        <p className="login-tagline">Fresh, Homestyle Food Delivered to Students Daily</p>
      </div>

      {/* Main Auth Card */}
      <div className="card login-card">
        {/* Switcher Tab */}
        <div className="flex mb-6 border-b" style={{ borderColor: "var(--border-color)" }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(""); }}
            className="flex-1 pb-3 text-center font-bold text-sm uppercase tracking-wider"
            style={{
              color: !isRegister ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: !isRegister ? "3px solid var(--accent)" : "none",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(""); }}
            className="flex-1 pb-3 text-center font-bold text-sm uppercase tracking-wider"
            style={{
              color: isRegister ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: isRegister ? "3px solid var(--accent)" : "none",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm"
            style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(201, 59, 43, 0.15)" }}
          >
            <ShieldAlert size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="name-input">Full Name</label>
              <input
                id="name-input"
                type="text"
                className="form-input"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address</label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="e.g. rahul@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn mt-2" disabled={loading}>
            {loading ? (
              <span className="animate-pulse">Loading...</span>
            ) : isRegister ? (
              <>
                <UserPlus size={18} />
                <span>Create Student Account</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In to Tiffin</span>
              </>
            )}
          </button>
        </form>

        {isRegister && (
          <div className="mt-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--accent)", fontWeight: "bold" }}>🎉 Welcome:</span> Create your student account here and verify your tiffin subscription details with the owner.
          </div>
        )}
      </div>

    </div>
  );
}
