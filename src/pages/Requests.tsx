/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Container, Typography, Button, Card, CardContent, CardActions, Chip, Stack, Snackbar, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, deleteDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { startCall } from "../services/callService";
import { createSessionConfirmedNotification, createSessionCancelledNotification } from "../services/notificationService";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  user_id: string;
}

function Requests() {
  const { t, direction } = useI18n();
  const isRTL = direction === "rtl";
  const { user } = useAuth();
  const [items, setItems] = useState<SItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

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

  // Load user names
  useEffect(() => {
    const loadNames = async () => {
      const uniqueUserIds = [...new Set(items.map((item) => item.user_id))];
      const names: Record<string, string> = {};
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              names[userId] = userData.full_name || userData.name || userId;
            }
          } catch (error) {
            console.error("Failed to load user name:", error);
            names[userId] = userId;
          }
        })
      );
      setUserNames(names);
    };
    if (items.length) void loadNames();
  }, [items]);

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setSavingId(id);
    try {
      const sessionDoc = await doc(db, "sessions", id);
      const sessionSnap = await getDoc(sessionDoc);
      const sessionData = sessionSnap.data();
      
      if (!sessionData) {
        throw new Error('Session not found');
      }

      await updateDoc(sessionDoc, { status });
      
      if (status === "confirmed") {
        try {
          await startCall(id, sessionData.user_id, user!.uid);
          await createSessionConfirmedNotification(
            sessionData.user_id, 
            id, 
            new Date(sessionData.scheduled_time)
          );
        } catch (error) {
          console.error('Failed to create call record or notification:', error);
        }
      } else if (status === "cancelled") {
        try {
          await createSessionCancelledNotification(
            sessionData.user_id, 
            id, 
            t("session_cancelled_by_interpreter")
          );
        } catch (error) {
          console.error('Failed to create cancellation notification:', error);
        }
      }
      
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

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, "sessions", deleteId));
      setMessage(t("delete") + " " + t("success"));
      setOpen(true);
      setDeleteDialogOpen(false);
      setDeleteId(null);
    } catch (error) {
      console.error("Failed to delete request:", error);
      setMessage(t("error") + ": " + t("request_action_failed"));
      setOpen(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "requested":
        return "warning";
      case "confirmed":
        return "success";
      case "cancelled":
        return "default";
      case "completed":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusChipSx = (status: string) => {
    if (status === "confirmed") {
      return {
        minWidth: 100,
        bgcolor: "#008080",
        color: "white",
        "&:hover": {
          bgcolor: "#006666",
        },
      };
    }
    return { minWidth: 100 };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const requestedItems = items.filter((item) => item.status === "requested");
  const otherItems = items.filter((item) => item.status === "confirmed" || item.status === "cancelled");

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
            }}
          >
            {t("requests_title")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#666",
              fontSize: { xs: "0.875rem", md: "1rem" },
              direction: direction,
            }}
          >
            {t("interpreter_dashboard_desc")}
          </Typography>
        </Box>

        {/* No Requests Message */}
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
          <Box sx={{ mb: 4 }}>
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
              {t("requests_title")}
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
                            {userNames[s.user_id] || s.user_id}
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
                        label={t(`status_${s.status}`)}
                        color={s.status === "confirmed" ? undefined : (getStatusColor(s.status) as any)}
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
                      gap: 1,
                    }}
                  >
                    <Button
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => updateStatus(s.id, "confirmed")}
                      disabled={savingId === s.id}
                      sx={{
                        borderRadius: "8px",
                        bgcolor: "#008080",
                        textTransform: "none",
                        "&:hover": { bgcolor: "#006666" },
                      }}
                    >
                      {savingId === s.id ? t("loading") : t("accept")}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => updateStatus(s.id, "cancelled")}
                      disabled={savingId === s.id}
                      sx={{
                        borderRadius: "8px",
                        textTransform: "none",
                      }}
                    >
                      {savingId === s.id ? t("loading") : t("reject")}
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Other Sessions (Confirmed, Cancelled, Completed) */}
        {otherItems.length > 0 && (
          <Box>
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
              {t("my_sessions")}
            </Typography>
            <Stack spacing={2}>
              {otherItems.map((s) => (
                <Card
                  key={s.id}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                    },
                    bgcolor: "white",
                    opacity: s.status === "cancelled" ? 0.7 : 1,
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
                            {userNames[s.user_id] || s.user_id}
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
                        label={t(`status_${s.status}`)}
                        color={s.status === "confirmed" ? undefined : (getStatusColor(s.status) as any)}
                        size="small"
                        sx={getStatusChipSx(s.status)}
                      />
                      {(s.status === "confirmed" || s.status === "cancelled") && (
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteClick(s.id)}
                          size="small"
                          sx={{
                            "&:hover": { bgcolor: "rgba(211, 47, 47, 0.1)" },
                          }}
                        >
                          <CloseIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          dir={direction}
        >
          <DialogTitle sx={{ direction: direction }}>
            {t("confirm")} {t("delete")}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ direction: direction }}>
              {t("confirm")} {t("delete")} {t("this")} {t("session")}?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: "none" }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              sx={{ textTransform: "none" }}
            >
              {t("delete")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for feedback */}
        <Snackbar 
          open={open} 
          autoHideDuration={4000} 
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert 
            severity={message.includes("successfully") || message.includes(t("request_accepted")) || message.includes(t("success")) ? "success" : "error"} 
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

export default Requests;
