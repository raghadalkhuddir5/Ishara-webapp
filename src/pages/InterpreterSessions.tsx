/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { isSessionExpired } from "../utils/sessionUtils";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  user_id: string;
}

function InterpreterSessions() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<SItem[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("interpreter_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((s) => s.status === "confirmed" || s.status === "completed")
          .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
        setItems(list);
      },
      (err) => {
        console.error("InterpreterSessions listener error", err);
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const loadNames = async () => {
      const missing = Array.from(new Set(items.map((s) => s.user_id))).filter((id) => !nameMap[id]);
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

  const statusLabel = (status: string) => {
    if (status === "requested") return t("status_requested");
    if (status === "confirmed") return t("status_confirmed");
    if (status === "cancelled") return t("status_cancelled");
    if (status === "completed") return t("status_completed");
    return status;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("interpreter_sessions")}</Typography>
      <Stack spacing={1}>
        {items.map((s) => (
          <Stack key={s.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ border: "1px solid #ddd", p: 1, borderRadius: 1 }}>
            <Typography sx={{ minWidth: 240 }}>{new Date(s.scheduled_time).toLocaleString()}</Typography>
            <Typography sx={{ minWidth: 160 }}>{nameMap[s.user_id] || s.user_id}</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Chip label={statusLabel(s.status)} color={s.status === "confirmed" ? "success" : "default"} />
            {s.status === "confirmed" && (() => {
              // Check if session is expired (past scheduled time)
              const expired = isSessionExpired(s.scheduled_time);
              
              return !expired ? (
                <Button 
                  component={Link} 
                  to={`/call/${s.id}`} 
                  variant="contained"
                  color="primary"
                >
                  {t("join_call")}
                </Button>
              ) : (
                <Chip 
                  label={t("expired")} 
                  color="error" 
                  variant="outlined"
                  size="small"
                />
              );
            })()}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default InterpreterSessions;