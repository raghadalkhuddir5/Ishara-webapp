/**
 * Book Session Page Component
 * 
 * This page allows deaf/mute users to book interpretation sessions with interpreters.
 * Users can choose between immediate sessions or scheduled sessions, search for available
 * interpreters based on their availability, and request sessions.
 * 
 * Features:
 * - Two booking modes: immediate or scheduled
 * - Search for available interpreters based on time
 * - View interpreter ratings
 * - Request sessions with selected interpreters
 * - Real-time availability checking
 * - RTL support for Arabic
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Container, Button, Stack, TextField, Typography, Snackbar, Alert, Card, CardContent, CircularProgress } from "@mui/material";
import { useI18n } from "../context/I18nContext";
import { useState } from "react";
import { collection, doc, getDocs, addDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PersonIcon from "@mui/icons-material/Person";
import StarIcon from "@mui/icons-material/Star";
import SearchIcon from "@mui/icons-material/Search";

/**
 * BookSession Component
 * 
 * Main component for booking interpretation sessions.
 */
function BookSession() {
  // Get internationalization context
  const { t, direction } = useI18n();
  
  // Get authenticated user (deaf/mute)
  const { user } = useAuth();
  const isRTL = direction === "rtl";
  
  // Component state
  const [mode, setMode] = useState<"immediate" | "scheduled">("immediate"); // Booking mode selection
  const [date, setDate] = useState<string>(""); // Selected date for scheduled sessions
  const [time, setTime] = useState<string>(""); // Selected time for scheduled sessions
  const [matchingInterpreters, setMatchingInterpreters] = useState<Array<{ id: string; full_name?: string; average_rating?: number }>>([]); // Available interpreters matching search
  const [booking, setBooking] = useState(false); // Loading state when booking session
  const [searching, setSearching] = useState(false); // Loading state when searching for interpreters
  const [hasSearched, setHasSearched] = useState(false); // Track if search has been performed (for empty state)
  const [message, setMessage] = useState<string>(""); // Success/error message
  const [open, setOpen] = useState(false); // Controls snackbar visibility

  /**
   * Check if interpreter is available at a specific date/time
   * 
   * Validates if an interpreter's availability configuration matches the requested time.
   * Checks for "always available" mode or matches day/shift availability.
   * 
   * @param cfg - Interpreter's availability configuration
   * @param at - Date/time to check availability for
   * @returns true if interpreter is available at the specified time, false otherwise
   */
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

  /**
   * Find matching interpreters based on availability
   * 
   * Searches all interpreters and filters those available at the requested time.
   * For immediate mode, uses current time. For scheduled mode, uses selected date/time.
   * 
   * Process:
   * 1. Validates date/time inputs
   * 2. Queries all interpreters from Firestore
   * 3. Checks each interpreter's availability configuration
   * 4. Fetches user names for display
   * 5. Returns list of available interpreters
   */
  const findMatching = async () => {
    if (mode === "scheduled" && (!date || !time)) {
      setMessage(t("select_date_and_time_for_scheduled"));
      setOpen(true);
      return;
    }
    
    const now = new Date();
    const target = mode === "immediate" ? now : (date && time ? new Date(`${date}T${time}:00`) : null);
    if (!target) return;
    if (target < now) {
      setMessage(t("select_future_date_time"));
      setOpen(true);
      return;
    }
    
    setSearching(true);
    setMatchingInterpreters([]);
    setHasSearched(true);
    
    try {
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
    } catch (error) {
      console.error("Failed to find interpreters:", error);
      setMessage(t("session_booking_failed"));
      setOpen(true);
    } finally {
      setSearching(false);
    }
  };

  /**
   * Request a session with an interpreter
   * 
   * Creates a new session document in Firestore with status "requested".
   * The interpreter will receive a notification and can accept/reject the request.
   * 
   * @param interpreterId - ID of the interpreter to book session with
   */
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
      // Reset form after successful booking
      setMatchingInterpreters([]);
      setDate("");
      setTime("");
    } catch (e) {
      console.error("Failed to create session", e);
      setMessage(t("session_booking_failed"));
      setOpen(true);
    } finally {
      setBooking(false);
    }
  };

  return (
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
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
              direction: direction,
              textAlign: "center",
            }}
          >
            {t("book_title")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#666",
              fontSize: { xs: "0.875rem", md: "1rem" },
              direction: direction,
              textAlign: "center",
              maxWidth: "600px",
            }}
          >
            {t("deaf_dashboard_desc")}
          </Typography>
        </Box>

        {/* Booking Form Card */}
        <Card
          sx={{
            mb: { xs: 3, md: 4 },
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            bgcolor: "white",
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
              {/* Mode Selection */}
    <Box>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: "#333",
                    direction: direction,
                  }}
                >
                  {t("booking_mode")}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                  }}
                >
                  <Card
                    onClick={() => setMode("immediate")}
                    sx={{
                      flex: 1,
                      cursor: "pointer",
                      border: mode === "immediate" ? "2px solid #008080" : "2px solid #e0e0e0",
                      bgcolor: mode === "immediate" ? "rgba(0,128,128,0.05)" : "white",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        borderColor: "#008080",
                        boxShadow: "0 4px 12px rgba(0,128,128,0.15)",
                      },
                    }}
                  >
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        p: { xs: 2, md: 3 },
                        textAlign: "center",
                      }}
                    >
                      <FlashOnIcon
                        sx={{
                          fontSize: { xs: "2rem", md: "2.5rem" },
                          color: mode === "immediate" ? "#008080" : "#666",
                        }}
                      />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: mode === "immediate" ? "#008080" : "#333",
                          direction: direction,
                        }}
                      >
                        {t("immediate")}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#666",
                          fontSize: { xs: "0.75rem", md: "0.875rem" },
                          direction: direction,
                        }}
                      >
                        {t("immediate_session_desc")}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card
                    onClick={() => setMode("scheduled")}
                    sx={{
                      flex: 1,
                      cursor: "pointer",
                      border: mode === "scheduled" ? "2px solid #008080" : "2px solid #e0e0e0",
                      bgcolor: mode === "scheduled" ? "rgba(0,128,128,0.05)" : "white",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        borderColor: "#008080",
                        boxShadow: "0 4px 12px rgba(0,128,128,0.15)",
                      },
                    }}
                  >
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        p: { xs: 2, md: 3 },
                        textAlign: "center",
                      }}
                    >
                      <ScheduleIcon
                        sx={{
                          fontSize: { xs: "2rem", md: "2.5rem" },
                          color: mode === "scheduled" ? "#008080" : "#666",
                        }}
                      />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: mode === "scheduled" ? "#008080" : "#333",
                          direction: direction,
                        }}
                      >
                        {t("scheduled")}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#666",
                          fontSize: { xs: "0.75rem", md: "0.875rem" },
                          direction: direction,
                        }}
                      >
                        {t("scheduled_session_desc")}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              {/* Date/Time Selection */}
        {mode === "scheduled" && (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 2,
                      fontWeight: 600,
                      color: "#333",
                      direction: direction,
                    }}
                  >
                    {t("select_date")} & {t("select_time")}
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" },
                    }}
                  >
            <TextField
              type="date"
              label={t("select_date")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              inputProps={{ min: new Date().toISOString().split("T")[0] }}
              fullWidth
                      InputLabelProps={{
                        sx: { direction: direction },
                      }}
                      InputProps={{
                        sx: { direction: direction },
                      }}
                      dir={direction}
            />
            <TextField
              type="time"
              label={t("select_time")}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              fullWidth
                      InputLabelProps={{
                        sx: { direction: direction },
                      }}
                      InputProps={{
                        sx: { direction: direction },
                      }}
                      dir={direction}
            />
          </Stack>
                </Box>
              )}

              {/* Find Interpreters Button */}
              <Button
                variant="contained"
                onClick={findMatching}
                disabled={searching || (mode === "scheduled" && (!date || !time))}
                startIcon={searching ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#008080",
                  px: { xs: 3, md: 4 },
                  py: { xs: 1.5, md: 2 },
                  fontSize: { xs: "0.875rem", md: "1rem" },
                  fontWeight: 500,
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: "#006666",
                  },
                  "&:disabled": {
                    bgcolor: "#cccccc",
                  },
                }}
              >
                {searching ? t("loading") : t("find_interpreters")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Available Interpreters Section */}
        {matchingInterpreters.length > 0 && (
          <Box>
            <Typography
              variant="h5"
              sx={{
                mb: 2,
                fontWeight: 600,
                color: "#333",
                direction: direction,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("available_interpreters")}
                      </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                },
                gap: { xs: 2, md: 3 },
              }}
            >
              {matchingInterpreters.map((interpreter) => (
                <Card
                  key={interpreter.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                      transform: "translateY(-4px)",
                    },
                    bgcolor: "white",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      p: { xs: 2, md: 3 },
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: "60px", md: "80px" },
                        height: { xs: "60px", md: "80px" },
                        borderRadius: "50%",
                        bgcolor: "rgba(0,128,128,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 2,
                      }}
                    >
                      <PersonIcon
                        sx={{
                          fontSize: { xs: "2rem", md: "2.5rem" },
                          color: "#008080",
                        }}
                      />
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#333",
                        mb: 1,
                        direction: direction,
                      }}
                    >
                      {interpreter.full_name || interpreter.id}
                    </Typography>
                    {(interpreter.average_rating || 0) > 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          mb: 2,
                        }}
                      >
                        <StarIcon sx={{ fontSize: 20, color: "#ffc107" }} />
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            direction: direction,
                          }}
                        >
                          {interpreter.average_rating?.toFixed(1) || 0}/5
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#666",
                          mb: 2,
                          direction: direction,
                        }}
                      >
                        {t("no_ratings_yet")}
                    </Typography>
                  )}
                <Button 
                  variant="contained" 
                      onClick={() => requestSession(interpreter.id)}
                  disabled={booking}
                      fullWidth
                      sx={{
                        borderRadius: "8px",
                        bgcolor: "#008080",
                        px: 3,
                        py: 1.5,
                        fontSize: { xs: "0.875rem", md: "1rem" },
                        fontWeight: 500,
                        textTransform: "none",
                        mt: "auto",
                        "&:hover": {
                          bgcolor: "#006666",
                        },
                        "&:disabled": {
                          bgcolor: "#cccccc",
                        },
                      }}
                    >
                      {booking ? (
                        <>
                          <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
                          {t("signing_in")}
                        </>
                      ) : (
                        t("reserve")
                      )}
                </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Empty State - Show when search has been performed but no results */}
        {!searching && hasSearched && matchingInterpreters.length === 0 && (
          <Card
            sx={{
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              bgcolor: "white",
              textAlign: "center",
              p: { xs: 3, md: 4 },
            }}
          >
            <Typography
              variant="body1"
              sx={{
                color: "#666",
                direction: direction,
              }}
            >
              {t("no_available_interpreters")}
            </Typography>
          </Card>
        )}
      </Container>
      
      <Snackbar 
        open={open} 
        autoHideDuration={5000} 
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert 
          severity={message.includes("successfully") ? "success" : "error"} 
          onClose={() => setOpen(false)}
          sx={{ direction: direction }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default BookSession;