import { useEffect, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Snackbar, Stack, Typography } from "@mui/material";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

type DayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
type Shift = "morning" | "evening";

interface AvailabilityConfig {
  isAlwaysAvailable: boolean;
  days: Record<DayKey, { morning: boolean; evening: boolean }>;
}

function Availability() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    console.log("🔍 Loading availability for interpreter:", user.uid);
    const unsub = onSnapshot(doc(db, "interpreters", user.uid), (snap) => {
      console.log("📄 Interpreter doc snapshot:", snap.exists(), snap.data());
      setLoading(false);
      if (snap.exists()) {
        const data = snap.data() as { availability?: AvailabilityConfig };
        setConfig(data.availability || {
          isAlwaysAvailable: false,
          days: {
            sunday: { morning: false, evening: false },
            monday: { morning: false, evening: false },
            tuesday: { morning: false, evening: false },
            wednesday: { morning: false, evening: false },
            thursday: { morning: false, evening: false },
            friday: { morning: false, evening: false },
            saturday: { morning: false, evening: false },
          },
        });
      } else {
        console.log("⚠️ No interpreter doc found, creating default config");
        setConfig({
          isAlwaysAvailable: false,
          days: {
            sunday: { morning: false, evening: false },
            monday: { morning: false, evening: false },
            tuesday: { morning: false, evening: false },
            wednesday: { morning: false, evening: false },
            thursday: { morning: false, evening: false },
            friday: { morning: false, evening: false },
            saturday: { morning: false, evening: false },
          },
        });
      }
    }, (error) => {
      console.error("❌ Availability listener error:", error);
      setLoading(false);
      alert(`Error loading availability: ${error.message || error}`);
    });
    return () => unsub();
  }, [user]);

  const saveConfig = async () => {
    if (!user || !config) return;
    setSaving(true);
    setMessage("");
        try {
          await setDoc(doc(db, "interpreters", user.uid), { availability: config }, { merge: true });
          setMessage(t("availability_updated"));
          setOpen(true);
        } catch (e) {
          console.error("Failed to save availabilityConfig", e);
          setMessage(t("availability_update_failed"));
          setOpen(true);
        } finally {
          setSaving(false);
        }
  };

  const createInterpreterDoc = async () => {
    if (!user) return;
    console.log("🔄 Creating interpreter document for:", user.uid);
    try {
      const interpreterData = {
        interpreter_id: user.uid,
        availability: {
          isAlwaysAvailable: false,
          days: {
            sunday: { morning: false, evening: false },
            monday: { morning: false, evening: false },
            tuesday: { morning: false, evening: false },
            wednesday: { morning: false, evening: false },
            thursday: { morning: false, evening: false },
            friday: { morning: false, evening: false },
            saturday: { morning: false, evening: false },
          },
        },
        average_rating: 0,
        total_sessions: 0,
        bio: "",
      };
      console.log("📝 Data to save:", interpreterData);
      await setDoc(doc(db, "interpreters", user.uid), interpreterData);
      console.log("✅ Interpreter document created successfully");
      alert(t("signup_success"));
    } catch (e) {
      console.error("❌ Failed to create interpreter doc:", e);
      console.error("Error details:", e);
      alert(`Failed to create interpreter profile: ${(e as Error).message || e}`);
    }
  };

  const toggleDayShift = (day: DayKey, shift: Shift) => {
    if (!config || !config.days) return;
    setConfig({
      ...config,
      days: {
        ...config.days,
        [day]: { ...config.days[day], [shift]: !config.days[day][shift] }
      }
    });
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>{t("weekly_availability")}</Typography>
        <Typography>{t("loading")}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("weekly_availability")}</Typography>
      {config && config.days ? (
        <Stack spacing={2}>
          <FormControlLabel
            control={<Checkbox checked={config.isAlwaysAvailable || false} onChange={(e) => setConfig({ ...config, isAlwaysAvailable: e.target.checked })} />}
            label={t("always_available")}
          />
          {(["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as DayKey[]).map((dayKey) => (
            <Stack key={dayKey} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ border: "1px solid #ddd", p: 1, borderRadius: 1 }}>
              <Typography sx={{ width: 140 }}>{t(dayKey)}</Typography>
              <FormControlLabel
                control={<Checkbox checked={config.days[dayKey]?.morning || false} onChange={() => toggleDayShift(dayKey, "morning")} disabled={config.isAlwaysAvailable} />}
                label={t("morning_shift")}
              />
              <FormControlLabel
                control={<Checkbox checked={config.days[dayKey]?.evening || false} onChange={() => toggleDayShift(dayKey, "evening")} disabled={config.isAlwaysAvailable} />}
                label={t("evening_shift")}
              />
            </Stack>
          ))}
          <Button variant="contained" onClick={saveConfig} disabled={saving}>{saving ? "..." : t("save_changes")}</Button>
          {message === "saved" && <Typography color="success.main">✓</Typography>}
        </Stack>
      ) : (
        <Box>
          <Typography>{t("no_interpreter_profile_found")}</Typography>
          <Button variant="contained" onClick={createInterpreterDoc} sx={{ mt: 2 }}>
            {t("create_interpreter_profile")}
          </Button>
        </Box>
      )}
          <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
            <Alert severity={message.includes("successfully") ? "success" : "error"} onClose={() => setOpen(false)}>
              {message}
            </Alert>
          </Snackbar>
    </Box>
  );
}

export default Availability;