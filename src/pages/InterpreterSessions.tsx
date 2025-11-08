/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Box, Container, Button, Chip, Stack, Typography, Card, CardContent, CardActions, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { collection, doc, getDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isSessionExpired } from "../utils/sessionUtils";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import VideocamIcon from "@mui/icons-material/Videocam";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface SItem {
  id: string;
  scheduled_time: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
  user_id: string;
}

function InterpreterSessions() {
  const { user } = useAuth();
  const { t, direction } = useI18n();
  const isRTL = direction === "rtl";
  const [items, setItems] = useState<SItem[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearExpiredDialogOpen, setClearExpiredDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearingExpired, setClearingExpired] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("interpreter_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((s) => (s.status === "confirmed" || s.status === "completed") && !s.hidden)
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
          try {
          const snap = await getDoc(doc(db, "users", id));
            if (snap.exists()) {
              const userData = snap.data();
              entries[id] = userData.full_name || userData.name || id;
            }
          } catch (error) {
            console.error("Failed to load user name:", error);
            entries[id] = id;
          }
        })
      );
      setNameMap((prev) => ({ ...prev, ...entries }));
    };
    if (items.length) void loadNames();
  }, [items, nameMap]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    if (status === "confirmed") return "success";
    if (status === "completed") return "info";
    if (status === "cancelled") return "error";
    return "default";
  };

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

  const confirmedItems = items.filter((s) => s.status === "confirmed");
  const completedItems = items.filter((s) => s.status === "completed");
  
  // Separate confirmed items into active and expired
  const activeConfirmedItems = confirmedItems.filter((s) => !isSessionExpired(s.scheduled_time));
  const expiredConfirmedItems = confirmedItems.filter((s) => isSessionExpired(s.scheduled_time));

  const handleClearAll = async () => {
    if (completedItems.length === 0) return;
    setClearing(true);
    try {
      // Mark sessions as hidden instead of deleting them
      // This preserves the records and associated ratings in the database
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

  const handleClearExpired = async () => {
    if (expiredConfirmedItems.length === 0) return;
    setClearingExpired(true);
    try {
      // Mark expired sessions as hidden instead of deleting them
      // This preserves the records and associated ratings in the database
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
            {t("interpreter_sessions")}
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
            {t("service_professional_dashboard")}
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
                            {nameMap[s.user_id] || s.user_id}
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
                            {nameMap[s.user_id] || s.user_id}
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
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                    },
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
                            {nameMap[s.user_id] || s.user_id}
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

        {/* Clear All Completed Sessions Confirmation Dialog */}
        <Dialog
          open={clearAllDialogOpen}
          onClose={() => !clearing && setClearAllDialogOpen(false)}
          dir={direction}
        >
          <DialogTitle sx={{ direction: direction }}>
            {t("clear_all")} {t("status_completed")} {t("sessions")}?
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ direction: direction }}>
              {t("this")} {t("action")} {t("cannot")} {t("be")} {t("undone")}. {t("are_you_sure")}?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Button
              onClick={() => setClearAllDialogOpen(false)}
              disabled={clearing}
              sx={{ textTransform: "none" }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleClearAll}
              color="error"
              variant="contained"
              disabled={clearing}
              sx={{ textTransform: "none" }}
            >
              {clearing ? t("loading") : t("clear_all")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clear All Expired Sessions Confirmation Dialog */}
        <Dialog
          open={clearExpiredDialogOpen}
          onClose={() => !clearingExpired && setClearExpiredDialogOpen(false)}
          dir={direction}
        >
          <DialogTitle sx={{ direction: direction }}>
            {t("clear_all")} {t("expired")} {t("sessions")}?
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ direction: direction }}>
              {t("this")} {t("action")} {t("cannot")} {t("be")} {t("undone")}. {t("are_you_sure")}?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Button
              onClick={() => setClearExpiredDialogOpen(false)}
              disabled={clearingExpired}
              sx={{ textTransform: "none" }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleClearExpired}
              color="error"
              variant="contained"
              disabled={clearingExpired}
              sx={{ textTransform: "none" }}
            >
              {clearingExpired ? t("loading") : t("clear_all")}
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
            severity={message.includes("success") || message.includes(t("success")) ? "success" : "error"}
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

export default InterpreterSessions;