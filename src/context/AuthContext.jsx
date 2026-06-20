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
  // Ask for notification permission and save the device token to Firestore
  const registerNotifications = async (user) => {
    try {
      const { getMessagingSafe } = await import("../firebase");
      const messaging = await getMessagingSafe();
      if (!messaging) return; // not supported on this device/browser

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const { getToken } = await import("firebase/messaging");
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_FCM_VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });

      if (token) {
        await dbService.registerFCMToken(user.uid, token);
      }
    } catch (err) {
      console.warn("Notification registration skipped:", err);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const user = await dbService.login(email, password);
      setCurrentUser(user);
      registerNotifications(user); // Register for push notifications after login
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
