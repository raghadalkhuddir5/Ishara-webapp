import { useEffect, useState } from "react";
import { Alert, Box, Container, Button, Checkbox, FormControlLabel, Snackbar, Stack, Typography, Card, CardContent, Switch, CircularProgress, useMediaQuery, useTheme } from "@mui/material";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";

type DayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
type Shift = "morning" | "evening";

interface AvailabilityConfig {
  isAlwaysAvailable: boolean;
  days: Record<DayKey, { morning: boolean; evening: boolean }>;
}

function Availability() {
  const { user } = useAuth();
  const { t, direction } = useI18n();
  const isRTL = direction === "rtl";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "interpreters", user.uid), (snap) => {
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
      console.error("Availability listener error:", error);
      setLoading(false);
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
      await setDoc(doc(db, "interpreters", user.uid), interpreterData);
      setMessage(t("signup_success"));
      setOpen(true);
    } catch (e) {
      console.error("Failed to create interpreter doc:", e);
      setMessage(t("availability_update_failed"));
      setOpen(true);
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

  const toggleAlwaysAvailable = (checked: boolean) => {
    if (!config) return;
    setConfig({
      ...config,
      isAlwaysAvailable: checked
    });
  };

  const days: { key: DayKey; label: string }[] = [
    { key: "sunday", label: t("sunday") },
    { key: "monday", label: t("monday") },
    { key: "tuesday", label: t("tuesday") },
    { key: "wednesday", label: t("wednesday") },
    { key: "thursday", label: t("thursday") },
    { key: "friday", label: t("friday") },
    { key: "saturday", label: t("saturday") },
  ];

  if (loading) {
    return (
      <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 }, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress sx={{ color: "#008080" }} />
            <Typography sx={{ color: "#666", direction: direction }}>{t("loading")}</Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mb: { xs: 3, md: 4 },
            textAlign: "center",
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "#333",
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
              mb: 1,
              direction: direction,
              textAlign: "center",
            }}
          >
            {t("weekly_availability")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#666",
              fontSize: { xs: "0.875rem", md: "1rem" },
              direction: direction,
              textAlign: "center",
            }}
          >
            {t("service_flexible_scheduling")}
          </Typography>
        </Box>

        {config && config.days ? (
          <Stack spacing={3}>
            {/* Always Available Toggle */}
            <Card
              sx={{
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                bgcolor: "white",
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 2, sm: 2 }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ flexDirection: { xs: "column", sm: isRTL ? "row-reverse" : "row" } }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2 }, flexDirection: isRTL ? "row-reverse" : "row", width: { xs: "100%", sm: "auto" } }}>
                    <AccessTimeIcon sx={{ color: "#008080", fontSize: { xs: "1.75rem", md: "2rem" } }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#333",
                        fontSize: { xs: "0.95rem", sm: "1rem", md: "1.1rem" },
                        direction: direction,
                      }}
                    >
                      {t("always_available")}
                    </Typography>
                  </Box>
                  <Switch
                    checked={config.isAlwaysAvailable || false}
                    onChange={(e) => toggleAlwaysAvailable(e.target.checked)}
                    sx={{
                      alignSelf: { xs: isRTL ? "flex-start" : "flex-end", sm: "center" },
                      "& .MuiSwitch-switchBase.Mui-checked": {
                        color: "#008080",
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        backgroundColor: "#008080",
                      },
                    }}
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Days Grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(2, 1fr)",
                  lg: "repeat(2, 1fr)",
                },
                gap: { xs: 1.5, md: 2 },
              }}
            >
              {days.map((day) => {
                const dayConfig = config.days[day.key];
                const isDayAvailable = dayConfig?.morning || dayConfig?.evening;
                
                return (
                  <Card
                    key={day.key}
                    sx={{
                      borderRadius: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                      },
                      bgcolor: isDayAvailable ? "rgba(0,128,128,0.05)" : "white",
                      border: isDayAvailable ? "2px solid #008080" : "2px solid transparent",
                    }}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "#333",
                          mb: { xs: 1.5, md: 2 },
                          fontSize: { xs: "0.95rem", sm: "1rem", md: "1.1rem" },
                          direction: direction,
                          textAlign: "center",
                        }}
                      >
                        {day.label}
                      </Typography>
                      <Stack spacing={{ xs: 1.5, md: 2 }}>
                        {/* Morning Shift */}
                        <Box
                          sx={{
                            p: { xs: 1.25, md: 1.5 },
                            borderRadius: "8px",
                            bgcolor: dayConfig?.morning ? "rgba(0,128,128,0.1)" : "#f5f5f5",
                            border: dayConfig?.morning ? "1px solid #008080" : "1px solid #e0e0e0",
                            transition: "all 0.2s ease",
                            cursor: config.isAlwaysAvailable ? "not-allowed" : "pointer",
                            opacity: config.isAlwaysAvailable ? 0.5 : 1,
                            minHeight: { xs: "48px", md: "auto" },
                            display: "flex",
                            alignItems: "center",
                          }}
                          onClick={() => !config.isAlwaysAvailable && toggleDayShift(day.key, "morning")}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={dayConfig?.morning || false}
                                onChange={() => toggleDayShift(day.key, "morning")}
                                disabled={config.isAlwaysAvailable}
                                sx={{
                                  color: "#008080",
                                  "&.Mui-checked": {
                                    color: "#008080",
                                  },
                                  padding: { xs: "9px", md: "9px" },
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.75, md: 1 }, flexDirection: isRTL ? "row-reverse" : "row" }}>
                                <WbSunnyIcon sx={{ color: "#ff9800", fontSize: { xs: "1.1rem", md: "1.2rem" } }} />
                                <Typography
                                  sx={{
                                    fontSize: { xs: "0.8rem", sm: "0.875rem", md: "0.95rem" },
                                    fontWeight: dayConfig?.morning ? 600 : 400,
                                    color: dayConfig?.morning ? "#008080" : "#666",
                                    direction: direction,
                                    textAlign: isRTL ? "right" : "left",
                                  }}
                                >
                                  {t("morning_shift")}
                                </Typography>
                              </Box>
                            }
                            sx={{
                              m: 0,
                              width: "100%",
                              justifyContent: isRTL ? "flex-end" : "flex-start",
                              flexDirection: isRTL ? "row-reverse" : "row",
                            }}
                          />
                        </Box>

                        {/* Evening Shift */}
                        <Box
                          sx={{
                            p: { xs: 1.25, md: 1.5 },
                            borderRadius: "8px",
                            bgcolor: dayConfig?.evening ? "rgba(0,128,128,0.1)" : "#f5f5f5",
                            border: dayConfig?.evening ? "1px solid #008080" : "1px solid #e0e0e0",
                            transition: "all 0.2s ease",
                            cursor: config.isAlwaysAvailable ? "not-allowed" : "pointer",
                            opacity: config.isAlwaysAvailable ? 0.5 : 1,
                            minHeight: { xs: "48px", md: "auto" },
                            display: "flex",
                            alignItems: "center",
                          }}
                          onClick={() => !config.isAlwaysAvailable && toggleDayShift(day.key, "evening")}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={dayConfig?.evening || false}
                                onChange={() => toggleDayShift(day.key, "evening")}
                                disabled={config.isAlwaysAvailable}
                                sx={{
                                  color: "#008080",
                                  "&.Mui-checked": {
                                    color: "#008080",
                                  },
                                  padding: { xs: "9px", md: "9px" },
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.75, md: 1 }, flexDirection: isRTL ? "row-reverse" : "row" }}>
                                <NightsStayIcon sx={{ color: "#1976d2", fontSize: { xs: "1.1rem", md: "1.2rem" } }} />
                                <Typography
                                  sx={{
                                    fontSize: { xs: "0.8rem", sm: "0.875rem", md: "0.95rem" },
                                    fontWeight: dayConfig?.evening ? 600 : 400,
                                    color: dayConfig?.evening ? "#008080" : "#666",
                                    direction: direction,
                                    textAlign: isRTL ? "right" : "left",
                                  }}
                                >
                                  {t("evening_shift")}
                                </Typography>
                              </Box>
                            }
                            sx={{
                              m: 0,
                              width: "100%",
                              justifyContent: isRTL ? "flex-end" : "flex-start",
                              flexDirection: isRTL ? "row-reverse" : "row",
                            }}
                          />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {/* Save Button */}
            <Box sx={{ display: "flex", justifyContent: "center", pt: { xs: 2, md: 3 } }}>
              <Button
                variant="contained"
                onClick={saveConfig}
                disabled={saving}
                size="large"
                fullWidth={isMobile}
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#008080",
                  px: { xs: 3, sm: 4, md: 6 },
                  py: { xs: 1.25, sm: 1.5, md: 1.5 },
                  fontSize: { xs: "0.9rem", sm: "0.95rem", md: "1rem" },
                  fontWeight: 500,
                  textTransform: "none",
                  minWidth: { xs: "100%", sm: "200px", md: "250px" },
                  maxWidth: { xs: "100%", sm: "none" },
                  "&:hover": {
                    bgcolor: "#006666",
                  },
                  "&:disabled": {
                    bgcolor: "#cccccc",
                  },
                }}
              >
                {saving ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={20} sx={{ color: "white" }} />
                    <Typography sx={{ direction: direction, fontSize: { xs: "0.9rem", sm: "0.95rem", md: "1rem" } }}>{t("loading")}</Typography>
                  </Box>
                ) : (
                  t("save_changes")
                )}
              </Button>
            </Box>
          </Stack>
        ) : (
          <Card
            sx={{
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              bgcolor: "white",
              p: { xs: 3, md: 4 },
              textAlign: "center",
            }}
          >
            <Typography
              variant="body1"
              sx={{
                color: "#666",
                mb: { xs: 2, md: 3 },
                direction: direction,
                fontSize: { xs: "0.9rem", md: "1rem" },
              }}
            >
              {t("no_interpreter_profile_found")}
            </Typography>
            <Button
              variant="contained"
              onClick={createInterpreterDoc}
              fullWidth={isMobile}
              sx={{
                borderRadius: "8px",
                bgcolor: "#008080",
                px: { xs: 3, sm: 4, md: 4 },
                py: { xs: 1.25, sm: 1.5, md: 1.5 },
                fontSize: { xs: "0.9rem", sm: "0.95rem", md: "1rem" },
                fontWeight: 500,
                textTransform: "none",
                maxWidth: { xs: "100%", sm: "300px" },
                "&:hover": {
                  bgcolor: "#006666",
                },
              }}
            >
              {t("create_interpreter_profile")}
            </Button>
          </Card>
        )}

        <Snackbar
          open={open}
          autoHideDuration={4000}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={message.includes("successfully") || message.includes(t("availability_updated")) || message.includes(t("signup_success")) ? "success" : "error"}
            onClose={() => setOpen(false)}
            sx={{ direction: direction }}
          >
            {message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default Availability;
