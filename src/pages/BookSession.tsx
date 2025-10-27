/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Button, Radio, RadioGroup, FormControlLabel, Stack, TextField, Typography, Snackbar, Alert } from "@mui/material";
import { useI18n } from "../context/I18nContext";
import { useState } from "react";
import { collection, doc, getDocs, addDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Star } from "@mui/icons-material";

function BookSession() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [mode, setMode] = useState<"immediate" | "scheduled">("immediate");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [matchingInterpreters, setMatchingInterpreters] = useState<Array<{ id: string; full_name?: string; average_rating?: number }>>([]);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);

  // Removed unused useEffect for loading interpreters

  // Helper to check if a given ISO date/time fits the interpreter's weekly config
  const isAvailableAt = (cfg: { isAlwaysAvailable: boolean; days: Record<string, { morning: boolean; evening: boolean }> }, at: Date) => {
    if (cfg.isAlwaysAvailable) return true;
    const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
    const dayKey = dayNames[at.getDay()];
    const hour = at.getHours();
    const dayCfg = (cfg.days as any)[dayKey] as { morning: boolean; evening: boolean } | undefined;
    if (!dayCfg) return false;
    const inMorning = hour >= 6 && hour < 14;
    const inEvening = hour >= 14 && hour < 22;
    return (dayCfg.morning && inMorning) || (dayCfg.evening && inEvening);
  };

  const findMatching = async () => {
    const now = new Date();
    const target = mode === "immediate" ? now : (date && time ? new Date(`${date}T${time}:00`) : null);
    if (!target) return;
    if (target < now) {
      setMessage(t("select_future_date_time"));
      setOpen(true);
      return;
    }
    // Query interpreters collection directly
    const interpretersSnap = await getDocs(collection(db, "interpreters"));
    const result: Array<{ id: string; full_name?: string; average_rating?: number }> = [];
    
    for (const interpreterDoc of interpretersSnap.docs) {
      const interpreterData = interpreterDoc.data() as any;
      const availability = interpreterData.availability;
      
      if (!availability) continue;
      
      if (isAvailableAt(availability, target)) {
        // Get user data for full_name
        const userSnap = await getDoc(doc(db, "users", interpreterDoc.id));
        const userData = userSnap.exists() ? userSnap.data() as any : {};
        
        result.push({ 
          id: interpreterDoc.id, 
          full_name: userData.full_name || interpreterData.full_name || interpreterDoc.id,
          average_rating: interpreterData.average_rating || 0
        });
      }
    }
    
    if (result.length === 0) {
      setMessage(t("no_available_interpreters"));
      setOpen(true);
    }
    
    setMatchingInterpreters(result);
  };

  const requestSession = async (interpreterId: string) => {
    if (!user) {
      setMessage(t("please_login_to_book_session"));
      setOpen(true);
      return;
    }
    
    if (!interpreterId) {
      setMessage(t("please_select_interpreter"));
      setOpen(true);
      return;
    }
    
    setBooking(true);
    try {
      const now = new Date();
      const scheduled = mode === "immediate" ? now : (date && time ? new Date(`${date}T${time}:00`) : now);
      
      if (scheduled < now) {
        setMessage(t("select_future_date_time"));
        setOpen(true);
        return;
      }
      
      if (mode === "scheduled" && (!date || !time)) {
        setMessage(t("select_date_and_time_for_scheduled"));
        setOpen(true);
        return;
      }
      
      const scheduledTime = scheduled.toISOString();
      await addDoc(collection(db, "sessions"), {
        user_id: user.uid,
        interpreter_id: interpreterId,
        scheduled_time: scheduledTime,
        status: "requested",
        duration: 0,
        created_at: serverTimestamp(),
        reminderSent: false,
        is_rated: false
      });
      setMessage(t("session_booked"));
      setOpen(true);
    } catch (e) {
      console.error("Failed to create session", e);
      setMessage(t("session_booking_failed"));
      setOpen(true);
    } finally {
      setBooking(false);
    }
  };
  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("book_title")}</Typography>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <div>
          <Typography sx={{ mb: 1 }}>{t("booking_mode")}</Typography>
          <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <FormControlLabel value="immediate" control={<Radio />} label={t("immediate")} />
            <FormControlLabel value="scheduled" control={<Radio />} label={t("scheduled")} />
          </RadioGroup>
        </div>
        {mode === "scheduled" && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date"
              label={t("select_date")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              inputProps={{ min: new Date().toISOString().split("T")[0] }}
              fullWidth
            />
            <TextField
              type="time"
              label={t("select_time")}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              fullWidth
            />
          </Stack>
        )}
        <Button variant="outlined" onClick={findMatching}>{t("find_interpreters")}</Button>
        <div>
          <Typography sx={{ mb: 1 }}>{t("available_interpreters")}</Typography>
          <Stack spacing={1}>
            {matchingInterpreters.map((i) => (
              <Stack key={i.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ border: "1px solid #ddd", p: 1, borderRadius: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 'bold' }}>{i.full_name || i.id}</Typography>
                  {(i.average_rating || 0) > 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <Star sx={{ fontSize: 16, color: '#ffc107' }} />
                      <Typography variant="body2" color="text.secondary">
                        {i.average_rating || 0}/5
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("no_ratings_yet")}
                    </Typography>
                  )}
                </Box>
                <Button 
                  variant="contained" 
                  onClick={() => requestSession(i.id)}
                  disabled={booking}
                >
                  {booking ? t("signing_in") : t("reserve")}
                </Button>
              </Stack>
            ))}
          </Stack>
        </div>
      </Stack>
      
      <Snackbar 
        open={open} 
        autoHideDuration={5000} 
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

export default BookSession;