import { auth as firebaseAuth, db as firebaseDb, useMock } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  runTransaction,
  onSnapshot
} from "firebase/firestore";

// Helper to delay execution (simulate network)
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

/** Resolve a student's Firestore doc ref — by uid, or by email if uid doc is missing. */
async function resolveStudentRef(uid) {
  const directRef = doc(firebaseDb, "students", uid);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return { ref: directRef, data: directSnap.data() };
  }

  const userSnap = await getDoc(doc(firebaseDb, "users", uid));
  const email = userSnap.exists() ? userSnap.data().email : null;
  if (!email) return { ref: directRef, data: null };

  const emailQuery = query(collection(firebaseDb, "students"), where("email", "==", email));
  const emailSnap = await getDocs(emailQuery);
  if (emailSnap.empty) return { ref: directRef, data: null };

  const matchDoc = emailSnap.docs[0];
  return { ref: matchDoc.ref, data: matchDoc.data() };
}

/** Mock-mode polling helper — re-reads localStorage every few seconds. */
function mockSubscribe(readFn, callback, intervalMs = 2500) {
  const tick = () => callback(readFn());
  tick();
  const interval = setInterval(tick, intervalMs);
  const onStorage = (e) => {
    if (!e.key || e.key.startsWith("pfc_")) tick();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    clearInterval(interval);
    window.removeEventListener("storage", onStorage);
  };
}

// ==========================================
// SEED DATA FOR MOCK MODE
// ==========================================


const DEFAULT_USERS = {
  "owner-id": {
    uid: "owner-id",
    email: "owner@paradise.com",
    role: "owner",
    name: "Paradise Owner"
  },
  "student-1": {
    uid: "student-1",
    email: "rahul@paradise.com",
    role: "student",
    name: "Rahul Sharma"
  }
};

const DEFAULT_STUDENTS = [
  {
    id: "student-1",
    uid: "student-1",
    name: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@paradise.com",
    startDate: "2026-06-01",
    plan: "Twice — Morning + Evening",
    amountPaid: 3300,
    cycleDays: 30,
    nextDueDate: "2026-07-01",
    password: "pfc@3210",
    createdAt: new Date().toISOString(),
    payments: [
      {
        id: "pay_initial_1",
        amount: 3300,
        paymentDate: "2026-06-01",
        plan: "Twice — Morning + Evening",
        cycleDays: 30,
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        timestamp: new Date().toISOString()
      }
    ]
  }
];

// Initialize localStorage if empty
if (useMock) {
  if (!localStorage.getItem("pfc_students")) {
    localStorage.setItem("pfc_students", JSON.stringify(DEFAULT_STUDENTS));
  }
  if (!localStorage.getItem("pfc_menu")) {
    localStorage.setItem("pfc_menu", JSON.stringify(DEFAULT_MENU));
  }
  if (!localStorage.getItem("pfc_users")) {
    localStorage.setItem("pfc_users", JSON.stringify(DEFAULT_USERS));
  }
}

// ==========================================
// DATABASE INTERFACE IMPLEMENTATION
// ==========================================

