import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBRi68pwRQs0VOI0FWdDMXvvz88t5tbO64",
  authDomain: "chirp-ab422.firebaseapp.com",
  databaseURL: "https://chirp-ab422-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chirp-ab422",
  storageBucket: "chirp-ab422.firebasestorage.app",
  messagingSenderId: "732947022450",
  appId: "1:732947022450:web:24ca79084a3460f877f8eb",
  measurementId: "G-S9GNX57EL9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getDatabase(app);

export default app;
