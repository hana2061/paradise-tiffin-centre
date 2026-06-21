import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { dbService } from "../services/db";
import Navbar from "../components/Navbar";
import { 
  Utensils, 
  Search, 
  Users, 
  TrendingUp, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  AlertCircle,
  Clock,
  TrendingDown,
  DollarSign,
  UserPlus
} from "lucide-react";

export default function OwnerDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("students");
  
  // Data States
  const [menuItems, setMenuItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Today's Menu Editor States
  const [todayMenuText, setTodayMenuText] = useState("");
  const [todayMenuAvailable, setTodayMenuAvailable] = useState(true);

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState("");

  // Student Form States
  const [studName, setStudName] = useState("");
  const [studPhone, setStudPhone] = useState("");
  const [studEmail, setStudEmail] = useState("");
  const [studStart, setStudStart] = useState("");
  const [studPlan, setStudPlan] = useState("Once — Morning");
  const [studAmount, setStudAmount] = useState("");
  const [studCycle, setStudCycle] = useState("30");
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [activeHoliday, setActiveHoliday] = useState(null);

  // Student Detail & Payments States
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [todayTiffinLog, setTodayTiffinLog] = useState(null);
  const [tiffinHistory, setTiffinHistory] = useState([]);
  const [allTodayLogs, setAllTodayLogs] = useState([]);
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7)); // "2026-06"
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payCycle, setPayCycle] = useState("30");

  // Student Edit profile states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState("Once — Morning");
  const [editCycle, setEditCycle] = useState("30");

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studName || !studPhone || !studEmail || !studStart || !studAmount || !studCycle) {
      setError("Please fill in all student details.");
      return;
    }
    if (studPhone.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const studentData = {
        name: studName.trim(),
        phone: studPhone.trim(),
        email: studEmail.trim(),
        startDate: studStart,
        plan: studPlan,
        amountPaid: parseFloat(studAmount),
        cycleDays: parseInt(studCycle)
      };

      const result = await dbService.addStudentByOwner(studentData);
      setCreatedCredentials(result);
      setSuccess("Student successfully created and enrolled!");
    } catch (err) {
      setError(err.message || "Failed to create student.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    setSelectedStudentId(null);

    if (activeTab === "add-student") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribes = [];

    if (activeTab === "students" || activeTab === "analytics") {
      unsubscribes.push(
        dbService.subscribeToStudents(
          (studList) => {
            setStudents(studList);
            setLoading(false);
          },
          (err) => {
            console.error(err);
            setError("Could not sync student data. Check your connection.");
            setLoading(false);
          }
        )
      );
    }

    if (activeTab === "students") {
      fetchAllTodayLogs();
    }

    if (activeTab === "students") {
      unsubscribes.push(
        dbService.subscribeToHolidays(
          (holidayList) => {
            const sorted = [...holidayList].sort(
              (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setActiveHoliday(sorted[0] || null);
          },
          (err) => console.error("Holiday sync error:", err)
        )
      );
    }

    if (activeTab === "menu") {
      fetchMenuTab();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (activeTab === "menu") fetchMenuTab();
        else if (activeTab === "students" || activeTab === "analytics") {
          dbService.getStudents().then(setStudents).catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribes.forEach((unsub) => unsub?.());
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeTab]);

  const fetchMenuTab = async () => {
    setLoading(true);
    setError("");
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const daily = await dbService.getDailyMenu(todayStr);
      setTodayMenuText(daily ? daily.menuText : "");
    } catch (err) {
      setError("Failed to load today's menu.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentDetails(selectedStudentId);
      fetchTodayTiffinLog(selectedStudentId);
      fetchTiffinHistory(selectedStudentId, historyMonth);
    } else {
      setSelectedStudent(null);
      setTodayTiffinLog(null);
      setTiffinHistory([]);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchTiffinHistory(selectedStudentId, historyMonth);
    }
  }, [historyMonth]);

  // Keep selected student in sync with live student list
  useEffect(() => {
    if (!selectedStudentId || !students.length) return;
    const match = students.find(
      (s) => s.uid === selectedStudentId || s.id === selectedStudentId
    );
    if (match) setSelectedStudent(match);
  }, [students, selectedStudentId]);

  const fetchStudentDetails = async (id) => {
    try {
      const details = await dbService.getStudentDetails(id);
      setSelectedStudent(details);
      if (details) {
        setPayAmount(details.amountPaid?.toString() || "");
        setPayCycle(details.cycleDays?.toString() || "30");
      }
    } catch (err) {
      setError("Failed to fetch student details.");
      console.error(err);
    }
  };

  const fetchTodayTiffinLog = async (studentId) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const logs = await dbService.getTiffinLogForDate(todayStr);
    const match = logs.find(l => l.studentId === studentId);
    setTodayTiffinLog(match || null);
  };
  const fetchAllTodayLogs = async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const logs = await dbService.getTiffinLogForDate(todayStr);
    setAllTodayLogs(logs);
  };

  const handleMarkOwnerSentInList = async (studentId, slot, status) => {
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      await dbService.updateTiffinLogEntry(studentId, todayStr, slot, "owner", status);
      await fetchAllTodayLogs();
    } catch (err) {
      setError("Failed to update tiffin status.");
    }
  };

  const handleMarkOwnerSent = async (slot, status) => {
    const todayStr = new Date().toISOString().split("T")[0];
    setActionLoading(true);
    try {
      await dbService.updateTiffinLogEntry(selectedStudentId, todayStr, slot, "owner", status);
      await fetchTodayTiffinLog(selectedStudentId);
      setSuccess(`Marked ${slot} as ${status === "sent" ? "Sent" : "Not Sent"}`);
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError("Failed to update tiffin status.");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchTiffinHistory = async (studentId, monthStr) => {
    try {
      const history = await dbService.getTiffinHistoryForStudent(studentId, monthStr);
      setTiffinHistory(history);
    } catch (err) {
      console.error("Failed to fetch tiffin history:", err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payAmount || !payDate || !payCycle) {
      setError("Please fill in all payment fields.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const paymentData = {
        amountPaid: parseFloat(payAmount),
        paymentDate: payDate,
        cycleDays: parseInt(payCycle)
      };
      await dbService.recordStudentPayment(selectedStudentId, paymentData);
      setSuccess("Payment successfully recorded!");
      setTimeout(() => setSuccess(""), 4000);
      
      await fetchStudentDetails(selectedStudentId);
      const studList = await dbService.getStudents();
      setStudents(studList);
      
      setShowPaymentForm(false);
    } catch (err) {
      setError("Failed to record payment. Please check details.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName || !editPhone || !editEmail || !editCycle) {
      setError("Please fill in all profile fields.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const updatedData = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        plan: editPlan,
        cycleDays: parseInt(editCycle)
      };
      await dbService.updateStudent(selectedStudentId, updatedData);
      setSuccess("Student profile updated successfully!");
      setTimeout(() => setSuccess(""), 4000);
      
      // Refresh current student detail & list
      await fetchStudentDetails(selectedStudentId);
      const studList = await dbService.getStudents();
      setStudents(studList);
      
      setIsEditingProfile(false);
    } catch (err) {
      setError("Failed to update student profile.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    const confirmed = window.confirm(`⚠️ Are you sure you want to delete ${selectedStudent.name}? This will permanently remove their profile, attendance history, and payment logs. This action cannot be undone.`);
    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await dbService.deleteStudent(selectedStudentId);
      setSuccess("Student deleted successfully.");
      setTimeout(() => setSuccess(""), 4000);
      
      // Close detail view and refresh student list
      setSelectedStudentId(null);
      const studList = await dbService.getStudents();
      setStudents(studList);
    } catch (err) {
      setError("Failed to delete student.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkHoliday = async (holidayType) => {
    let affectedCount = 0;
    students.forEach(s => {
      const plan = s.plan || "";
      let extension = 0;
      if (holidayType === "Full Day Off") {
        extension = 1.0;
      } else if (holidayType === "Morning Off") {
        if ((plan.includes("Once") && plan.includes("Morning")) || plan.includes("Twice")) {
          extension = 1.0;
        }
      } else if (holidayType === "Evening Off") {
        if ((plan.includes("Once") && plan.includes("Evening")) || plan.includes("Twice")) {
          extension = 1.0;
        }
      }
      if (extension > 0) affectedCount++;
    });

    const confirmed = window.confirm(`Are you sure? This will extend due dates for ${affectedCount} students.`);
    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const logRecord = await dbService.applyHoliday(holidayType);
      setActiveHoliday(logRecord);
      setSuccess(`Holiday "${holidayType}" marked successfully. ${logRecord.affectedStudents.length} students extended.`);
    } catch (err) {
      setError(err.message || "Failed to apply holiday.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndoHoliday = async (holidayId) => {
    const confirmed = window.confirm("Are you sure you want to undo this holiday? This will reverse all due date extensions.");
    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await dbService.undoHoliday(holidayId);
      setActiveHoliday(null);
      setSuccess("Holiday reverted successfully. Student due dates restored.");
      const studList = await dbService.getStudents();
      setStudents(studList);
    } catch (err) {
      setError(err.message || "Failed to revert holiday.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Menu Save Handler (Simplified - Single Entry Box)
  const handleUpdateTodayMenu = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await dbService.saveDailyMenu(todayMenuText.trim());
      setSuccess("Today's Menu successfully saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save today's menu.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!todayMenuText.trim()) {
      setError("Please write today's menu before sending notifications.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await dbService.sendTiffinReadyNotification(todayMenuText.trim());
      setSuccess(`Notification sent to ${result.count} students successfully!`);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError("Failed to send push notifications.");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Date difference calculations for dues
  const getDaysRemaining = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStudentMetrics = () => {
    let total = students.length;
    let dueSoon = 0;
    let overdue = 0;
    
    students.forEach(s => {
      const days = getDaysRemaining(s.nextDueDate);
      if (days < 0) {
        overdue++;
      } else if (days >= 0 && days <= 2) {
        dueSoon++;
      }
    });
    
    return { total, dueSoon, overdue };
  };

  const getTodayStatusCounts = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    let morningReceived = 0;
    let morningDayOff = 0;
    let eveningReceived = 0;
    let eveningDayOff = 0;
    
    students.forEach(s => {
      const plan = s.plan || "";
      if (s.todayStatusDate === todayStr) {
        if (plan.includes("Twice")) {
          if (s.todayStatusMorning === "Received") morningReceived++;
          if (s.todayStatusMorning === "Day Off") morningDayOff++;
          if (s.todayStatusEvening === "Received") eveningReceived++;
          if (s.todayStatusEvening === "Day Off") eveningDayOff++;
        } else if (plan.includes("Evening")) {
          if (s.todayStatusEvening === "Received") eveningReceived++;
          if (s.todayStatusEvening === "Day Off") eveningDayOff++;
        } else {
          // Once Morning or default
          if (s.todayStatusMorning === "Received") morningReceived++;
          if (s.todayStatusMorning === "Day Off") morningDayOff++;
        }
      }
    });
    
    return { morningReceived, morningDayOff, eveningReceived, eveningDayOff };
  };

  const getTotalRevenue = () => {
    return students.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  };

  // Nav Tabs Definition
  const tabs = [
    { id: "students", label: "Student List", icon: Users },
    { id: "menu", label: "Today's Tiffin", icon: Utensils },
    { id: "add-student", label: "Add Student", icon: UserPlus },
    { id: "analytics", label: "Analytics", icon: TrendingUp }
  ];

  return (
    <>
      {/* Header */}
      <div className="panel-header">
        <div>
          <span className="panel-subtitle">ADMIN PORTAL</span>
          <h2 className="panel-title">
            {activeTab === "menu" && "Today's Tiffin"}
            {activeTab === "students" && "Student List"}
            {activeTab === "add-student" && "Register Student"}
            {activeTab === "analytics" && "Earnings Dashboard"}
          </h2>
        </div>
        <div className="badge badge-neutral" style={{ fontWeight: "700", borderColor: "var(--accent)", color: "var(--accent)" }}>
          Owner Panel
        </div>
      </div>

      {/* Main View Area */}
      <div className="view-content">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(201, 59, 43, 0.15)" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)", border: "1px solid rgba(62, 139, 88, 0.15)" }}>
            <Check size={18} />
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
            <p className="text-sm font-semibold text-muted">Loading admin data...</p>
          </div>
        ) : (
          <>
            {/* STUDENTS TAB */}
            {activeTab === "students" && (
              selectedStudentId && selectedStudent ? (
                <div className="flex flex-col gap-4 animate-fade-in animate-duration-200">
                  {/* Action Toolbar */}
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(null);
                        setIsEditingProfile(false);
                      }}
                      className="btn btn-outline py-2 px-4 text-xs font-bold"
                      style={{ cursor: "pointer" }}
                    >
                      ← Back to Students
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditName(selectedStudent.name || "");
                          setEditPhone(selectedStudent.phone || "");
                          setEditEmail(selectedStudent.email || "");
                          setEditPlan(selectedStudent.plan || "Once — Morning");
                          setEditCycle(selectedStudent.cycleDays?.toString() || "30");
                          setIsEditingProfile(true);
                        }}
                        className="btn btn-secondary py-2 px-4 text-xs font-bold"
                        style={{ cursor: "pointer" }}
                      >
                        ✏️ Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteStudent}
                        className="btn btn-danger py-2 px-4 text-xs font-bold"
                        style={{ cursor: "pointer" }}
                      >
                        🗑️ Delete Student
                      </button>
                    </div>
                  </div>

                  {/* Profile Edit/Summary Card */}
                  {isEditingProfile ? (
                    <div className="card card-highlight flex flex-col gap-3">
                      <h3 className="font-extrabold text-sm uppercase tracking-wider border-b pb-2 mb-1" style={{ color: "var(--text-primary)", borderColor: "var(--border-highlight)", margin: 0 }}>
                        ✏️ Edit Student Profile
                      </h3>
                      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                        <div className="form-group">
                          <label className="form-label" htmlFor="edit-name">Student Full Name</label>
                          <input
                            id="edit-name"
                            type="text"
                            className="form-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={actionLoading}
                            required
                          />
                        </div>
                        <div className="grid-2 gap-2" style={{ gap: "10px" }}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="edit-phone">Phone Number</label>
                            <input
                              id="edit-phone"
                              type="tel"
                              className="form-input"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              disabled={actionLoading}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="edit-email">Email Address</label>
                            <input
                              id="edit-email"
                              type="email"
                              className="form-input"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              disabled={actionLoading}
                              required
                            />
                          </div>
                        </div>
                        <div className="grid-2 gap-2" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px" }}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="edit-plan">Tiffin Plan</label>
                            <select
                              id="edit-plan"
                              className="form-select"
                              value={editPlan}
                              onChange={(e) => setEditPlan(e.target.value)}
                              disabled={actionLoading}
                            >
                              <option value="Once — Morning">Once — Morning</option>
                              <option value="Once — Evening">Once — Evening</option>
                              <option value="Twice — Morning + Evening">Twice — Morning + Evening</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="edit-cycle">Cycle Days</label>
                            <input
                              id="edit-cycle"
                              type="number"
                              className="form-input"
                              value={editCycle}
                              onChange={(e) => setEditCycle(e.target.value)}
                              disabled={actionLoading}
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-2" style={{ gap: "10px" }}>
                          <button
                            type="submit"
                            className="btn py-2.5 flex-1 font-bold text-xs"
                            disabled={actionLoading}
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="btn btn-outline py-2.5 flex-1 font-bold text-xs"
                            style={{ cursor: "pointer" }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="card card-highlight flex flex-col gap-3">
                      <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
                        <div>
                          <span className="badge badge-neutral text-[9px] font-bold uppercase tracking-wider mb-1" style={{ fontWeight: "700" }}>
                            Student Profile
                          </span>
                          <h3 className="font-extrabold text-xl" style={{ color: "var(--text-primary)", margin: 0 }}>
                            {selectedStudent.name}
                          </h3>
                        </div>
                        <span className="badge badge-success text-[10px] font-extrabold">
                          Active Plan
                        </span>
                      </div>

                      <div className="grid-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Phone</span>
                          <span className="font-bold text-dark">{selectedStudent.phone || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Email</span>
                          <span className="font-bold text-dark">{selectedStudent.email}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Current Plan</span>
                          <span className="font-bold text-dark">{selectedStudent.plan}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Start Date</span>
                          <span className="font-bold text-dark">{selectedStudent.startDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Last Amount Paid</span>
                          <span className="font-bold text-dark">₹{selectedStudent.amountPaid?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Next Due Date</span>
                          <span className="font-bold text-dark" style={{ 
                            color: getDaysRemaining(selectedStudent.nextDueDate) <= 2 ? "var(--danger)" : "var(--text-primary)",
                            fontWeight: "800"
                          }}>{selectedStudent.nextDueDate}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  
                  {/* Tiffin History Calendar */}
                  <div className="card flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b pb-2 mb-1" style={{ borderColor: "var(--border-color)" }}>
                      <h4 className="font-bold text-xs uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                        📅 Tiffin History
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const [y, m] = historyMonth.split("-").map(Number);
                            const prev = new Date(y, m - 2, 1);
                            setHistoryMonth(prev.toISOString().slice(0, 7));
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
                            const next = new Date(y, m, 1);
                            setHistoryMonth(next.toISOString().slice(0, 7));
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
                      <span>✅ Student Received</span>
                      <span>🚫 Student Day Off</span>
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
                    <div className="mt-2" style={{ maxHeight: "180px", overflowY: "auto" }}>
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

                  {/* Payment Form Panel */}
                  {showPaymentForm && (
                    <div className="card card-highlight animate-fade-in">
                      <h4 className="font-bold text-sm uppercase tracking-wide border-b pb-2 mb-3" style={{ color: "var(--text-primary)", borderColor: "var(--border-highlight)", margin: 0 }}>
                        💳 Record New Payment
                      </h4>
                      <form onSubmit={handleRecordPayment} className="flex flex-col gap-3">
                        <div className="form-group">
                          <label className="form-label" htmlFor="pay-amount-input">Amount Paid (₹)</label>
                          <input
                            id="pay-amount-input"
                            type="number"
                            className="form-input"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            disabled={actionLoading}
                            required
                          />
                        </div>
                        <div className="grid-2 gap-2" style={{ gap: "10px" }}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="pay-date-input">Payment Date</label>
                            <input
                              id="pay-date-input"
                              type="date"
                              className="form-input"
                              value={payDate}
                              onChange={(e) => setPayDate(e.target.value)}
                              disabled={actionLoading}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="pay-cycle-input">Cycle Days</label>
                            <input
                              id="pay-cycle-input"
                              type="number"
                              className="form-input"
                              value={payCycle}
                              onChange={(e) => setPayCycle(e.target.value)}
                              disabled={actionLoading}
                              required
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2" style={{ gap: "10px" }}>
                          <button
                            type="submit"
                            className="btn py-2.5 flex-1 font-bold text-xs"
                            disabled={actionLoading}
                          >
                            Save Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className="btn btn-outline py-2.5 flex-1 font-bold text-xs"
                            style={{ cursor: "pointer" }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Payment Timeline / History */}
                  <div className="card flex flex-col gap-3">
                    <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-2 mb-1" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                      📜 Payment History Timeline
                    </h4>
                    {selectedStudent.payments && selectedStudent.payments.length > 0 ? (
                      <div className="flex flex-col gap-4 mt-2">
                        {selectedStudent.payments.map((p, idx) => (
                          <div key={p.id || idx} className="relative pl-5 border-l-2 pb-1" style={{ borderColor: "var(--border-color)" }}>
                            <div className="absolute w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--accent)", left: "-6px", top: "4px" }} />
                            
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-sm text-dark">
                                ₹{p.amount?.toFixed(2)}
                              </span>
                              <span className="text-[10px]" style={{ color: "var(--text-muted)", fontWeight: "700" }}>
                                Date: {p.paymentDate}
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
                        No payments recorded yet.
                      </p>
                    )}
                  </div>

                  {/* Record Payment Button */}
                  {!showPaymentForm && (
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(true)}
                      className="btn py-3.5 font-bold text-sm flex items-center justify-center gap-1.5 mt-2"
                      style={{ cursor: "pointer" }}
                    >
                      💳 + Record New Payment
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Summary Bar */}
                  {(() => {
                    const metrics = getStudentMetrics();
                    return (
                      <div className="summary-bar">
                        <div className="summary-card">
                          <span className="summary-number">{metrics.total}</span>
                          <span className="summary-label">Total Students</span>
                        </div>
                        <div className="summary-card" style={{ borderBottom: "3px solid var(--warning)" }}>
                          <span className="summary-number" style={{ color: "var(--warning)" }}>{metrics.dueSoon}</span>
                          <span className="summary-label">Due Soon</span>
                        </div>
                        <div className="summary-card" style={{ borderBottom: "3px solid var(--danger)" }}>
                          <span className="summary-number" style={{ color: "var(--danger)" }}>{metrics.overdue}</span>
                          <span className="summary-label">Overdue</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mark Holiday Section */}
                  <div className="card card-highlight animate-fade-in">
                    <div className="flex justify-between items-center border-b pb-2 mb-3" style={{ borderColor: "var(--border-highlight)" }}>
                      <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-primary)", margin: 0 }}>
                        📅 Mark Holiday
                      </h3>
                      {activeHoliday && (
                        <span className="badge badge-success">
                          Holiday Active
                        </span>
                      )}
                    </div>

                    {!activeHoliday ? (
                      <div>
                        <p className="text-xs mb-3" style={{ color: "var(--text-muted)", lineHeight: "1.4" }}>
                          Select a holiday type to automatically extend student subscription due dates.
                        </p>
                        <div className="holiday-btn-grid">
                          <button
                            type="button"
                            onClick={() => handleMarkHoliday("Morning Off")}
                            className="btn btn-outline py-2.5 text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <span>🌅 Morning Off</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkHoliday("Evening Off")}
                            className="btn btn-outline py-2.5 text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <span>🌆 Evening Off</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkHoliday("Full Day Off")}
                            className="btn py-2.5 text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <span>📅 Full Day Off</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <div>
                            <p className="text-xs font-bold" style={{ color: "var(--text-primary)", margin: 0 }}>
                              Active Holiday: <span style={{ color: "var(--accent)", fontWeight: "bold" }}>{activeHoliday.type}</span>
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              Marked on: {new Date(activeHoliday.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUndoHoliday(activeHoliday.id)}
                            className="btn btn-danger py-1.5 px-3 text-xs font-bold flex items-center gap-1"
                            style={{ cursor: "pointer" }}
                          >
                            <span>↩ Undo Holiday</span>
                          </button>
                        </div>

                        {/* Affected Students List */}
                        <div className="card" style={{ padding: "10px", maxHeight: "150px", overflowY: "auto" }}>
                          <span className="font-extrabold text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                            Affected Students ({activeHoliday.affectedStudents?.length || 0})
                          </span>
                          {activeHoliday.affectedStudents && activeHoliday.affectedStudents.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {activeHoliday.affectedStudents.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs border-b pb-1" style={{ borderColor: "var(--border-color)" }}>
                                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                                    {item.name} <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>({item.plan})</span>
                                  </span>
                                  <span className="font-bold" style={{ color: "var(--success)" }}>+{item.extension} Day{item.extension !== 1 ? 's' : ''}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>No students were affected by this holiday.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Today's Tiffin Status Summary Banner */}
                  {(() => {
                    const counts = getTodayStatusCounts();
                    return (
                      <div className="today-summary-banner">
                        <span className="font-bold text-xs uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>🍳 Today's Diet Orders:</span>
                        <div className="flex gap-4 text-xs font-semibold flex-wrap">
                          <span style={{ color: "var(--text-primary)" }}>🌅 Morning: <span style={{ color: "var(--success)" }}>{counts.morningReceived} Received</span> | <span style={{ color: "var(--danger)" }}>{counts.morningDayOff} Day Off</span></span>
                          <span style={{ color: "var(--text-muted)" }}>|</span>
                          <span style={{ color: "var(--text-primary)" }}>🌆 Evening: <span style={{ color: "var(--success)" }}>{counts.eveningReceived} Received</span> | <span style={{ color: "var(--danger)" }}>{counts.eveningDayOff} Day Off</span></span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Search Bar */}
                  <div className="search-container">
                    <div className="search-icon-wrapper">
                      <Search size={18} />
                    </div>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search students by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Today's Tiffin Dispatch — Quick List */}
                  <div className="card flex flex-col gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-2 mb-1" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                      🍱 Today's Tiffin — Mark Sent
                    </h4>
                    <div className="flex flex-col gap-2" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      {students
                        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((stud) => {
                          const sid = stud.uid || stud.id;
                          const log = allTodayLogs.find(l => l.studentId === sid);
                          const plan = stud.plan || "";
                          const isTwice = plan.includes("Twice");
                          const slot = isTwice ? null : (plan.includes("Evening") ? "Evening" : "Morning");

                          const renderToggle = (slotName, statusField) => (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>
                                {slotName === "Morning" ? "🌅" : "🌆"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleMarkOwnerSentInList(sid, slotName, "sent")}
                                className="btn py-1 px-2 text-[10px] font-bold"
                                style={{
                                  cursor: "pointer",
                                  opacity: log?.[statusField] === "sent" ? 1 : 0.35
                                }}
                              >
                                ✅
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkOwnerSentInList(sid, slotName, "not_sent")}
                                className="btn btn-danger py-1 px-2 text-[10px] font-bold"
                                style={{
                                  cursor: "pointer",
                                  opacity: log?.[statusField] === "not_sent" ? 1 : 0.35
                                }}
                              >
                                ❌
                              </button>
                            </div>
                          );

                          return (
                            <div key={sid} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "var(--border-color)" }}>
                              <span className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>{stud.name}</span>
                              <div className="flex gap-3">
                                {isTwice ? (
                                  <>
                                    {renderToggle("Morning", "morningOwnerStatus")}
                                    {renderToggle("Evening", "eveningOwnerStatus")}
                                  </>
                                ) : (
                                  renderToggle(slot, slot === "Morning" ? "morningOwnerStatus" : "eveningOwnerStatus")
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Student Rows List */}
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-widest mb-3 px-1" style={{ color: "var(--text-muted)" }}>
                      Student List Directory ({
                        students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length
                      })
                    </h3>
                    {students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                      <div className="card text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
                        No students found matching "{searchTerm}".
                      </div>
                    ) : (
                      <div className="student-grid">
                        {students
                          .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((stud) => {
                            const days = getDaysRemaining(stud.nextDueDate);
                            
                            let statusText = "Active Plan";
                            let daysText = `${days} Days Left`;
                            let badgeClass = "badge-success";
                            let borderClass = "border-status-green";
                            
                            if (days < 0) {
                              statusText = "Overdue";
                              daysText = `${Math.abs(days)} Days Overdue`;
                              badgeClass = "badge-danger";
                              borderClass = "border-status-red";
                            } else if (days >= 0 && days <= 2) {
                              statusText = "Due Soon";
                              daysText = days === 0 ? "Due Today" : days === 1 ? "Due Tomorrow" : "Due in 2 Days";
                              badgeClass = "badge-warning";
                              borderClass = "border-status-yellow";
                            }
                            
                            return (
                              <div 
                                key={stud.uid || stud.id} 
                                className={`flex justify-between items-center p-3.5 rounded-lg cursor-pointer transition-all hover:translate-x-1 ${borderClass}`}
                                onClick={() => setSelectedStudentId(stud.uid || stud.id)}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-sm" style={{ color: "var(--text-primary)" }}>{stud.name}</span>
                                  <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{stud.plan}</span>
                                </div>
                                <span className={`badge ${badgeClass}`} style={{ fontSize: "9px", padding: "3px 8px", fontWeight: "700" }}>
                                  {statusText} ({daysText})
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* MENU MANAGER TAB */}
            {activeTab === "menu" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="card card-highlight text-xs mb-2" style={{ padding: "12px 16px", fontSize: "13px" }}>
                  🍱 Enter today's menu details and save them so students can view them on their dashboards. Send a push notification when the tiffin is ready.
                </div>

                <div className="card flex flex-col gap-4">
                  <h3 className="font-bold text-sm uppercase tracking-wide border-b pb-2" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)", margin: 0 }}>
                    📋 Today's Tiffin
                  </h3>
                  
                  <div className="form-group mb-0">
                    <label className="form-label" htmlFor="today-menu-textarea">Today's Menu Details</label>
                    <textarea
                      id="today-menu-textarea"
                      className="form-input"
                      placeholder="e.g. Dal Makhani, Jeera Rice, Paneer Butter Masala, 3 Rotis, Salad & Sweet"
                      value={todayMenuText}
                      onChange={(e) => setTodayMenuText(e.target.value)}
                      style={{ minHeight: "120px", resize: "vertical", lineHeight: "1.6" }}
                      disabled={actionLoading}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateTodayMenu}
                    className="btn py-2.5 font-bold"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Saving Menu..." : "Save Menu"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendNotification}
                  className="btn btn-secondary py-4 flex items-center justify-center gap-2 font-bold text-base"
                  disabled={actionLoading}
                >
                  <span>🔔 Send Tiffin Ready Notification</span>
                </button>
              </div>
            )}

            {/* ADD STUDENT TAB */}
            {activeTab === "add-student" && (
              <div className="flex flex-col gap-4">
                {createdCredentials ? (
                  <div className="card card-highlight flex flex-col gap-4 text-center items-center py-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 mb-2">
                      <Check size={24} />
                    </div>
                    <h3 className="font-bold text-xl text-emerald-800">Student Registered!</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      The student account has been created successfully. Share these login details with them:
                    </p>
                    
                    <div className="card card-highlight w-full p-4 text-left text-xs flex flex-col gap-2 my-2">
                      <div>
                        <span className="font-bold block" style={{ color: "var(--text-primary)" }}>Full Name:</span>
                        <span>{createdCredentials.student.name}</span>
                      </div>
                      <div>
                        <span className="font-bold block" style={{ color: "var(--text-primary)" }}>Login Email:</span>
                        <code style={{ fontSize: "13px", fontWeight: "700" }}>{createdCredentials.email}</code>
                      </div>
                      <div>
                        <span className="font-bold block" style={{ color: "var(--text-primary)" }}>Password:</span>
                        <code style={{ fontSize: "13px", fontWeight: "700" }}>{createdCredentials.password}</code>
                      </div>
                      <div>
                        <span className="font-bold block" style={{ color: "var(--text-primary)" }}>Tiffin Plan:</span>
                        <span>{createdCredentials.student.plan}</span>
                      </div>
                      <div>
                        <span className="font-bold block" style={{ color: "var(--text-primary)" }}>Next Due Date:</span>
                        <span className="badge badge-warning" style={{ fontWeight: "700" }}>{createdCredentials.student.nextDueDate}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn w-full"
                      onClick={() => {
                        const text = `Paradise Tiffin Centre Login Details:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nPlan: ${createdCredentials.student.plan}\nNext Due Date: ${createdCredentials.student.nextDueDate}`;
                        navigator.clipboard.writeText(text);
                        alert("Details copied to clipboard!");
                      }}
                    >
                      Copy Login Details
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline w-full mt-2"
                      onClick={() => {
                        setCreatedCredentials(null);
                        setStudName("");
                        setStudPhone("");
                        setStudEmail("");
                        setStudStart("");
                        setStudPlan("Once — Morning");
                        setStudAmount("");
                        setStudCycle("30");
                      }}
                    >
                      Register Another Student
                    </button>
                  </div>
                ) : (
                  <div className="card">
                    <form onSubmit={handleAddStudentSubmit} className="flex flex-col gap-4">
                      <div className="form-group">
                        <label className="form-label" htmlFor="stud-name">Student Full Name</label>
                        <input
                          id="stud-name"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Amit Kumar"
                          value={studName}
                          onChange={(e) => setStudName(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="stud-phone">Phone Number</label>
                        <input
                          id="stud-phone"
                          type="tel"
                          className="form-input"
                          placeholder="e.g. 9876543210"
                          value={studPhone}
                          onChange={(e) => setStudPhone(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="stud-email">Email Address</label>
                        <input
                          id="stud-email"
                          type="email"
                          className="form-input"
                          placeholder="e.g. amit@domain.com"
                          value={studEmail}
                          onChange={(e) => setStudEmail(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="stud-start">Start Date</label>
                        <input
                          id="stud-start"
                          type="date"
                          className="form-input"
                          value={studStart}
                          onChange={(e) => setStudStart(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="stud-plan">Tiffin Plan</label>
                        <select
                          id="stud-plan"
                          className="form-select"
                          value={studPlan}
                          onChange={(e) => setStudPlan(e.target.value)}
                          disabled={actionLoading}
                        >
                          <option value="Once — Morning">Once — Morning</option>
                          <option value="Once — Evening">Once — Evening</option>
                          <option value="Twice — Morning + Evening">Twice — Morning + Evening</option>
                        </select>
                      </div>

                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="stud-amount">Amount Paid (₹)</label>
                          <input
                            id="stud-amount"
                            type="number"
                            className="form-input"
                            placeholder="e.g. 3300"
                            value={studAmount}
                            onChange={(e) => setStudAmount(e.target.value)}
                            disabled={actionLoading}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="stud-cycle">Payment Cycle (Days)</label>
                          <input
                            id="stud-cycle"
                            type="number"
                            className="form-input"
                            placeholder="30"
                            value={studCycle}
                            onChange={(e) => setStudCycle(e.target.value)}
                            disabled={actionLoading}
                          />
                        </div>
                      </div>

                      <button type="submit" className="btn mt-4 py-3" disabled={actionLoading}>
                        {actionLoading ? "Creating Credentials..." : "Add Student & Create Account"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="flex flex-col gap-4">
                {/* Stats Matrix Grid */}
                <div className="grid-2">
                  <div className="card text-center flex flex-col justify-center items-center py-5">
                    <DollarSign size={24} className="mb-1" style={{ color: "var(--success)" }} />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted">Total Revenue</span>
                    <h3 className="text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>₹{getTotalRevenue().toFixed(2)}</h3>
                  </div>
                  <div className="card text-center flex flex-col justify-center items-center py-5">
                    <Clock size={24} className="mb-1" style={{ color: "var(--danger)" }} />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted">Overdue Accounts</span>
                    <h3 className="text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{getStudentMetrics().overdue} Students</h3>
                  </div>
                </div>

                <div className="card card-highlight text-center flex flex-col justify-center items-center py-5">
                  <Users size={28} className="mb-1" style={{ color: "var(--accent)" }} />
                  <span className="text-[11px] uppercase font-bold tracking-wider text-muted">Registered Tiffin Customers</span>
                  <h2 className="text-3xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{students.length} Students</h2>
                </div>

                <div className="card flex flex-col gap-2">
                  <h4 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                    Administrator Controls
                  </h4>
                  <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: "1.4" }}>
                    You are signed in as the Owner. You can update today's menu tiffin, register new students, and monitor active subscriptions.
                  </p>
                  <button
                    type="button"
                    onClick={logout}
                    className="btn btn-outline mt-3 flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    <span>Logout Admin</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>



      {/* Bottom Navigation */}
      <Navbar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}
