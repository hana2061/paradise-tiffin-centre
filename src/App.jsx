import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import OwnerDashboard from "./pages/OwnerDashboard";

function AppContent() {
  const { currentUser } = useAuth();

  return (
    <div className="app-container">
      {!currentUser ? (
        <Login />
      ) : currentUser.role === "owner" ? (
        <div className="dashboard-shell">
          <OwnerDashboard />
        </div>
      ) : (
        <div className="dashboard-shell">
          <StudentDashboard />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
