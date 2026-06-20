import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

// Helper to load environment variables from .env files
function loadEnv() {
  const envPaths = [".env.local", ".env"];
  for (const envFile of envPaths) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const parts = trimmed.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const serverKey = process.env.VITE_FIREBASE_FCM_SERVER_KEY;

// Check if we are running in Mock Mode
const useMock = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_") || firebaseConfig.apiKey === "";

const getLocalDateString = (offsetDays = 0) => {
  const date = new Date();
  // Adjust for local timezone offset
  const localTime = date.getTime() - (date.getTimezoneOffset() * 60000);
  const localDate = new Date(localTime);
  localDate.setDate(localDate.getDate() + offsetDays);
  return localDate.toISOString().split("T")[0];
};

async function runReminderTask() {
  const targetDateStr = getLocalDateString(2);
  console.log(`[${new Date().toISOString()}] Running payment reminder task for due date: ${targetDateStr}`);
  
  if (useMock) {
    console.warn("Firebase credentials not configured. Running in Local Mock Mode simulation.");
    console.log("Looking for students with Next Due Date:", targetDateStr);
    
    // Simulate checking mock students from local storage mock
    let mockStudents = [];
    try {
      // In local node context we don't have localStorage, but we can search if a mock JSON exists
      const studentsPath = path.resolve(process.cwd(), "mock_students.json");
      if (fs.existsSync(studentsPath)) {
        mockStudents = JSON.parse(fs.readFileSync(studentsPath, "utf-8"));
      } else {
        // Fallback default list
        mockStudents = [
          {
            name: "Rahul Sharma",
            email: "rahul@paradise.com",
            nextDueDate: getLocalDateString(2), // Mock Rahul as due in 2 days
            amountPaid: 3300,
            fcmTokens: ["mock_token_rahul"]
          }
        ];
      }
    } catch (e) {
      console.error("Failed to load mock students:", e.message);
    }

    const affected = mockStudents.filter(s => s.nextDueDate === targetDateStr);
    console.log(`Found ${affected.length} student(s) due in 2 days.`);
    
    for (const student of affected) {
      const amount = student.amountPaid || 0;
      const message = `⏰ Payment Reminder from Paradise Tiffin Centre! Your tiffin payment of ₹${amount} is due in 2 days. Please pay on time to continue enjoying your tiffin service. 🍱`;
      console.log(`[SIMULATED PUSH NOTIFICATION]`);
      console.log(`To: ${student.name} (${student.email})`);
      console.log(`Tokens: ${JSON.stringify(student.fcmTokens)}`);
      console.log(`Message: "${message}"`);
    }
    return;
  }

  // Live Firestore Mode
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log("Querying students due on:", targetDateStr);
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("nextDueDate", "==", targetDateStr));
    const querySnapshot = await getDocs(q);
    
    console.log(`Found ${querySnapshot.size} student(s) due on ${targetDateStr}.`);
    
    let sentCount = 0;
    for (const docSnap of querySnapshot.docs) {
      const student = docSnap.data();
      const tokens = student.fcmTokens || [];
      if (tokens.length === 0) {
        console.log(`Student ${student.name} has no registered FCM tokens. Skipping.`);
        continue;
      }
      
      const amount = student.amountPaid || 0;
      const message = `⏰ Payment Reminder from Paradise Tiffin Centre! Your tiffin payment of ₹${amount} is due in 2 days. Please pay on time to continue enjoying your tiffin service. 🍱`;
      
      console.log(`Sending reminder to ${student.name} (${tokens.length} token(s))`);
      
      if (!serverKey) {
        console.error("VITE_FIREBASE_FCM_SERVER_KEY is not configured. Cannot send push notification.");
        continue;
      }

      try {
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `key=${serverKey}`
          },
          body: JSON.stringify({
            registration_ids: tokens,
            notification: {
              title: "Paradise Tiffin Centre",
              body: message,
              icon: "/favicon.ico"
            }
          })
        });
        
        const resJson = await response.json();
        console.log(`FCM response for ${student.name}:`, resJson);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send notification to ${student.name}:`, err);
      }
    }
    
    console.log(`Completed running task. Notifications sent to ${sentCount} students.`);
  } catch (error) {
    console.error("Error executing live Firestore reminder task:", error);
  }
}

runReminderTask().catch(console.error);
