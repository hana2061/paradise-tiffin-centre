import React, { createContext, useContext, useState, useEffect } from "react";
import { dbService } from "../services/db";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes (supports Firebase & Mock fallback)
    const unsubscribe = dbService.onAuth((user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh student profile details on-the-fly
  const refreshUser = async () => {
    if (currentUser && currentUser.role === "student") {
      try {
        const profile = await dbService.getStudentProfile(currentUser.uid);
        if (profile) {
          setCurrentUser(prev => ({ ...prev, ...profile }));
        }
      } catch (err) {
        console.error("Error refreshing student balance:", err);
      }
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const user = await dbService.login(email, password);
      setCurrentUser(user);
      return user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (email, password, name) => {
    setLoading(true);
    try {
      const user = await dbService.registerStudent(email, password, name);
      setCurrentUser(user);
      return user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await dbService.logout();
      setCurrentUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
