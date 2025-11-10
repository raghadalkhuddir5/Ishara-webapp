import { AppBar, Toolbar, Typography, Button, Box, IconButton, Popover, Badge, Container, Drawer, List, ListItem, ListItemButton } from "@mui/material";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { useI18n } from "../context/I18nContext";
import { Notifications as NotificationsIcon, Language as LanguageIcon, Menu as MenuIcon, Close as CloseIcon } from "@mui/icons-material";
import NotificationCenter from "./NotificationCenter";
import { getUnreadNotificationCount } from "../services/notificationService";
import LanguageSwitcher from "./LanguageSwitcher";

function AppLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, direction } = useI18n();
  const isRTL = direction === "rtl";
  const [role, setRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLButtonElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const getNavigationLinks = () => {
    if (role === "deaf_mute") {
      return [
        { label: t("dashboard"), path: "/dashboard/deaf-mute" },
        { label: t("book_session"), path: "/book" },
        { label: t("my_sessions"), path: "/sessions" },
      ];
    }
    if (role === "interpreter") {
      return [
        { label: t("dashboard"), path: "/dashboard/interpreter" },
        { label: t("requests"), path: "/requests" },
        { label: t("availability"), path: "/availability" },
        { label: t("my_sessions"), path: "/interpreter/sessions" },
      ];
    }
    return [];
  };

  const navigationLinks = getNavigationLinks();

  return (
    <Box>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "white", color: "#333" }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: "space-between", py: { xs: 1, md: 1 }, px: { xs: 1, md: 2 } }}>
            {/* App Name */}
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                color: "#333", 
                fontSize: { xs: "1rem", sm: "1.25rem" },
                cursor: "pointer",
                direction: direction,
              }}
              onClick={() => navigate(role === "deaf_mute" ? "/dashboard/deaf-mute" : "/dashboard/interpreter")}
            >
              {t("app_name")}
            </Typography>

            {/* Navigation - Desktop */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2, alignItems: "center", flexDirection: isRTL ? "row-reverse" : "row" }}>
              {navigationLinks.map((link) => (
                <Button
                  key={link.path}
                  component={Link}
                  to={link.path}
                  sx={{
                    color: "#333",
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    "&:hover": { color: "#008080", bgcolor: "transparent" },
                  }}
                >
                  {link.label}
                </Button>
              ))}
              <Button
                component={Link}
                to="/profile"
                sx={{
                  color: "#333",
                  textTransform: "none",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  "&:hover": { color: "#008080", bgcolor: "transparent" },
                }}
              >
                {t("profile")}
              </Button>
            </Box>

            {/* Action Buttons & Icons - Desktop */}
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1.5, flexDirection: isRTL ? "row-reverse" : "row" }}>
              {/* Notification Center */}
              <IconButton
                onClick={handleNotificationClick}
                sx={{ color: "#333", "&:hover": { color: "#008080" } }}
              >
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              
              {notificationAnchor && (
                <Popover
                  open={Boolean(notificationAnchor)}
                  anchorEl={notificationAnchor}
                  onClose={handleNotificationClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: isRTL ? 'left' : 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: isRTL ? 'left' : 'right',
                  }}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }
                  }}
                >
                  <NotificationCenter maxNotifications={10} compact={true} />
                </Popover>
              )}
              
              {/* Language Switcher */}
              <Box sx={{ display: "flex", alignItems: "center", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <LanguageIcon sx={{ [isRTL ? "ml" : "mr"]: 1, color: "#333", fontSize: "1.2rem" }} />
                <LanguageSwitcher />
              </Box>
              
              <Button
                onClick={handleLogout}
                variant="outlined"
                size="small"
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#f5f5f5",
                  color: "#d32f2f",
                  border: "1px solid #d32f2f",
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: "#ffebee",
                    border: "1px solid #d32f2f",
                  },
                }}
              >
                {t("logout")}
              </Button>
            </Box>

            {/* Mobile Menu Button */}
            <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
              <IconButton
                onClick={handleNotificationClick}
                sx={{ color: "#333" }}
              >
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              
              {notificationAnchor && (
                <Popover
                  open={Boolean(notificationAnchor)}
                  anchorEl={notificationAnchor}
                  onClose={handleNotificationClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: isRTL ? 'left' : 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: isRTL ? 'left' : 'right',
                  }}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }
                  }}
                >
                  <NotificationCenter maxNotifications={10} compact={true} />
                </Popover>
              )}

              <Box sx={{ display: "flex", alignItems: "center", [isRTL ? "ml" : "mr"]: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                <LanguageIcon sx={{ color: "#333", fontSize: "1.2rem", [isRTL ? "ml" : "mr"]: 0.5 }} />
                <LanguageSwitcher />
              </Box>
              
              <IconButton
                edge={isRTL ? "start" : "end"}
                color="inherit"
                aria-label="menu"
                onClick={handleDrawerToggle}
                sx={{ color: "#333" }}
              >
                {mobileOpen ? <CloseIcon /> : <MenuIcon />}
              </IconButton>
            </Box>
          </Toolbar>
        </Container>

        {/* Mobile Drawer */}
        <Drawer
          anchor={isRTL ? "left" : "right"}
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", md: "none" },
            zIndex: 1300,
            "& .MuiDrawer-paper": {
              width: { xs: "75%", sm: 300 },
              maxWidth: 320,
              boxSizing: "border-box",
              pt: 3,
              px: 2,
              bgcolor: "white",
            },
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, px: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#333", textAlign: isRTL ? "right" : "left" }}>
              {t("app_title")}
            </Typography>
            <IconButton
              onClick={handleDrawerToggle}
              sx={{ color: "#333" }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <List sx={{ pt: 0 }}>
            {navigationLinks.map((link) => (
              <ListItem key={link.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={link.path}
                  onClick={handleDrawerToggle}
                  sx={{
                    py: 1.5,
                    px: 2,
                    borderRadius: 1,
                    mb: 0.5,
                    "&:hover": { bgcolor: "#f5f5f5" },
                  }}
                >
                  <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                    {link.label}
                  </Typography>
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                to="/profile"
                onClick={handleDrawerToggle}
                sx={{
                  py: 1.5,
                  px: 2,
                  borderRadius: 1,
                  mb: 0.5,
                  "&:hover": { bgcolor: "#f5f5f5" },
                }}
              >
                <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("profile")}
                </Typography>
              </ListItemButton>
            </ListItem>
          </List>
          <Box sx={{ px: 2, pt: 3, pb: 2, borderTop: "1px solid #e0e0e0", mt: 2 }}>
            <Button
              onClick={handleLogout}
              variant="outlined"
              fullWidth
              sx={{
                borderRadius: "8px",
                bgcolor: "#f5f5f5",
                color: "#d32f2f",
                border: "1px solid #d32f2f",
                py: 1.25,
                fontSize: "0.95rem",
                fontWeight: 500,
                textTransform: "none",
                "&:hover": {
                  bgcolor: "#ffebee",
                  border: "1px solid #d32f2f",
                },
              }}
            >
              {t("logout")}
            </Button>
          </Box>
        </Drawer>
      </AppBar>
      <Box sx={{ bgcolor: "#f5f5f5", minHeight: "calc(100vh - 64px)" }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default AppLayout;