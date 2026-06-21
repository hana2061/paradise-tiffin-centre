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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { menuText } = req.body;

    const studentsSnapshot = await db.collection("students").get();

    let allTokens = [];
    studentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        allTokens.push(...data.fcmTokens);
      }
    });

    if (allTokens.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: "No tokens found" });
    }

    const message = {
      notification: {
        title: "Paradise Tiffin Centre",
        body: `Your tiffin is ready! 🍱 Today's menu: ${menuText}`
      },
      tokens: allTokens
    };

    const response = await getMessaging().sendEachForMulticast(message);

    return res.status(200).json({
      success: true,
      count: response.successCount,
      failed: response.failureCount
    });
  } catch (error) {
    console.error("Notification send error:", error);
    return res.status(500).json({ error: error.message });
  }
}