import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { dbService } from "../services/db";
import Navbar from "../components/Navbar";
import { 
  Utensils, 
  User, 
  LogOut, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Calendar,
  CreditCard
} from "lucide-react";

export default function StudentDashboard() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("menu");
  const [dailyMenu, setDailyMenu] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tiffinHistory, setTiffinHistory] = useState([]);
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7));

  const setupNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }

        const { getMessagingSafe, useMock } = await import("../firebase");
        if (!useMock) {
          const messaging = await getMessagingSafe();
          if (messaging) {
            const { getToken } = await import("firebase/messaging");
            const token = await getToken(messaging, {
              vapidKey: import.meta.env.VITE_FIREBASE_FCM_VAPID_KEY
            });
            if (token) {
              await dbService.registerFCMToken(currentUser.uid, token);
            }
          }
        }
      } catch (err) {
        console.warn("FCM token registration failed:", err);
      }
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    setError("");

    const unsubscribes = [];

    unsubscribes.push(
      dbService.subscribeToStudentDetails(
        currentUser.uid,
        (details) => {
          setStudentDetails(details);
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setError("Could not sync your profile. Check your connection and reload.");
          setLoading(false);
        }
      )
    );

    if (activeTab === "menu") {
      const todayStr = new Date().toISOString().split("T")[0];
      unsubscribes.push(
        dbService.subscribeToDailyMenu(
          todayStr,
          (menuData) => setDailyMenu(menuData),
          (err) => console.error("Menu sync error:", err)
        )
      );
      setupNotifications();
    }

    if (activeTab === "history") {
      FetchTiffinHistory(historyMonth);
    }

    // Refresh when mobile browser returns from background
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        dbService.getStudentDetails(currentUser.uid).then(setStudentDetails).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribes.forEach((unsub) => unsub?.());
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeTab, currentUser?.uid]);

  useEffect(() => {
    if (activeTab === "history" && currentUser?.uid) {
      FetchTiffinHistory(historyMonth);
    }
  }, [historyMonth]);

  const getDaysRemaining = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const FetchTiffinHistory = async (monthStr) => {
    try {
      const history = await dbService.getTiffinHistoryForStudent(currentUser.uid, monthStr);
      setTiffinHistory(history);
    } catch (err) {
      console.error("Failed to fetch tiffin history:", err);
    }
  };

  const handleSlotSelect = async (slot, status) => {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await dbService.updateTodaySlotStatus(currentUser.uid, slot, status);

      // Also save to tiffinLog history collection
      const todayStr = new Date().toISOString().split("T")[0];
      const historyStatus = status === "Received" ? "received" : "dayoff";
      await dbService.updateTiffinLogEntry(currentUser.uid, todayStr, slot, "student", historyStatus);

      setSuccess(`Marked ${slot} slot as: ${status} for today.`);
      
      // Reload student details
      const details = await dbService.getStudentDetails(currentUser.uid);
      setStudentDetails(details);
      
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(`Failed to update ${slot} status. Please try again.`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getPlanSlots = () => {
    const plan = studentDetails?.plan || "";
    if (plan.includes("Twice")) {
      return ["Morning", "Evening"];
    } else if (plan.includes("Evening")) {
      return ["Evening"];
    } else {
      return ["Morning"]; // Default for Once — Morning or fallback
    }
  };

  const renderTiffinSlot = (slotName) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const hasMarkedToday = studentDetails && studentDetails.todayStatusDate === todayStr;
    const currentStatus = hasMarkedToday 
      ? (slotName === "Morning" ? studentDetails.todayStatusMorning : studentDetails.todayStatusEvening) 
      : null;

    return (
      <div key={slotName} className="card card-highlight flex flex-col gap-3">
        <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
          <h4 className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-primary)", margin: 0 }}>
            {slotName === "Morning" ? "🌅 Morning Tiffin" : "🌆 Evening Tiffin"}
          </h4>
          <span className={`badge ${
            currentStatus === "Received" ? "badge-success" : 
            currentStatus === "Day Off" ? "badge-danger" : "badge-neutral"
          }`} style={{ fontSize: "9px", padding: "2px 8px" }}>
            {currentStatus || "Not Marked"}
          </span>
        </div>

        {/* Large Buttons for slot action */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "5px" }}>
          <button
            type="button"
            onClick={() => handleSlotSelect(slotName, "Received")}
            className={`btn py-3 text-xs font-bold flex items-center justify-center gap-1 ${
              currentStatus === "Received" ? "btn-attendance-received-active" : "btn-attendance-received-outline"
            }`}
            disabled={actionLoading}
          >
            <span>✅ Received Tiffin</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleSlotSelect(slotName, "Day Off")}
            className={`btn py-3 text-xs font-bold flex items-center justify-center gap-1 ${
              currentStatus === "Day Off" ? "btn-attendance-dayoff-active" : "btn-attendance-dayoff-outline"
            }`}
            disabled={actionLoading}
          >
            <span>🚫 Day Off</span>
          </button>
        </div>
      </div>
    );
  };

  // Nav tabs definition
  const tabs = [
    { id: "menu", label: "Tiffins", icon: Utensils },
    { id: "history", label: "History", icon: Calendar },
    { id: "payments", label: "My Payments", icon: CreditCard },
    { id: "profile", label: "Profile", icon: User }
  ];

  const daysRemaining = studentDetails ? getDaysRemaining(studentDetails.nextDueDate) : 0;
  const isDueSoon = daysRemaining <= 2;

  return (
    <>
      {/* Header */}
      <div className="panel-header">
        <div>
          <span className="panel-subtitle">PARADISE TIFFIN</span>
          <h2 className="panel-title">
            {activeTab === "menu" && "Student Dashboard"}
            {activeTab === "history" && "Tiffin History"}
            {activeTab === "payments" && "My Payments"}
            {activeTab === "profile" && "Student Profile"}
          </h2>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="view-content">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm animate-fade-in" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(201, 59, 43, 0.15)" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm animate-fade-in" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)", border: "1px solid rgba(62, 139, 88, 0.15)" }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-dots">
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
            <p className="text-sm font-semibold text-muted">Loading details...</p>
          </div>
        ) : (
          <>
            {!studentDetails && activeTab !== "profile" && (
              <div className="card card-highlight">
                <h3 className="font-bold text-sm mb-2" style={{ color: "var(--text-primary)", margin: 0 }}>
                  Subscription Not Linked Yet
                </h3>
                <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                  Your login is active, but the owner hasn&apos;t linked your tiffin plan yet. Please contact Paradise Tiffin Centre to complete enrollment.
                </p>
              </div>
            )}

            {/* MENU TAB */}
            {activeTab === "menu" && studentDetails && (
              <div className="flex flex-col gap-4 animate-fade-in">
                
                {/* Greeting */}
                <h3 className="heading-font font-bold text-xl mb-1 mt-1" style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  Welcome, {studentDetails.name}! 🍱
                </h3>

                <div className="dashboard-layout">
                  {/* Left Column: Sub Info & Today's Menu */}
                  <div className="flex flex-col gap-4">
                    {/* Info Card */}
                    <div className="card card-highlight flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--border-highlight)" }}>
                        <CreditCard size={18} style={{ color: "var(--accent)" }} />
                        <span className="font-bold text-xs uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Active Subscription</span>
                      </div>
                      
                      <div className="grid-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Tiffin Plan</span>
                          <span className="font-bold text-dark">{studentDetails.plan}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Amount Paid</span>
                          <span className="font-bold text-dark">₹{studentDetails.amountPaid?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Start Date</span>
                          <span className="font-bold text-dark">{studentDetails.startDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Next Due Date</span>
                          <span className="font-bold text-dark">{studentDetails.nextDueDate}</span>
                        </div>
                      </div>
                      
                      <div className="border-t pt-2.5 mt-1 flex justify-between items-center" style={{ borderColor: "var(--border-highlight)" }}>
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Days Remaining:</span>
                        <span className="font-extrabold text-sm" style={{ color: isDueSoon ? "var(--danger)" : "var(--success)" }}>
                          {daysRemaining < 0 ? `${Math.abs(daysRemaining)} Days Overdue` : `${daysRemaining} Days`}
                        </span>
                      </div>
                    </div>

                    {/* Today's Menu Card */}
                    <div className="card flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
                        <Utensils size={18} style={{ color: "var(--text-primary)" }} />
                        <span className="font-bold text-xs uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Today's Menu</span>
                      </div>
                      
                      {dailyMenu && dailyMenu.menuText ? (
                        <p className="text-sm font-medium italic" style={{ color: "var(--text-primary)", lineHeight: "1.6", whiteSpace: "pre-line", margin: 0 }}>
                          {dailyMenu.menuText}
                        </p>
                      ) : (
                        <p className="text-xs text-muted" style={{ fontStyle: "italic", margin: 0, color: "var(--text-muted)" }}>
                          Menu not announced yet
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Attendance */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-xs uppercase tracking-widest px-1" style={{ color: "var(--text-muted)", margin: 0 }}>
                      📅 Today's Tiffin Attendance
                    </h3>
                    
                    {getPlanSlots().map(slot => renderTiffinSlot(slot))}
                  </div>
                </div>

              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === "history" && studentDetails && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="card flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b pb-2 mb-1" style={{ borderColor: "var(--border-color)" }}>
                    <h4 className="font-bold text-xs uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                      📅 My Tiffin History
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const [y, m] = historyMonth.split("-").map(Number);
                          let newY = y, newM = m - 1;
                          if (newM < 1) { newM = 12; newY -= 1; }
                          setHistoryMonth(`${newY}-${String(newM).padStart(2, "0")}`);
                        }}
                        className="btn btn-outline py-1 px-2 text-xs"
                        style={{ cursor: "pointer" }}
                      >
                        ←
                      </button>
                      <span className="text-xs font-bold" style={{ color: "var(--text-primary)", minWidth: "90px", textAlign: "center" }}>
                        {new Date(historyMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const [y, m] = historyMonth.split("-").map(Number);
                          let newY = y, newM = m + 1;
                          if (newM > 12) { newM = 1; newY += 1; }
                          setHistoryMonth(`${newY}-${String(newM).padStart(2, "0")}`);
                        }}
                        className="btn btn-outline py-1 px-2 text-xs"
                        style={{ cursor: "pointer" }}
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-3 flex-wrap text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>🟢 Owner Sent</span>
                    <span>🔴 Owner Not Sent</span>
                    <span>✅ You Received</span>
                    <span>🚫 You Took Day Off</span>
                  </div>

                  {/* Calendar Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="text-center text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>
                        {d}
                      </div>
                    ))}
                    {(() => {
                      const [year, month] = historyMonth.split("-").map(Number);
                      const firstDay = new Date(year, month - 1, 1).getDay();
                      const daysInMonth = new Date(year, month, 0).getDate();
                      const cells = [];

                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} />);
                      }

                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const entry = tiffinHistory.find((h) => h.date === dateStr);

                        const ownerM = entry?.morningOwnerStatus;
                        const ownerE = entry?.eveningOwnerStatus;
                        const studM = entry?.morningStudentStatus;
                        const studE = entry?.eveningStudentStatus;

                        const hasData = ownerM || ownerE || studM || studE;

                        cells.push(
                          <div
                            key={dateStr}
                            className="flex flex-col items-center justify-center"
                            style={{
                              aspectRatio: "1",
                              borderRadius: "6px",
                              backgroundColor: hasData ? "var(--card-bg, #F5E6D3)" : "transparent",
                              border: "1px solid var(--border-color)",
                              fontSize: "9px",
                              padding: "2px"
                            }}
                          >
                            <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>{day}</span>
                            {hasData && (
                              <div style={{ display: "flex", gap: "1px", fontSize: "7px", lineHeight: "1" }}>
                                <span>{ownerM === "sent" ? "🟢" : ownerM === "not_sent" ? "🔴" : ""}{studM === "received" ? "✅" : studM === "dayoff" ? "🚫" : ""}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Simple List Backup View */}
                  <div className="mt-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
                    {tiffinHistory.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        No tiffin records for this month yet.
                      </p>
                    ) : (
                      [...tiffinHistory].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => (
                        <div key={entry.date} className="flex justify-between items-center text-[10px] border-b py-1.5" style={{ borderColor: "var(--border-color)" }}>
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{entry.date}</span>
                          <span style={{ color: "var(--text-muted)" }}>
                            {entry.morningOwnerStatus && `🌅 ${entry.morningOwnerStatus === "sent" ? "Sent" : "Not Sent"}/${entry.morningStudentStatus === "received" ? "Received" : entry.morningStudentStatus === "dayoff" ? "Day Off" : "—"}`}
                            {entry.eveningOwnerStatus && `  🌆 ${entry.eveningOwnerStatus === "sent" ? "Sent" : "Not Sent"}/${entry.eveningStudentStatus === "received" ? "Received" : entry.eveningStudentStatus === "dayoff" ? "Day Off" : "—"}`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === "payments" && studentDetails && (
              <div className="flex flex-col gap-4 animate-fade-in">
                {/* Info Summary Card */}
                <div className="card card-highlight flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "var(--border-highlight)" }}>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-dark flex items-center gap-1.5" style={{ color: "var(--text-primary)", margin: 0 }}>
                      💳 Current Subscription Status
                    </h4>
                  </div>
                  <div className="grid-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Active Plan</span>
                      <span className="font-bold text-dark">{studentDetails.plan}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Next Due Date</span>
                      <span className="font-bold text-dark">{studentDetails.nextDueDate}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Timeline */}
                <div className="card flex flex-col gap-3">
                  <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-2 mb-1" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    📜 My Payments History
                  </h4>
                  {studentDetails.payments && studentDetails.payments.length > 0 ? (
                    <div className="flex flex-col gap-4 mt-2">
                      {studentDetails.payments.map((p, idx) => (
                        <div key={p.id || idx} className="relative pl-5 border-l-2 pb-1" style={{ borderColor: "var(--border-color)" }}>
                          <div className="absolute w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--accent)", left: "-6px", top: "4px" }} />
                          
                          <div className="flex justify-between items-start">
                            <span className="font-extrabold text-sm text-dark">
                              ₹{p.amount?.toFixed(2)}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)", fontWeight: "700" }}>
                              Date Paid: {p.paymentDate}
                            </span>
                          </div>
                          
                          <p className="text-[10px] mt-0.5 text-muted" style={{ margin: 0 }}>
                            Plan: {p.plan} ({p.cycleDays} days cycle)
                          </p>
                          <p className="text-[10px] mt-0.5 font-bold" style={{ color: "var(--success)", margin: 0 }}>
                            Covered: {p.startDate} to {p.endDate}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted text-center py-4" style={{ fontStyle: "italic", margin: 0 }}>
                      No past payments found.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="card flex flex-col items-center text-center py-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-3 shadow"
                    style={{ backgroundColor: "var(--accent)", color: "#FFFFFF" }}
                  >
                    {currentUser.name?.charAt(0).toUpperCase() || "S"}
                  </div>
                  <h3 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>
                    {currentUser.name}
                  </h3>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                    {currentUser.email}
                  </p>
                  <span className="badge badge-neutral" style={{ fontWeight: "700" }}>
                    🎓 Student Account
                  </span>
                </div>

                <div className="card flex flex-col gap-3">
                  <h4 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                    Tiffin Policy Info
                  </h4>
                  <ul className="text-xs flex flex-col gap-2" style={{ color: "var(--text-muted)", listStyle: "disc", paddingLeft: "16px" }}>
                    <li>Please select "Received" or "Day Off" status by 9:00 AM for Breakfast/Morning orders and by 5:00 PM for Evening orders.</li>
                    <li>Marking "Day Off" will freeze your daily quota, and the owner will adjust your subscription cycle accordingly.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-outline mt-4 flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Tabs Navbar */}
      <Navbar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}
