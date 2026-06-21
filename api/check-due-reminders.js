import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  try {
    // Calculate the date that is exactly 2 days from today
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 2);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    // Get all students
    const studentsSnapshot = await db.collection("students").get();

    let remindersSent = 0;
    const messages = [];

    studentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.nextDueDate === targetDateStr && data.fcmTokens && data.fcmTokens.length > 0) {
        data.fcmTokens.forEach((token) => {
          messages.push({
            token,
            notification: {
              title: "Paradise Tiffin Centre",
              body: `⏰ Payment Reminder: Your tiffin payment of ₹${data.amountPaid || 0} is due in 2 days. Please pay on time to continue your service.`
            }
          });
        });
        remindersSent++;
      }
    });

    if (messages.length === 0) {
      return res.status(200).json({ success: true, remindersSent: 0, message: "No students due in 2 days" });
    }

    // Send all messages
    const response = await getMessaging().sendEach(messages);

    return res.status(200).json({
      success: true,
      studentsMatched: remindersSent,
      notificationsSent: response.successCount,
      failed: response.failureCount
    });
  } catch (error) {
    console.error("Due reminder check error:", error);
    return res.status(500).json({ error: error.message });
  }
}