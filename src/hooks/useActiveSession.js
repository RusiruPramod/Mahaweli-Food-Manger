import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getToday } from "../utils/today";

/**
 * useActiveSession
 * Real-time listener for today's sessions.
 * NOTE: No orderBy — avoids composite index requirement.
 * Sorted client-side by createdAt.
 */
export function useActiveSession() {
  const today = getToday();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simple single-field query — no composite index needed
    const q = query(
      collection(db, "sessions"),
      where("date", "==", today)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort client-side by createdAt (timestamp seconds)
        docs.sort((a, b) => {
          const aT = a.createdAt?.seconds ?? 0;
          const bT = b.createdAt?.seconds ?? 0;
          return aT - bT;
        });
        setSessions(docs);
        setLoading(false);
      },
      (err) => {
        console.error("useActiveSession error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [today]);

  const activeSession = sessions.find((s) => s.status === "active") ?? null;

  return { sessions, activeSession, loading };
}
