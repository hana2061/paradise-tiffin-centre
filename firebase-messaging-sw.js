importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAsmx8nv6UGHeZ1SrqXem2kW36xNYAyPLs",
  authDomain: "paradise-tiffin.firebaseapp.com",
  projectId: "paradise-tiffin",
  storageBucket: "paradise-tiffin.appspot.com",
  messagingSenderId: "1051492488888",
  appId: "1:1051492488888:web:1234567890abcdef"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  const notificationTitle = payload.notification?.title || "Paradise Tiffin Centre";
  const notificationOptions = {
    body: payload.notification?.body || "Your tiffin is ready!",
    icon: "/logo192.png" // we'll add this icon in a later step
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});