import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import { LogIn, ShieldAlert } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    try {
      await login(email.trim(), password);
      }
     catch (err) {
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
        <h2 className="text-center font-bold text-lg mb-6" style={{ color: "var(--text-primary)" }}>
          Sign In
        </h2>
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
            ) : (
              <>
                <UserPlus size={18} />
                <span>Create Student Account</span>
              </>
            )}
          </button>
        </form>

        
      </div>

    </div>
  );
}
