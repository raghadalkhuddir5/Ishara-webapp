/**
 * My Sessions Page Component
 * 
 * This page displays all sessions for a deaf/mute user, organized by status.
 * Users can view requested, confirmed, completed, expired, and cancelled sessions.
 * They can join calls for active sessions, cancel requested sessions, rate completed
 * sessions, and clear old sessions.
 * 
 * Features:
 * - Real-time list of all user sessions
 * - Session status filtering (requested, confirmed, completed, expired, cancelled)
 * - Join call button for active confirmed sessions
 * - Cancel button for requested sessions
 * - Rate completed sessions (with rating modal)
 * - Display existing ratings
 * - Clear all completed/expired sessions (marks as hidden)
 * - Session expiration checking
 * - RTL support for Arabic
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Box, Container, Button, Chip, Stack, Typography, Card, CardContent, CardActions, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, CircularProgress } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { collection, doc, getDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isSessionExpired } from "../utils/sessionUtils";
import RatingModal from "../components/RatingModal";
import { canRateSession, getRatingForSession } from "../services/ratingService";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import VideocamIcon from "@mui/icons-material/Videocam";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StarIcon from "@mui/icons-material/Star";
import CancelIcon from "@mui/icons-material/Cancel";

/**
 * SItem Interface
 * 
 * Represents a session item in the user's session list.
 */
interface SItem {
  id: string; // Session document ID
  scheduled_time: string; // ISO string of scheduled time
  status: "requested" | "confirmed" | "cancelled" | "completed"; // Current session status
  user_id: string; // ID of the deaf/mute user (should match current user)
  interpreter_id: string; // ID of the interpreter
  is_rated?: boolean; // Whether this session has been rated
  rating_id?: string; // ID of the rating document if rated
  hidden?: boolean; // Whether session is hidden (soft deleted)
}

/**
 * MySessions Component
 * 
 * Main component for displaying user's sessions.
 */
