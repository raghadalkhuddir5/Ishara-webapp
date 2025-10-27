/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Button, Stack, Typography, Snackbar, Alert } from "@mui/material";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { startCall } from "../services/callService";
import { createSessionConfirmedNotification, createSessionCancelledNotification } from "../services/notificationService";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  user_id: string;
}

function Requests() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<SItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("interpreter_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        data.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
        setItems(data);
      },
      (err) => {
        console.error("Requests listener error", err);
      }
    );
    return () => unsub();
  }, [user]);

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setSavingId(id);
    try {
      // Get session data first to get user_id
      const sessionDoc = await doc(db, "sessions", id);
      const sessionSnap = await getDoc(sessionDoc);
      const sessionData = sessionSnap.data();
      
      if (!sessionData) {
        throw new Error('Session not found');
      }

      // Update session status
      await updateDoc(sessionDoc, { status });
      
      // Create notifications and call records based on status
      if (status === "confirmed") {
        try {
          // Create call record for the session
          await startCall(id, sessionData.user_id, user!.uid);
          console.log('Call record created for session:', id);
          
          // Create notification for the user
          await createSessionConfirmedNotification(
            sessionData.user_id, 
            id, 
            new Date(sessionData.scheduled_time)
          );
          console.log('Session confirmed notification created');
        } catch (error) {
          console.error('Failed to create call record or notification:', error);
          // Don't fail the whole operation if these fail
        }
      } else if (status === "cancelled") {
        try {
          // Create cancellation notification for the user
          await createSessionCancelledNotification(
            sessionData.user_id, 
            id, 
            t("session_cancelled_by_interpreter")
          );
          console.log('Session cancelled notification created');
        } catch (error) {
          console.error('Failed to create cancellation notification:', error);
          // Don't fail the whole operation if this fails
        }
      }
      
      const action = status === "confirmed" ? "accepted" : "rejected";
      setMessage(status === "confirmed" ? t("request_accepted") : t("request_rejected"));
      setOpen(true);
    } catch (e) {
      console.error(`Failed to update session status to ${status}:`, e);
      setMessage(t("request_action_failed"));
      setOpen(true);
    } finally {
      setSavingId(null);
    }
  };
  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("requests_title")}</Typography>
      <Stack spacing={1}>
        {items.map((s) => (
          <Stack key={s.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ border: "1px solid #ddd", p: 1, borderRadius: 1 }}>
            <Typography sx={{ minWidth: 240 }}>{new Date(s.scheduled_time).toLocaleString()}</Typography>
            <Typography sx={{ minWidth: 120 }}>{t(`status_${s.status}`)}</Typography>
            <Box sx={{ flexGrow: 1 }} />
            {s.status === "requested" && (
              <>
                <Button variant="contained" onClick={() => updateStatus(s.id, "confirmed")} disabled={savingId === s.id}>{savingId === s.id ? t("signing_in") : t("accept")}</Button>
                <Button color="error" onClick={() => updateStatus(s.id, "cancelled")} disabled={savingId === s.id}>{savingId === s.id ? t("signing_in") : t("reject")}</Button>
              </>
            )}
          </Stack>
        ))}
      </Stack>
      
      <Snackbar 
        open={open} 
        autoHideDuration={4000} 
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert 
          severity={message.includes("successfully") || message.includes(t("request_accepted")) ? "success" : "error"} 
          onClose={() => setOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Requests;