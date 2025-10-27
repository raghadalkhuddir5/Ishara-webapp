import { AppBar, Toolbar, Typography, Button, Box, IconButton, Popover, Badge } from "@mui/material";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { useI18n } from "../context/I18nContext";
import { Notifications as NotificationsIcon } from "@mui/icons-material";
import NotificationCenter from "./NotificationCenter";
import { getUnreadNotificationCount } from "../services/notificationService";
import LanguageSwitcher from "./LanguageSwitcher";

function AppLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [role, setRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setRole((snap.data() as { role?: string }).role ?? null);
    };
    load();
  }, [user]);

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!user) return;
      try {
        const count = await getUnreadNotificationCount(user.uid);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading unread notification count:', error);
      }
    };
    
    loadUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  return (
    <Box>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t("app_title")}
          </Typography>
          {role === "deaf_mute" && (
            <>
              <Button component={Link} to="/dashboard/deaf-mute">{t("dashboard")}</Button>
              <Button component={Link} to="/book">{t("book_session")}</Button>
              <Button component={Link} to="/sessions">{t("my_sessions")}</Button>
            </>
          )}
          {role === "interpreter" && (
            <>
              <Button component={Link} to="/dashboard/interpreter">{t("dashboard")}</Button>
              <Button component={Link} to="/requests">{t("requests")}</Button>
              <Button component={Link} to="/availability">{t("availability")}</Button>
              <Button component={Link} to="/interpreter/sessions">{t("my_sessions")}</Button>
            </>
          )}
          <Button component={Link} to="/profile">{t("profile")}</Button>
          
          {/* Notification Center */}
          <IconButton
            color="inherit"
            onClick={handleNotificationClick}
            sx={{ ml: 1 }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          
          <Popover
            open={Boolean(notificationAnchor)}
            anchorEl={notificationAnchor}
            onClose={handleNotificationClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <NotificationCenter maxNotifications={10} />
          </Popover>
          
          {/* Language Switcher */}
          <Box sx={{ mx: 1 }}>
            <LanguageSwitcher />
          </Box>
          
          <Button onClick={handleLogout} color="error">{t("logout")}</Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default AppLayout;