function MySessions() {
  // Get authenticated user (deaf/mute)
  const { user } = useAuth();
  
  // Get internationalization context
  const { t, direction } = useI18n();
  const isRTL = direction === "rtl";
  
  // Component state
  const [items, setItems] = useState<SItem[]>([]); // List of all sessions for this user
  const [nameMap, setNameMap] = useState<Record<string, string>>({}); // Map of interpreter IDs to display names
  const [cancellingId, setCancellingId] = useState<string | null>(null); // ID of session being cancelled (for loading state)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false); // Controls clear all completed dialog
  const [clearExpiredDialogOpen, setClearExpiredDialogOpen] = useState(false); // Controls clear expired dialog
  const [clearing, setClearing] = useState(false); // Loading state when clearing completed sessions
  const [clearingExpired, setClearingExpired] = useState(false); // Loading state when clearing expired sessions
  const [message, setMessage] = useState<string>(""); // Success/error message
  const [open, setOpen] = useState(false); // Controls snackbar visibility
  const [showRatingModal, setShowRatingModal] = useState(false); // Controls rating modal visibility
  const [selectedSession, setSelectedSession] = useState<SItem | null>(null); // Session selected for rating
  const [ratingsMap, setRatingsMap] = useState<Record<string, any>>({}); // Map of session IDs to their ratings

  /**
   * useEffect: Load sessions for this user
   * 
   * Sets up a real-time listener for all sessions where the current user is the user_id.
   * Filters out hidden sessions and sorts by scheduled time (newest first).
   */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("user_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((s) => !s.hidden)
          .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
        setItems(list);
      },
      (err) => {
        console.error("MySessions listener error", err);
      }
    );
    return () => unsub();
  }, [user]);

  /**
   * useEffect: Load interpreter names for display
   * 
   * Fetches display names for all unique interpreters in the sessions list.
   * Only loads names that aren't already in the nameMap to avoid redundant requests.
   */
  useEffect(() => {
    const loadNames = async () => {
      const missing = Array.from(new Set(items.map((s) => s.interpreter_id))).filter((id) => !nameMap[id]);
      if (missing.length === 0) return;
      const entries: Record<string, string> = {};
      await Promise.all(
        missing.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "users", id));
            if (snap.exists()) {
              const userData = snap.data();
              entries[id] = userData.full_name || userData.name || id;
            }
          } catch (error) {
            console.error("Failed to load interpreter name:", error);
            entries[id] = id;
          }
        })
      );
      setNameMap((prev) => ({ ...prev, ...entries }));
    };
    if (items.length) void loadNames();
  }, [items, nameMap]);

  /**
   * useEffect: Load ratings for completed sessions
   * 
   * Fetches existing ratings for completed sessions that have been rated.
   * Used to display ratings that the user has already submitted.
   */
  useEffect(() => {
    const loadRatings = async () => {
      const completedSessions = items.filter(s => s.status === 'completed' && s.is_rated);
      if (completedSessions.length === 0) return;
      
      const ratings: Record<string, any> = {};
      await Promise.all(
        completedSessions.map(async (session) => {
          try {
            if (session.user_id === user?.uid) {
              const rating = await getRatingForSession(session.id);
              if (rating) {
                ratings[session.id] = rating;
              }
            }
          } catch (error) {
            console.error('Failed to load rating for session:', session.id, error);
          }
        })
      );
      setRatingsMap(ratings);
    };
    if (items.length && user) void loadRatings();
  }, [items, user]);

  /**
   * Format date string for display
   * 
   * Converts ISO date string to a human-readable format.
   * 
   * @param dateString - ISO date string
   * @returns Formatted date string (e.g., "January 15, 2024, 10:30 AM")
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * Get Material-UI color for status chip
   * 
   * @param status - Session status string
   * @returns Material-UI color name
   */
  const getStatusColor = (status: string) => {
    if (status === "confirmed") return "success";
    if (status === "completed") return "info";
    if (status === "cancelled") return "error";
    if (status === "requested") return "warning";
    return "default";
  };

  /**
   * Get custom styles for status chip
   * 
   * Returns custom styling for confirmed status chips (teal background).
   * 
   * @param status - Session status string
   * @returns Style object for MUI Chip component
   */
  const getStatusChipSx = (status: string) => {
    if (status === "confirmed") {
      return {
        bgcolor: "#008080",
        color: "white",
        fontWeight: 600,
      };
    }
    return {};
  };

  /**
   * Render star rating display
   * 
   * Displays filled/unfilled stars based on rating value.
   * 
   * @param stars - Number of stars (1-5)
   * @returns JSX element displaying stars
   */
  const renderStars = (stars: number) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            sx={{
              fontSize: 16,
              color: star <= stars ? '#ffc107' : '#ddd'
            }}
          />
        ))}
        <Typography variant="body2" sx={{ ml: 0.5, direction: direction }}>
          {stars}/5
        </Typography>
      </Box>
    );
  };

  /**
   * Cancel a requested session
   * 
   * Updates session status to "cancelled" in Firestore.
   * Only works for sessions with "requested" status.
   * 
   * @param id - Session document ID
   * @param currentStatus - Current session status (must be "requested")
   */
  const cancelSession = async (id: string, currentStatus: string) => {
    if (currentStatus !== "requested") return;
    setCancellingId(id);
    try {
      await updateDoc(doc(db, "sessions", id), { status: "cancelled" });
      setMessage(t("session_cancelled_success"));
      setOpen(true);
    } catch (e) {
      console.error("Cancel failed", e);
      setMessage(t("session_cancel_fail"));
      setOpen(true);
    } finally {
      setCancellingId(null);
    }
  };

  /**
   * Handle rate session button click
   * 
   * Validates that the session can be rated and opens the rating modal.
   * Checks eligibility using the rating service before showing modal.
   * 
   * @param session - Session item to rate
   */
  const handleRateSession = async (session: SItem) => {
    if (!user) return;
    
    try {
      const canRate = await canRateSession(session.id, user.uid);
      if (canRate) {
        setSelectedSession(session);
        setShowRatingModal(true);
      } else {
        setMessage(t("cannot_rate_session"));
        setOpen(true);
      }
    } catch (error) {
      console.error('Failed to check if session can be rated:', error);
      setMessage(t("rating_check_failed"));
      setOpen(true);
    }
  };

  /**
   * Handle rating modal close
   * 
   * Closes the rating modal and clears selected session.
   */
  const handleRatingModalClose = () => {
    setShowRatingModal(false);
    setSelectedSession(null);
  };

  /**
   * Handle successful rating submission
   * 
   * Called when rating is successfully submitted.
   * Closes modal and shows success message.
   */
  const handleRatingSubmitSuccess = () => {
    setShowRatingModal(false);
    setSelectedSession(null);
    setMessage(t("rating_submitted_success"));
    setOpen(true);
  };

  /**
   * Handle clear all completed sessions
   * 
   * Marks all completed sessions as hidden (soft delete).
   * This preserves records in the database while hiding them from the UI.
   */
  const handleClearAll = async () => {
    if (completedItems.length === 0) return;
    setClearing(true);
    try {
      await Promise.all(
        completedItems.map((item) =>
          updateDoc(doc(db, "sessions", item.id), { hidden: true })
        )
      );
      setMessage(t("clear_all") + " " + t("success"));
      setOpen(true);
      setClearAllDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear completed sessions:", error);
      setMessage(t("error") + ": " + t("request_action_failed"));
      setOpen(true);
    } finally {
      setClearing(false);
    }
  };

  /**
   * Handle clear all expired sessions
   * 
   * Marks all expired confirmed sessions as hidden (soft delete).
   * This preserves records in the database while hiding them from the UI.
   */
  const handleClearExpired = async () => {
    if (expiredConfirmedItems.length === 0) return;
    setClearingExpired(true);
    try {
      await Promise.all(
        expiredConfirmedItems.map((item) =>
          updateDoc(doc(db, "sessions", item.id), { hidden: true })
        )
      );
      setMessage(t("clear_all") + " " + t("success"));
      setOpen(true);
      setClearExpiredDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear expired sessions:", error);
      setMessage(t("error") + ": " + t("request_action_failed"));
      setOpen(true);
    } finally {
      setClearingExpired(false);
    }
  };

  // Group sessions by status
  const requestedItems = items.filter((s) => s.status === "requested");
  const confirmedItems = items.filter((s) => s.status === "confirmed");
  const completedItems = items.filter((s) => s.status === "completed");
  const cancelledItems = items.filter((s) => s.status === "cancelled");
  
  // Separate confirmed items into active and expired
  const activeConfirmedItems = confirmedItems.filter((s) => !isSessionExpired(s.scheduled_time));
  const expiredConfirmedItems = confirmedItems.filter((s) => isSessionExpired(s.scheduled_time));

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
            {t("my_sessions")}
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
            {t("service_scheduled_sessions")}
          </Typography>
        </Box>

        {/* No Sessions Message */}
        {items.length === 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 8,
              textAlign: "center",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "#999",
                fontSize: { xs: "1rem", md: "1.25rem" },
                direction: direction,
              }}
            >
              {t("no_requests_yet")}
            </Typography>
          </Box>
        )}

        {/* Requested Sessions */}
        {requestedItems.length > 0 && (
          <Box sx={{ mb: { xs: 4, md: 5 } }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "#333",
                mb: 2,
                fontSize: { xs: "1.1rem", md: "1.25rem" },
                direction: direction,
              }}
            >
              {t("status_requested")}
            </Typography>
            <Stack spacing={2}>
              {requestedItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                    },
                    bgcolor: "white",
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      sx={{ flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "#333",
                              fontSize: { xs: "0.95rem", md: "1rem" },
                              direction: direction,
                            }}
                          >
                            {nameMap[s.interpreter_id] || s.interpreter_id}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <AccessTimeIcon sx={{ color: "#666", fontSize: "1rem" }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#666",
                              fontSize: { xs: "0.875rem", md: "0.95rem" },
                              direction: direction,
                            }}
                          >
                            {formatDate(s.scheduled_time)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={t("status_requested")}
                        color={getStatusColor(s.status) as any}
                        size="small"
                      />
                    </Stack>
                  </CardContent>
                  <CardActions
                    sx={{
                      p: { xs: 2, md: 3 },
                      pt: 0,
                      justifyContent: isRTL ? "flex-start" : "flex-end",
                    }}
                  >
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => cancelSession(s.id, s.status)}
                      disabled={cancellingId === s.id}
                      startIcon={cancellingId === s.id ? <CircularProgress size={16} /> : <CancelIcon />}
                      sx={{
                        borderRadius: "8px",
                        textTransform: "none",
                        px: { xs: 3, md: 4 },
                        py: { xs: 1, md: 1.25 },
                        fontSize: { xs: "0.9rem", md: "1rem" },
                      }}
                    >
                      {cancellingId === s.id ? t("signing_in") : t("cancel")}
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Active Confirmed Sessions */}
        {activeConfirmedItems.length > 0 && (
          <Box sx={{ mb: { xs: 4, md: 5 } }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "#333",
                mb: 2,
                fontSize: { xs: "1.1rem", md: "1.25rem" },
                direction: direction,
              }}
            >
              {t("status_confirmed")}
            </Typography>
            <Stack spacing={2}>
              {activeConfirmedItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                    },
                    bgcolor: "white",
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      sx={{ flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "#333",
                              fontSize: { xs: "0.95rem", md: "1rem" },
                              direction: direction,
                            }}
                          >
                            {nameMap[s.interpreter_id] || s.interpreter_id}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <AccessTimeIcon sx={{ color: "#666", fontSize: "1rem" }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#666",
                              fontSize: { xs: "0.875rem", md: "0.95rem" },
                              direction: direction,
                            }}
                          >
                            {formatDate(s.scheduled_time)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={t("status_confirmed")}
                        color={undefined}
                        size="small"
                        sx={getStatusChipSx(s.status)}
                      />
                    </Stack>
                  </CardContent>
                  <CardActions
                    sx={{
                      p: { xs: 2, md: 3 },
                      pt: 0,
                      justifyContent: isRTL ? "flex-start" : "flex-end",
                    }}
                  >
                    <Button
                      component={Link}
                      to={`/call/${s.id}`}
                      variant="contained"
                      startIcon={<VideocamIcon />}
                      sx={{
                        borderRadius: "8px",
                        bgcolor: "#008080",
                        textTransform: "none",
                        px: { xs: 3, md: 4 },
                        py: { xs: 1, md: 1.25 },
                        fontSize: { xs: "0.9rem", md: "1rem" },
                        "&:hover": { bgcolor: "#006666" },
                      }}
                    >
                      {t("join_call")}
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Completed Sessions */}
        {completedItems.length > 0 && (
          <Box sx={{ mt: { xs: 4, md: 5 }, mb: { xs: 4, md: 5 } }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
                flexDirection: isRTL ? "row-reverse" : "row",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: "#333",
                  fontSize: { xs: "1.1rem", md: "1.25rem" },
                  direction: direction,
                }}
              >
                {t("status_completed")}
              </Typography>
              <Button
                variant="text"
                color="error"
                onClick={() => setClearAllDialogOpen(true)}
                sx={{
                  textTransform: "none",
                  px: { xs: 2, md: 3 },
                  py: { xs: 0.75, md: 1 },
                  fontSize: { xs: "0.875rem", md: "0.95rem" },
                }}
              >
                {t("clear_all")}
              </Button>
            </Box>
            <Stack spacing={2}>
              {completedItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                    },
                    bgcolor: "white",
                    opacity: 0.8,
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      sx={{ flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "#333",
                              fontSize: { xs: "0.95rem", md: "1rem" },
                              direction: direction,
                            }}
                          >
                            {nameMap[s.interpreter_id] || s.interpreter_id}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <AccessTimeIcon sx={{ color: "#666", fontSize: "1rem" }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#666",
                              fontSize: { xs: "0.875rem", md: "0.95rem" },
                              direction: direction,
                            }}
                          >
                            {formatDate(s.scheduled_time)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={t("status_completed")}
                        color={getStatusColor(s.status) as any}
                        size="small"
                        icon={<CheckCircleIcon />}
                      />
                    </Stack>
                  </CardContent>
                  <CardActions
                    sx={{
                      p: { xs: 2, md: 3 },
                      pt: 0,
                      justifyContent: isRTL ? "flex-start" : "flex-end",
                    }}
                  >
                    {s.is_rated ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={t("rated")}
                          color="success"
                          variant="outlined"
                          size="small"
                          icon={<StarIcon sx={{ fontSize: 16 }} />}
                        />
                        {ratingsMap[s.id] && renderStars(ratingsMap[s.id].stars)}
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleRateSession(s)}
                        startIcon={<StarIcon />}
                        sx={{
                          borderRadius: "8px",
                          textTransform: "none",
                          px: { xs: 3, md: 4 },
                          py: { xs: 1, md: 1.25 },
                          fontSize: { xs: "0.9rem", md: "1rem" },
                        }}
                      >
                        {t("rate_this_session")}
                      </Button>
                    )}
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Expired Sessions */}
        {expiredConfirmedItems.length > 0 && (
          <Box sx={{ mt: { xs: 4, md: 5 } }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
                flexDirection: isRTL ? "row-reverse" : "row",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: "#333",
                  fontSize: { xs: "1.1rem", md: "1.25rem" },
                  direction: direction,
                }}
              >
                {t("expired")}
              </Typography>
              <Button
                variant="text"
                color="error"
                onClick={() => setClearExpiredDialogOpen(true)}
                sx={{
                  textTransform: "none",
                  px: { xs: 2, md: 3 },
                  py: { xs: 0.75, md: 1 },
                  fontSize: { xs: "0.875rem", md: "0.95rem" },
                }}
              >
                {t("clear_all")}
              </Button>
            </Box>
            <Stack spacing={2}>
              {expiredConfirmedItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    bgcolor: "white",
                    opacity: 0.7,
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      sx={{ flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "#333",
                              fontSize: { xs: "0.95rem", md: "1rem" },
                              direction: direction,
                            }}
                          >
                            {nameMap[s.interpreter_id] || s.interpreter_id}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <AccessTimeIcon sx={{ color: "#666", fontSize: "1rem" }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#666",
                              fontSize: { xs: "0.875rem", md: "0.95rem" },
                              direction: direction,
                            }}
                          >
                            {formatDate(s.scheduled_time)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={t("expired")}
                        color="error"
                        variant="outlined"
                        size="small"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Cancelled Sessions */}
        {cancelledItems.length > 0 && (
          <Box sx={{ mt: { xs: 4, md: 5 } }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "#333",
                mb: 2,
                fontSize: { xs: "1.1rem", md: "1.25rem" },
                direction: direction,
              }}
            >
              {t("status_cancelled")}
            </Typography>
            <Stack spacing={2}>
              {cancelledItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    bgcolor: "white",
                    opacity: 0.7,
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      sx={{ flexDirection: isRTL ? { xs: "column", sm: "row-reverse" } : { xs: "column", sm: "row" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "#333",
                              fontSize: { xs: "0.95rem", md: "1rem" },
                              direction: direction,
                            }}
                          >
                            {nameMap[s.interpreter_id] || s.interpreter_id}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <AccessTimeIcon sx={{ color: "#666", fontSize: "1rem" }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#666",
                              fontSize: { xs: "0.875rem", md: "0.95rem" },
                              direction: direction,
                            }}
                          >
                            {formatDate(s.scheduled_time)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={t("status_cancelled")}
                        color={getStatusColor(s.status) as any}
                        size="small"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Clear All Dialog for Completed */}
        <Dialog
          open={clearAllDialogOpen}
          onClose={() => setClearAllDialogOpen(false)}
          dir={direction}
        >
          <DialogTitle sx={{ direction: direction }}>{t("clear_all")}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ direction: direction }}>
              {t("are_you_sure")} {t("clear_all")} {t("sessions")}? {t("this")} {t("action")} {t("cannot")} {t("be")} {t("undone")}.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Button onClick={() => setClearAllDialogOpen(false)} sx={{ textTransform: "none" }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleClearAll}
              color="error"
              variant="contained"
              disabled={clearing}
              sx={{ textTransform: "none" }}
            >
              {clearing ? <CircularProgress size={20} /> : t("clear_all")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clear All Dialog for Expired */}
        <Dialog
          open={clearExpiredDialogOpen}
          onClose={() => setClearExpiredDialogOpen(false)}
          dir={direction}
        >
          <DialogTitle sx={{ direction: direction }}>{t("clear_all")}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ direction: direction }}>
              {t("are_you_sure")} {t("clear_all")} {t("expired")} {t("sessions")}? {t("this")} {t("action")} {t("cannot")} {t("be")} {t("undone")}.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Button onClick={() => setClearExpiredDialogOpen(false)} sx={{ textTransform: "none" }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleClearExpired}
              color="error"
              variant="contained"
              disabled={clearingExpired}
              sx={{ textTransform: "none" }}
            >
              {clearingExpired ? <CircularProgress size={20} /> : t("clear_all")}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={message.includes("successfully") || message.includes(t("success")) ? "success" : "error"}
          onClose={() => setOpen(false)}
          sx={{ direction: direction }}
        >
          {message}
        </Alert>
      </Snackbar>

      {showRatingModal && selectedSession && (
        <RatingModal
          isOpen={showRatingModal}
          sessionId={selectedSession.id}
          interpreterId={selectedSession.interpreter_id}
          interpreterName={nameMap[selectedSession.interpreter_id] || selectedSession.interpreter_id}
          onClose={handleRatingModalClose}
          onSubmitSuccess={handleRatingSubmitSuccess}
        />
      )}
    </Box>
  );
}

export default MySessions;
