import admin from "firebase-admin";

// Initialize Firebase Admin only once (serverless functions can reuse warm instances)
if (!admin.apps.length) {
  console.error("DEBUG - env var exists:", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.error("DEBUG - env var length:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0);
  console.error("DEBUG - env var first 20 chars:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 20) || "EMPTY");

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { menuText } = req.body;

    // 1. Get all students from Firestore
    const studentsSnapshot = await db.collection("students").get();

    // 2. Collect all FCM tokens
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

    // 3. Send notification using modern FCM v1 API (multicast)
    const message = {
      notification: {
        title: "Paradise Tiffin Centre",
        body: `Your tiffin is ready! 🍱 Today's menu: ${menuText}`
      },
      tokens: allTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

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