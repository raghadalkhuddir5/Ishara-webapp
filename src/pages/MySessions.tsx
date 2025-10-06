/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Box, Stack, Typography, Chip, Button, Snackbar, Alert } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  interpreter_id: string;
}

function MySessions() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<SItem[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("user_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
        setItems(list);
      },
      (err) => {
        console.error("MySessions listener error", err);
      }
    );
    return () => unsub();
  }, [user]);

  // Fetch interpreter names for display
  useEffect(() => {
    const loadNames = async () => {
      const missing = Array.from(new Set(items.map((s) => s.interpreter_id))).filter((id) => !nameMap[id]);
      if (missing.length === 0) return;
      const entries: Record<string, string> = {};
      await Promise.all(
        missing.map(async (id) => {
          const snap = await getDoc(doc(db, "users", id));
          if (snap.exists()) entries[id] = (snap.data() as any).full_name || id;
        })
      );
      setNameMap((prev) => ({ ...prev, ...entries }));
    };
    if (items.length) void loadNames();
  }, [items, nameMap]);

  const statusLabel = (s: SItem["status"]) => {
    if (s === "requested") return t("status_requested");
    if (s === "confirmed") return t("status_confirmed");
    if (s === "cancelled") return t("status_cancelled");
    return s;
  };

  const cancelSession = async (id: string, currentStatus: string) => {
    if (currentStatus !== "requested") return;
    setCancellingId(id);
    try {
      await updateDoc(doc(db, "sessions", id), { status: "cancelled" });
      setMessage("Session cancelled successfully!");
      setOpen(true);
    } catch (e) {
      console.error("Cancel failed", e);
      setMessage("Failed to cancel session. Please try again.");
      setOpen(true);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("my_sessions")}</Typography>
      <Stack spacing={1}>
        {items.map((s) => (
          <Stack key={s.id} spacing={1} sx={{ border: "1px solid #ddd", p: 1, borderRadius: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography sx={{ minWidth: 120 }}><b>{t("session_time")}:</b> {new Date(s.scheduled_time).toLocaleString()}</Typography>
            <Typography sx={{ minWidth: 160 }}><b>{t("session_with")}:</b> {nameMap[s.interpreter_id] || s.interpreter_id}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Chip label={statusLabel(s.status)} color={s.status === "confirmed" ? "success" : s.status === "cancelled" ? "default" : "warning"} />
            </Stack>
            <Stack direction="row" spacing={1}>
              {s.status === "requested" && (
                <Button 
                  color="error" 
                  onClick={() => cancelSession(s.id, s.status)}
                  disabled={cancellingId === s.id}
                >
                  {cancellingId === s.id ? "Cancelling..." : "Cancel"}
                </Button>
              )}
              {s.status === "confirmed" && (
                <Button 
                  component={Link} 
                  to={`/call/${s.id}`} 
                  variant="contained"
                  color="primary"
                >
                  {t("join_call")}
                </Button>
              )}
            </Stack>
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
          severity={message.includes("successfully") ? "success" : "error"} 
          onClose={() => setOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default MySessions;


