/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Box, Stack, Typography, Chip, Button, Snackbar, Alert } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { isSessionExpired } from "../utils/sessionUtils";
import RatingModal from "../components/RatingModal";
import { canRateSession, getRatingForSession } from "../services/ratingService";
import { Star } from "@mui/icons-material";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  user_id: string;
  interpreter_id: string;
  is_rated?: boolean;
  rating_id?: string;
}

function MySessions() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<SItem[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SItem | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, any>>({});

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

  // Fetch ratings for completed sessions
  useEffect(() => {
    const loadRatings = async () => {
      const completedSessions = items.filter(s => s.status === 'completed' && s.is_rated);
      if (completedSessions.length === 0) return;
      
      const ratings: Record<string, any> = {};
      await Promise.all(
        completedSessions.map(async (session) => {
          try {
            // Only load ratings for sessions where current user is the deaf/mute user
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

  const statusLabel = (s: SItem["status"]) => {
    if (s === "requested") return t("status_requested");
    if (s === "confirmed") return t("status_confirmed");
    if (s === "cancelled") return t("status_cancelled");
    if (s === "completed") return t("status_completed");
    return s;
  };

  const cancelSession = async (id: string, currentStatus: string) => {
    if (currentStatus !== "requested") return;
    setCancellingId(id);
    try {
      await updateDoc(doc(db, "sessions", id), { status: "cancelled" });
      setMessage(t("session_cancelled_success"));
      setOpen(true);
    } catch (e) {
      console.error("Cancel failed", e);
      setMessage(t("session_cancel_failed"));
      setOpen(true);
    } finally {
      setCancellingId(null);
    }
  };

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

  const handleRatingModalClose = () => {
    setShowRatingModal(false);
    setSelectedSession(null);
  };

  const handleRatingSubmitSuccess = () => {
    setShowRatingModal(false);
    setSelectedSession(null);
    setMessage(t("rating_submitted_success"));
    setOpen(true);
  };

  const renderStars = (stars: number) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            sx={{
              fontSize: 16,
              color: star <= stars ? '#ffc107' : '#ddd'
            }}
          />
        ))}
        <Typography variant="body2" sx={{ ml: 0.5 }}>
          {stars}/5
        </Typography>
      </Box>
    );
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
            <Stack direction="row" spacing={1} alignItems="center">
              {s.status === "requested" && (
                <Button 
                  color="error" 
                  onClick={() => cancelSession(s.id, s.status)}
                  disabled={cancellingId === s.id}
                >
                  {cancellingId === s.id ? t("signing_in") : t("cancel")}
                </Button>
              )}
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
              {s.status === "completed" && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {s.is_rated ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={t("rated")} 
                        color="success" 
                        variant="outlined"
                        size="small"
                        icon={<Star sx={{ fontSize: 16 }} />}
                      />
                      {ratingsMap[s.id] && renderStars(ratingsMap[s.id].stars)}
                    </Box>
                  ) : (
                    <Button 
                      variant="outlined"
                      color="primary"
                      onClick={() => handleRateSession(s)}
                      size="small"
                    >
                      {t("rate_this_session")}
                    </Button>
                  )}
                </Box>
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
          severity={message.includes("successfully") || message.includes(t("success")) ? "success" : "error"} 
          onClose={() => setOpen(false)}
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