export const dbService = {
  // Auth Listeners
  onAuth(callback) {
    if (useMock) {
      // Check if there is an active session
      const activeUser = JSON.parse(localStorage.getItem("pfc_active_user") || "null");
      callback(activeUser);
      // We return an unsubscribe function
      return () => {};
    } else {
      return onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          // Fetch additional profile data from Firestore
          const userDoc = await getDoc(doc(firebaseDb, "users", user.uid));
          if (userDoc.exists()) {
            callback({ ...userDoc.data(), uid: user.uid });
          } else {
            // Default user fallback if profile doc isn't created yet
            const isOwner = user.email === "owner@paradise.com";
            const profile = {
              uid: user.uid,
              email: user.email,
              role: isOwner ? "owner" : "student",
              name: isOwner ? "Paradise Owner" : user.email.split("@")[0]
            };
            await setDoc(doc(firebaseDb, "users", user.uid), profile);
            callback(profile);
          }
        } else {
          callback(null);
        }
      });
    }
  },

  // Login
  async login(email, password) {
    await delay();
    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      
      // Fixed Owner Check
      if (email === "owner@paradise.com") {
        const owner = users["owner-id"];
        localStorage.setItem("pfc_active_user", JSON.stringify(owner));
        return owner;
      }

      // Student Check
      const foundUser = Object.values(users).find(u => u.email === email);
      if (!foundUser) {
        throw new Error("User not found in Mock database.");
      }
      localStorage.setItem("pfc_active_user", JSON.stringify(foundUser));
      return foundUser;
    } else {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(firebaseDb, "users", user.uid));
      if (userDoc.exists()) {
        return { ...userDoc.data(), uid: user.uid };
      } else {
        const isOwner = email === "owner@paradise.com";
        const profile = {
          uid: user.uid,
          email: user.email,
          role: isOwner ? "owner" : "student",
          name: isOwner ? "Paradise Owner" : email.split("@")[0]
        };
        await setDoc(doc(firebaseDb, "users", user.uid), profile);
        return profile;
      }
    }
  },

  // Register Student
  async registerStudent(email, password, name) {
    await delay();
    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      
      if (email === "owner@paradise.com") {
        throw new Error("Cannot register owner email as a student.");
      }

      const emailExists = Object.values(users).some(u => u.email === email);
      if (emailExists) {
        throw new Error("Email already registered.");
      }

      const uid = "student_" + Math.random().toString(36).substr(2, 9);
      const newStudent = {
        uid,
        email,
        role: "student",
        name
      };

      users[uid] = newStudent;
      localStorage.setItem("pfc_users", JSON.stringify(users));
      
      localStorage.setItem("pfc_active_user", JSON.stringify(newStudent));
      return newStudent;
    } else {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;
      
      const profile = {
        uid: user.uid,
        email: user.email,
        role: "student",
        name
      };

      await setDoc(doc(firebaseDb, "users", user.uid), profile);

      return profile;
    }
  },

  // Logout
  async logout() {
    if (useMock) {
      localStorage.removeItem("pfc_active_user");
    } else {
      await firebaseSignOut(firebaseAuth);
    }
  },

  // ==========================================
  // MENU MANAGEMENT
  // ==========================================
  async getMenu() {
    await delay();
    if (useMock) {
      return JSON.parse(localStorage.getItem("pfc_menu") || "[]");
    } else {
      const menuCol = collection(firebaseDb, "menu");
      const menuSnapshot = await getDocs(menuCol);
      return menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  async addMenuItem(item) {
    await delay();
    if (useMock) {
      const menu = JSON.parse(localStorage.getItem("pfc_menu") || "[]");
      const newItem = {
        id: "menu_" + Math.random().toString(36).substr(2, 9),
        ...item,
        available: true
      };
      menu.push(newItem);
      localStorage.setItem("pfc_menu", JSON.stringify(menu));
      return newItem;
    } else {
      const docRef = await addDoc(collection(firebaseDb, "menu"), {
        ...item,
        available: true
      });
      return { id: docRef.id, ...item, available: true };
    }
  },

  async updateMenuItem(itemId, itemData) {
    await delay();
    if (useMock) {
      const menu = JSON.parse(localStorage.getItem("pfc_menu") || "[]");
      const index = menu.findIndex(item => item.id === itemId);
      if (index === -1) throw new Error("Menu item not found.");
      
      menu[index] = { ...menu[index], ...itemData };
      localStorage.setItem("pfc_menu", JSON.stringify(menu));
      return menu[index];
    } else {
      const docRef = doc(firebaseDb, "menu", itemId);
      await updateDoc(docRef, itemData);
      return { id: itemId, ...itemData };
    }
  },

  async deleteMenuItem(itemId) {
    await delay();
    if (useMock) {
      let menu = JSON.parse(localStorage.getItem("pfc_menu") || "[]");
      menu = menu.filter(item => item.id !== itemId);
      localStorage.setItem("pfc_menu", JSON.stringify(menu));
      return true;
    } else {
      await deleteDoc(doc(firebaseDb, "menu", itemId));
      return true;
    }
  },

  // ==========================================
  // STUDENT MANAGEMENT
  // ==========================================
  async getStudentProfile(uid) {
    await delay();
    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      return users[uid] || null;
    } else {
      const docRef = doc(firebaseDb, "users", uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    }
  },

  async getStudentDetails(uid) {
    await delay();
    if (useMock) {
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
      return students.find(s => s.uid === uid || s.id === uid) || null;
    } else {
      const { data } = await resolveStudentRef(uid);
      return data;
    }
  },

  async getStudents() {
    await delay();
    if (useMock) {
      return JSON.parse(localStorage.getItem("pfc_students") || "[]");
    } else {
      const studentsCol = collection(firebaseDb, "students");
      const snapshot = await getDocs(studentsCol);
      return snapshot.docs.map(doc => doc.data());
    }
  },

  async addStudentByOwner(studentData) {
    await delay();
    const { name, phone, email, startDate, plan, amountPaid, cycleDays } = studentData;
    
    // Calculate nextDueDate
    const start = new Date(startDate);
    start.setDate(start.getDate() + parseInt(cycleDays));
    const nextDueDate = start.toISOString().split("T")[0];

    // Generate password
    const password = "pfc@" + phone.slice(-4); 

    const amountPaidNum = parseFloat(amountPaid) || 0;

    const initialPayment = {
      id: "pay_initial_" + Date.now(),
      amount: amountPaidNum,
      paymentDate: startDate,
      plan,
      cycleDays: parseInt(cycleDays),
      startDate,
      endDate: nextDueDate,
      timestamp: new Date().toISOString()
    };

    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");

      const emailExists = Object.values(users).some(u => u.email === email);
      if (emailExists) {
        throw new Error("Email already registered.");
      }

      const uid = "student_" + Math.random().toString(36).substr(2, 9);
      
      // Add to users
      const newUser = {
        uid,
        email,
        role: "student",
        name,
        amountPaid: amountPaidNum,
        nextDueDate,
        payments: [initialPayment]
      };
      users[uid] = newUser;
      localStorage.setItem("pfc_users", JSON.stringify(users));

      // Add to students
      const newStudent = {
        id: uid,
        uid,
        name,
        phone,
        email,
        startDate,
        plan,
        amountPaid: amountPaidNum,
        cycleDays: parseInt(cycleDays),
        nextDueDate,
        password,
        payments: [initialPayment],
        createdAt: new Date().toISOString()
      };
      students.unshift(newStudent);
      localStorage.setItem("pfc_students", JSON.stringify(students));

      return { email, password, student: newStudent };
    } else {
      const { initializeApp, deleteApp } = await import("firebase/app");
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import("firebase/auth");
      const { firebaseConfig } = await import("../firebase");
      
      const tempAppName = "TempApp_" + Math.random().toString(36).substr(2, 9);
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
        await signOut(tempAuth);
      } catch (err) {
        await deleteApp(tempApp);
        throw new Error(err.message || "Failed to create Firebase Auth user.");
      }
      
      const uid = userCredential.user.uid;
      
      // Write user details
      const userRef = doc(firebaseDb, "users", uid);
      await setDoc(userRef, {
        uid,
        email,
        role: "student",
        name,
        amountPaid: amountPaidNum,
        nextDueDate,
        payments: [initialPayment]
      });

      // Write student details
      const studentRef = doc(firebaseDb, "students", uid);
      const newStudent = {
        id: uid,
        uid,
        name,
        phone,
        email,
        startDate,
        plan,
        amountPaid: amountPaidNum,
        cycleDays: parseInt(cycleDays),
        nextDueDate,
        password,
        payments: [initialPayment],
        createdAt: new Date().toISOString()
      };
      await setDoc(studentRef, newStudent);

      await deleteApp(tempApp);
      return { email, password, student: newStudent };
    }
  },

  async updateTodayStatus(studentId, status) {
    await delay();
    const todayStr = new Date().toISOString().split("T")[0];
    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");

      // Update in users
      if (users[studentId]) {
        users[studentId].todayStatus = status;
        users[studentId].todayStatusDate = todayStr;
        localStorage.setItem("pfc_users", JSON.stringify(users));
      }

      // Update in students
      const index = students.findIndex(s => s.uid === studentId);
      if (index !== -1) {
        students[index].todayStatus = status;
        students[index].todayStatusDate = todayStr;
        localStorage.setItem("pfc_students", JSON.stringify(students));
      }

      // Update active session user if it's the current user
      const activeUser = JSON.parse(localStorage.getItem("pfc_active_user") || "null");
      if (activeUser && activeUser.uid === studentId) {
        activeUser.todayStatus = status;
        activeUser.todayStatusDate = todayStr;
        localStorage.setItem("pfc_active_user", JSON.stringify(activeUser));
      }

      return { todayStatus: status, todayStatusDate: todayStr };
    } else {
      const userRef = doc(firebaseDb, "users", studentId);
      const studentRef = doc(firebaseDb, "students", studentId);
      const updateData = { todayStatus: status, todayStatusDate: todayStr };
      
      await updateDoc(userRef, updateData);
      
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        await updateDoc(studentRef, updateData);
      }
      return updateData;
    }
  },

  async updateTodaySlotStatus(studentId, slot, status) {
    await delay();
    const todayStr = new Date().toISOString().split("T")[0];
    const updateField = slot === "Morning" ? "todayStatusMorning" : "todayStatusEvening";
    const updateData = { 
      [updateField]: status, 
      todayStatusDate: todayStr 
    };

    if (useMock) {
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");

      // Update in users
      if (users[studentId]) {
        users[studentId][updateField] = status;
        users[studentId].todayStatusDate = todayStr;
        localStorage.setItem("pfc_users", JSON.stringify(users));
      }

      // Update in students
      const index = students.findIndex(s => s.uid === studentId);
      if (index !== -1) {
        students[index][updateField] = status;
        students[index].todayStatusDate = todayStr;
        localStorage.setItem("pfc_students", JSON.stringify(students));
      }

      // Update active session user if it's the current user
      const activeUser = JSON.parse(localStorage.getItem("pfc_active_user") || "null");
      if (activeUser && activeUser.uid === studentId) {
        activeUser[updateField] = status;
        activeUser.todayStatusDate = todayStr;
        localStorage.setItem("pfc_active_user", JSON.stringify(activeUser));
      }

      return { [updateField]: status, todayStatusDate: todayStr };
    } else {
      const userRef = doc(firebaseDb, "users", studentId);
      const studentRef = doc(firebaseDb, "students", studentId);
      
      await updateDoc(userRef, updateData);
      
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        await updateDoc(studentRef, updateData);
      }
      return updateData;
    }
  },

  async getHolidays() {
    await delay();
    if (useMock) {
      return JSON.parse(localStorage.getItem("pfc_holidays") || "[]");
    } else {
      const col = collection(firebaseDb, "holidays");
      const snapshot = await getDocs(col);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  async applyHoliday(holidayType) {
    await delay();
    const todayStr = new Date().toISOString().split("T")[0];
    
    // 1. Get all students
    let students = [];
    if (useMock) {
      students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
    } else {
      const snapshot = await getDocs(collection(firebaseDb, "students"));
      students = snapshot.docs.map(doc => doc.data());
    }

    // Helper to add/subtract days
    const addDays = (dateStr, days) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return date.toISOString().split("T")[0];
    };

    const affectedStudents = [];
    const updatedStudents = students.map(student => {
      let extension = 0;
      const plan = student.plan || "";

      if (holidayType === "Full Day Off") {
        extension = 1.0;
      } else if (holidayType === "Morning Off") {
        if (plan.includes("Once") && plan.includes("Morning")) {
          extension = 1.0;
        } else if (plan.includes("Twice")) {
          extension = 0.5;
        }
      } else if (holidayType === "Evening Off") {
        if (plan.includes("Once") && plan.includes("Evening")) {
          extension = 1.0;
        } else if (plan.includes("Twice")) {
          extension = 0.5;
        }
      }

      if (extension > 0) {
        const prevDueDate = student.nextDueDate;
        const prevFractional = student.fractionalDays || 0;

        const newFractionalTotal = prevFractional + extension;
        const daysToAdd = Math.floor(newFractionalTotal);
        const newFractional = newFractionalTotal - daysToAdd;
        const newDueDate = daysToAdd > 0 ? addDays(prevDueDate, daysToAdd) : prevDueDate;

        affectedStudents.push({
          studentId: student.uid || student.id,
          name: student.name,
          plan: student.plan,
          extension,
          prevDueDate,
          prevFractional,
          newDueDate,
          newFractional
        });

        return {
          ...student,
          nextDueDate: newDueDate,
          fractionalDays: newFractional
        };
      }
      return student;
    });

    const holidayId = "holiday_" + Date.now();
    const logRecord = {
      id: holidayId,
      type: holidayType,
      date: todayStr,
      timestamp: new Date().toISOString(),
      affectedStudents
    };

    // Save updated students and log record
    if (useMock) {
      localStorage.setItem("pfc_students", JSON.stringify(updatedStudents));
      
      const holidays = JSON.parse(localStorage.getItem("pfc_holidays") || "[]");
      holidays.push(logRecord);
      localStorage.setItem("pfc_holidays", JSON.stringify(holidays));
      
      // Update users list in mock DB if students are also users
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      updatedStudents.forEach(s => {
        if (users[s.uid]) {
          users[s.uid].nextDueDate = s.nextDueDate;
          users[s.uid].fractionalDays = s.fractionalDays;
        }
      });
      localStorage.setItem("pfc_users", JSON.stringify(users));

    } else {
      // Update each student in Firestore
      for (const s of updatedStudents) {
        const studentRef = doc(firebaseDb, "students", s.uid);
        await updateDoc(studentRef, {
          nextDueDate: s.nextDueDate,
          fractionalDays: s.fractionalDays
        });
        
        // Also update users collection for active session profile
        const userRef = doc(firebaseDb, "users", s.uid);
        await updateDoc(userRef, {
          nextDueDate: s.nextDueDate,
          fractionalDays: s.fractionalDays
        });
      }

      // Save holiday log in Firestore
      const holidayRef = doc(firebaseDb, "holidays", holidayId);
      await setDoc(holidayRef, logRecord);
    }

    return logRecord;
  },

  async undoHoliday(holidayId) {
    await delay();
    
    // 1. Get the holiday log
    let holidayLog = null;
    let holidays = [];
    if (useMock) {
      holidays = JSON.parse(localStorage.getItem("pfc_holidays") || "[]");
      holidayLog = holidays.find(h => h.id === holidayId);
    } else {
      const docSnap = await getDoc(doc(firebaseDb, "holidays", holidayId));
      if (docSnap.exists()) {
        holidayLog = docSnap.data();
      }
    }

    if (!holidayLog) {
      throw new Error("Holiday record not found.");
    }

    // 2. Fetch all students
    let students = [];
    if (useMock) {
      students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
    } else {
      const snapshot = await getDocs(collection(firebaseDb, "students"));
      students = snapshot.docs.map(doc => doc.data());
    }

    // 3. Reverse the extensions for affected students
    const updatedStudents = students.map(student => {
      const affected = holidayLog.affectedStudents.find(a => a.studentId === (student.uid || student.id));
      if (affected) {
        return {
          ...student,
          nextDueDate: affected.prevDueDate,
          fractionalDays: affected.prevFractional
        };
      }
      return student;
    });

    // 4. Save updated students and delete log
    if (useMock) {
      localStorage.setItem("pfc_students", JSON.stringify(updatedStudents));
      
      const newHolidays = holidays.filter(h => h.id !== holidayId);
      localStorage.setItem("pfc_holidays", JSON.stringify(newHolidays));
      
      // Update users list in mock DB
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      updatedStudents.forEach(s => {
        if (users[s.uid]) {
          users[s.uid].nextDueDate = s.nextDueDate;
          users[s.uid].fractionalDays = s.fractionalDays;
        }
      });
      localStorage.setItem("pfc_users", JSON.stringify(users));
    } else {
      // Update in Firestore
      for (const s of updatedStudents) {
        const studentRef = doc(firebaseDb, "students", s.uid);
        await updateDoc(studentRef, {
          nextDueDate: s.nextDueDate,
          fractionalDays: s.fractionalDays
        });

        const userRef = doc(firebaseDb, "users", s.uid);
        await updateDoc(userRef, {
          nextDueDate: s.nextDueDate,
          fractionalDays: s.fractionalDays
        });
      }

      // Delete holiday log
      await deleteDoc(doc(firebaseDb, "holidays", holidayId));
    }

    return true;
  },

  async saveDailyMenu(menuText) {
    await delay();
    const todayStr = new Date().toISOString().split("T")[0];
    if (useMock) {
      const menus = JSON.parse(localStorage.getItem("pfc_daily_menus") || "{}");
      menus[todayStr] = menuText;
      localStorage.setItem("pfc_daily_menus", JSON.stringify(menus));
      return { date: todayStr, menuText };
    } else {
      const docRef = doc(firebaseDb, "dailyMenu", todayStr);
      const data = { menuText, date: todayStr, updatedAt: new Date().toISOString() };
      await setDoc(docRef, data);
      return data;
    }
  },

  async getDailyMenu(dateStr) {
    await delay();
    if (useMock) {
      const menus = JSON.parse(localStorage.getItem("pfc_daily_menus") || "{}");
      return menus[dateStr] ? { date: dateStr, menuText: menus[dateStr] } : null;
    } else {
      const docRef = doc(firebaseDb, "dailyMenu", dateStr);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    }
  },

  async registerFCMToken(studentId, token) {
    await delay();
    if (useMock) {
      const tokens = JSON.parse(localStorage.getItem("pfc_fcm_tokens") || "{}");
      if (!tokens[studentId]) tokens[studentId] = [];
      if (!tokens[studentId].includes(token)) {
        tokens[studentId].push(token);
        localStorage.setItem("pfc_fcm_tokens", JSON.stringify(tokens));
      }
      return true;
    } else {
      const studentRef = doc(firebaseDb, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const data = studentSnap.data();
        const fcmTokens = data.fcmTokens || [];
        if (!fcmTokens.includes(token)) {
          fcmTokens.push(token);
          await updateDoc(studentRef, { fcmTokens });
        }
      }
      const userRef = doc(firebaseDb, "users", studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const fcmTokens = data.fcmTokens || [];
        if (!fcmTokens.includes(token)) {
          fcmTokens.push(token);
          await updateDoc(userRef, { fcmTokens });
        }
      }
      return true;
    }
  },

  async sendTiffinReadyNotification(menuText) {
    await delay();
    let allTokens = [];
    if (useMock) {
      const tokens = JSON.parse(localStorage.getItem("pfc_fcm_tokens") || "{}");
      allTokens = Object.values(tokens).flat();
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Paradise Tiffin Centre", {
            body: `Your tiffin is ready! 🍱 Today's menu at Paradise Tiffin Centre: ${menuText}`,
            icon: "/favicon.ico"
          });
        }
      }
    } else {
      try {
        const response = await fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menuText })
        });
        const result = await response.json();
        return { success: true, count: result.count || 0 };
      } catch (err) {
        console.error("Backend notification dispatch failed:", err);
        return { success: false, count: 0 };
      }
    }
    return { success: true, count: allTokens.length };
  },

  async recordStudentPayment(studentId, paymentData) {
    await delay();
    const { amountPaid, paymentDate, cycleDays } = paymentData;
    const amountPaidNum = parseFloat(amountPaid) || 0;
    const cycleDaysInt = parseInt(cycleDays) || 30;

    const addDays = (dateStr, days) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return date.toISOString().split("T")[0];
    };

    if (useMock) {
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
      const index = students.findIndex(s => s.uid === studentId || s.id === studentId);
      if (index === -1) throw new Error("Student not found.");

      const student = students[index];
      const currentDueDate = student.nextDueDate;
      let startDateStr = paymentDate;
      
      if (currentDueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(currentDueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= -15) {
          startDateStr = currentDueDate;
        }
      }
      
      const newDueDateStr = addDays(startDateStr, cycleDaysInt);

      const newPayment = {
        id: "pay_" + Date.now(),
        amount: amountPaidNum,
        paymentDate,
        plan: student.plan,
        cycleDays: cycleDaysInt,
        startDate: startDateStr,
        endDate: newDueDateStr,
        timestamp: new Date().toISOString()
      };

      const payments = student.payments || [];
      payments.unshift(newPayment);

      const updatedStudent = {
        ...student,
        amountPaid: amountPaidNum,
        cycleDays: cycleDaysInt,
        nextDueDate: newDueDateStr,
        payments
      };

      students[index] = updatedStudent;
      localStorage.setItem("pfc_students", JSON.stringify(students));

      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      if (users[studentId]) {
        users[studentId].amountPaid = amountPaidNum;
        users[studentId].nextDueDate = newDueDateStr;
        users[studentId].payments = payments;
        localStorage.setItem("pfc_users", JSON.stringify(users));
      }

      const activeUser = JSON.parse(localStorage.getItem("pfc_active_user") || "null");
      if (activeUser && activeUser.uid === studentId) {
        activeUser.amountPaid = amountPaidNum;
        activeUser.nextDueDate = newDueDateStr;
        activeUser.payments = payments;
        localStorage.setItem("pfc_active_user", JSON.stringify(activeUser));
      }

      return updatedStudent;
    } else {
      const studentRef = doc(firebaseDb, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) throw new Error("Student not found in Firestore.");

      const student = studentSnap.data();
      const currentDueDate = student.nextDueDate;
      let startDateStr = paymentDate;
      
      if (currentDueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(currentDueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= -15) {
          startDateStr = currentDueDate;
        }
      }
      
      const newDueDateStr = addDays(startDateStr, cycleDaysInt);

      const newPayment = {
        id: "pay_" + Date.now(),
        amount: amountPaidNum,
        paymentDate,
        plan: student.plan,
        cycleDays: cycleDaysInt,
        startDate: startDateStr,
        endDate: newDueDateStr,
        timestamp: new Date().toISOString()
      };

      const payments = student.payments || [];
      payments.unshift(newPayment);

      const updateFields = {
        amountPaid: amountPaidNum,
        cycleDays: cycleDaysInt,
        nextDueDate: newDueDateStr,
        payments
      };

      await updateDoc(studentRef, updateFields);

      const userRef = doc(firebaseDb, "users", studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, updateFields);
      }

      return { ...student, ...updateFields };
    }
  },

  async deleteStudent(studentId) {
    await delay();
    if (useMock) {
      // 1. Remove from students
      let students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
      students = students.filter(s => s.uid !== studentId && s.id !== studentId);
      localStorage.setItem("pfc_students", JSON.stringify(students));

      // 2. Remove from users
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      delete users[studentId];
      localStorage.setItem("pfc_users", JSON.stringify(users));

      return true;
    } else {
      // Delete doc in students collection
      await deleteDoc(doc(firebaseDb, "students", studentId));
      // Delete doc in users collection
      await deleteDoc(doc(firebaseDb, "users", studentId));
      return true;
    }
  },

  async updateStudent(studentId, updatedData) {
    await delay();
    const { name, phone, email, plan, cycleDays } = updatedData;
    const cycleDaysInt = parseInt(cycleDays) || 30;

    if (useMock) {
      // 1. Update in students
      const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
      const idx = students.findIndex(s => s.uid === studentId || s.id === studentId);
      if (idx === -1) throw new Error("Student not found.");

      const student = students[idx];
      const prevCycleDays = student.cycleDays || 30;
      let nextDueDate = student.nextDueDate;

      // If cycleDays changed, we can adjust nextDueDate from start date
      if (cycleDaysInt !== prevCycleDays) {
        const start = new Date(student.startDate || student.createdAt || new Date());
        start.setDate(start.getDate() + cycleDaysInt);
        nextDueDate = start.toISOString().split("T")[0];
      }

      const updatedStudent = {
        ...student,
        name,
        phone,
        email,
        plan,
        cycleDays: cycleDaysInt,
        nextDueDate
      };

      students[idx] = updatedStudent;
      localStorage.setItem("pfc_students", JSON.stringify(students));

      // 2. Update in users
      const users = JSON.parse(localStorage.getItem("pfc_users") || "{}");
      if (users[studentId]) {
        users[studentId] = {
          ...users[studentId],
          name,
          email,
          plan,
          nextDueDate
        };
        localStorage.setItem("pfc_users", JSON.stringify(users));
      }

      // Update active session user if it's the current user
      const activeUser = JSON.parse(localStorage.getItem("pfc_active_user") || "null");
      if (activeUser && activeUser.uid === studentId) {
        const updatedActive = {
          ...activeUser,
          name,
          email,
          plan,
          nextDueDate
        };
        localStorage.setItem("pfc_active_user", JSON.stringify(updatedActive));
      }

      return updatedStudent;
    } else {
      const studentRef = doc(firebaseDb, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) throw new Error("Student not found in Firestore.");

      const student = studentSnap.data();
      const prevCycleDays = student.cycleDays || 30;
      let nextDueDate = student.nextDueDate;

      if (cycleDaysInt !== prevCycleDays) {
        const start = new Date(student.startDate || student.createdAt || new Date());
        start.setDate(start.getDate() + cycleDaysInt);
        nextDueDate = start.toISOString().split("T")[0];
      }

      const updateFields = {
        name,
        phone,
        email,
        plan,
        cycleDays: cycleDaysInt,
        nextDueDate
      };

      await updateDoc(studentRef, updateFields);

      const userRef = doc(firebaseDb, "users", studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          name,
          email,
          plan,
          nextDueDate
        });
      }

      return { ...student, ...updateFields };
    }
  },

  // ==========================================
  // REAL-TIME SUBSCRIPTIONS (live sync)
  // ==========================================

  subscribeToStudentDetails(uid, callback, onError) {
    if (useMock) {
      return mockSubscribe(
        () => {
          const students = JSON.parse(localStorage.getItem("pfc_students") || "[]");
          return students.find(s => s.uid === uid || s.id === uid) || null;
        },
        callback
      );
    }

    let unsubscribe = () => {};
    let active = true;

    (async () => {
      try {
        const { ref } = await resolveStudentRef(uid);
        if (!active) return;

        unsubscribe = onSnapshot(
          ref,
          (snap) => callback(snap.exists() ? snap.data() : null),
          onError
        );
      } catch (err) {
        onError?.(err);
        callback(null);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  },

  subscribeToStudents(callback, onError) {
    if (useMock) {
      return mockSubscribe(
        () => JSON.parse(localStorage.getItem("pfc_students") || "[]"),
        callback
      );
    }

    return onSnapshot(
      collection(firebaseDb, "students"),
      (snapshot) => callback(snapshot.docs.map(d => d.data())),
      onError
    );
  },

  subscribeToDailyMenu(dateStr, callback, onError) {
    if (useMock) {
      return mockSubscribe(
        () => {
          const menus = JSON.parse(localStorage.getItem("pfc_daily_menus") || "{}");
          return menus[dateStr] ? { date: dateStr, menuText: menus[dateStr] } : null;
        },
        callback
      );
    }

    return onSnapshot(
      doc(firebaseDb, "dailyMenu", dateStr),
      (snap) => callback(snap.exists() ? snap.data() : null),
      onError
    );
  },

  subscribeToHolidays(callback, onError) {
    if (useMock) {
      return mockSubscribe(
        () => JSON.parse(localStorage.getItem("pfc_holidays") || "[]"),
        callback
      );
    }

    return onSnapshot(
      collection(firebaseDb, "holidays"),
      (snapshot) => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      onError
    );
  }
};
