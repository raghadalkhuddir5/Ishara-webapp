/**
 * Landing Page Component
 * 
 * This is the public-facing homepage of the application. It includes:
 * - Navigation header with language switcher
 * - Hero section with call-to-action
 * - About section explaining the platform
 * - Services section highlighting features for both user types
 * - Contact form section
 * - Footer with social media links
 * 
 * Features:
 * - Responsive design (mobile/desktop)
 * - RTL support for Arabic
 * - Mobile drawer navigation
 * - Smooth scrolling to sections
 */

import { Box, Container, Typography, Button, AppBar, Toolbar, TextField, IconButton, Link, Drawer, List, ListItem, ListItemButton, useMediaQuery, useTheme } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import logoImage from "../assets/images/Ishara Logo.png";
import heroImage from "../assets/images/Video call-amico 1.png";
import aboutImage from "../assets/images/Webinar-rafiki 1.png";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VideocamIcon from "@mui/icons-material/Videocam";
import LanguageIcon from "@mui/icons-material/Language";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InstagramIcon from "@mui/icons-material/Instagram";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import TwitterIcon from "@mui/icons-material/Twitter";
import YouTubeIcon from "@mui/icons-material/YouTube";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";

/**
 * Landing Page Component
 * Main public homepage component
 */
const Landing = () => {
  // Get internationalization context
  const { t, direction } = useI18n();
  // Check if RTL layout is needed
  const isRTL = direction === "rtl";
  // Get theme for responsive breakpoints
  const theme = useTheme();
  // Check if device is mobile/tablet
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // State for mobile drawer (hamburger menu)
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Scroll to a specific section on the page smoothly
   * Used for navigation links
   * 
   * @param sectionId - ID of the section element to scroll to
   */
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    // Close mobile drawer after navigation
    setMobileOpen(false);
  };

  /**
   * Toggle mobile drawer (hamburger menu) open/closed
   */
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh" }}>
      {/* Header */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "white", color: "#333" }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: "space-between", py: { xs: 1, md: 1 }, px: { xs: 1, md: 2 } }}>
            {/* Logo */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <img src={logoImage} alt="Ishara Logo" style={{ height: isMobile ? "32px" : "40px" }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  color: "#333", 
                  display: { xs: "none", sm: "block" },
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                  direction: direction,
                }}
              >
                {t("app_name")}
              </Typography>
            </Box>

            {/* Navigation - Desktop */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 3, alignItems: "center" }}>
              <Link
                component="button"
                onClick={() => scrollToSection("hero")}
                sx={{ color: "#333", textDecoration: "none", cursor: "pointer", "&:hover": { color: "#008080" } }}
              >
                {t("home")}
              </Link>
              <Link
                component="button"
                onClick={() => scrollToSection("about")}
                sx={{ color: "#333", textDecoration: "none", cursor: "pointer", "&:hover": { color: "#008080" } }}
              >
                {t("about")}
              </Link>
              <Link
                component="button"
                onClick={() => scrollToSection("services")}
                sx={{ color: "#333", textDecoration: "none", cursor: "pointer", "&:hover": { color: "#008080" } }}
              >
                {t("services")}
              </Link>
              <Link
                component="button"
                onClick={() => scrollToSection("contact")}
                sx={{ color: "#333", textDecoration: "none", cursor: "pointer", "&:hover": { color: "#008080" } }}
              >
                {t("contact_us")}
              </Link>
            </Box>

            {/* Action Buttons & Language Switcher - Desktop */}
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 2, flexDirection: isRTL ? "row-reverse" : "row" }}>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="small"
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  "&:hover": { bgcolor: "#e0e0e0", border: "none" },
                }}
              >
                {t("login")}
              </Button>
              <Button
                component={RouterLink}
                to="/signup"
                variant="contained"
                size="small"
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#008080",
                  "&:hover": { bgcolor: "#006666" },
                }}
              >
                {t("sign_up")}
              </Button>
              <Box sx={{ display: "flex", alignItems: "center", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <LanguageIcon sx={{ [isRTL ? "ml" : "mr"]: 1, color: "#333", fontSize: "1.2rem" }} />
                <LanguageSwitcher />
              </Box>
            </Box>

            {/* Mobile Menu Button */}
            <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
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
      </AppBar>

      {/* Mobile Drawer - Outside AppBar for better z-index control */}
      <Drawer
        anchor={isRTL ? "left" : "right"}
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
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
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => scrollToSection("hero")} 
              sx={{ 
                py: 1.5,
                px: 2,
                borderRadius: 1,
                mb: 0.5,
                "&:hover": { bgcolor: "#f5f5f5" }
              }}
            >
              <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                {t("home")}
              </Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => scrollToSection("about")} 
              sx={{ 
                py: 1.5,
                px: 2,
                borderRadius: 1,
                mb: 0.5,
                "&:hover": { bgcolor: "#f5f5f5" }
              }}
            >
              <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                {t("about")}
              </Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => scrollToSection("services")} 
              sx={{ 
                py: 1.5,
                px: 2,
                borderRadius: 1,
                mb: 0.5,
                "&:hover": { bgcolor: "#f5f5f5" }
              }}
            >
              <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                {t("services")}
              </Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => scrollToSection("contact")} 
              sx={{ 
                py: 1.5,
                px: 2,
                borderRadius: 1,
                mb: 0.5,
                "&:hover": { bgcolor: "#f5f5f5" }
              }}
            >
              <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#333", textAlign: isRTL ? "right" : "left", direction: direction }}>
                {t("contact_us")}
              </Typography>
            </ListItemButton>
          </ListItem>
        </List>
        <Box sx={{ px: 2, pt: 3, pb: 2, borderTop: "1px solid #e0e0e0", mt: 2 }}>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            fullWidth
            onClick={handleDrawerToggle}
            sx={{
              borderRadius: "8px",
              bgcolor: "#f5f5f5",
              color: "#333",
              border: "none",
              mb: 1.5,
              py: 1.25,
              fontSize: "0.95rem",
              fontWeight: 500,
              "&:hover": { bgcolor: "#e0e0e0", border: "none" },
            }}
          >
            {t("login")}
          </Button>
          <Button
            component={RouterLink}
            to="/signup"
            variant="contained"
            fullWidth
            onClick={handleDrawerToggle}
            sx={{
              borderRadius: "8px",
              bgcolor: "#008080",
              py: 1.25,
              fontSize: "0.95rem",
              fontWeight: 500,
              "&:hover": { bgcolor: "#006666" },
            }}
          >
            {t("sign_up")}
          </Button>
        </Box>
      </Drawer>

      {/* Hero Section */}
      <Box id="hero" sx={{ py: { xs: 4, md: 8 }, bgcolor: "white", px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: isRTL ? "row-reverse" : "row" },
              gap: { xs: 3, md: 4 },
              alignItems: "center",
            }}
          >
            <Box sx={{ flex: 1, textAlign: { xs: "center", md: isRTL ? "right" : "left" }, width: "100%" }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  color: "#333",
                  mb: { xs: 1.5, md: 2 },
                  fontSize: { xs: "1.75rem", sm: "2.25rem", md: "3rem" },
                  lineHeight: 1.2,
                  direction: direction,
                }}
              >
                {t("hero_title")}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: "#008080",
                  mb: { xs: 3, md: 4 },
                  fontSize: { xs: "0.9rem", sm: "1rem", md: "1.25rem" },
                  lineHeight: 1.5,
                  direction: direction,
                }}
              >
                {t("hero_subtitle")}
              </Typography>
              <Button
                component={RouterLink}
                to="/signup"
                variant="contained"
                size={isMobile ? "medium" : "large"}
                sx={{
                  borderRadius: "8px",
                  bgcolor: "#008080",
                  px: { xs: 3, md: 4 },
                  py: { xs: 1, md: 1.5 },
                  fontSize: { xs: "0.9rem", md: "1rem" },
                  "&:hover": { bgcolor: "#006666" },
                }}
              >
                {t("register")}
              </Button>
            </Box>
            <Box sx={{ flex: 1, display: "flex", justifyContent: "center", width: "100%" }}>
              <Box
                component="img"
                src={heroImage}
                alt="Video call illustration"
                sx={{
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: { xs: "300px", md: "none" },
                }}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* About Section */}
      <Box id="about" sx={{ py: { xs: 4, md: 8 }, bgcolor: "white", px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: "#333",
              textAlign: "center",
              mb: { xs: 3, md: 4 },
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
            }}
          >
            {t("about_title")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#333",
              mb: { xs: 2, md: 3 },
              fontSize: { xs: "0.95rem", md: "1.1rem" },
              lineHeight: 1.8,
              textAlign: { xs: isRTL ? "right" : "left", md: isRTL ? "right" : "left" },
              direction: direction,
            }}
          >
            {t("about_paragraph1")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: isRTL ? "row-reverse" : "row" },
              gap: { xs: 3, md: 4 },
              alignItems: "center",
            }}
          >
            <Box sx={{ flex: 1, width: "100%" }}>
              <Typography
                variant="body1"
                sx={{
                  color: "#333",
                  fontSize: { xs: "0.95rem", md: "1.1rem" },
                  lineHeight: 1.8,
                  textAlign: isRTL ? "right" : "left",
                  direction: direction,
                }}
              >
                {t("about_paragraph2")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, display: "flex", justifyContent: "center", width: "100%" }}>
              <img
                src={aboutImage}
                alt="Communication illustration"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Services Section */}
      <Box id="services" sx={{ py: { xs: 4, md: 8 }, bgcolor: "white", px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: "#333",
              textAlign: "center",
              mb: { xs: 1.5, md: 2 },
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
            }}
          >
            {t("services_title")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#333",
              textAlign: "center",
              mb: { xs: 4, md: 6 },
              fontSize: { xs: "0.95rem", md: "1.1rem" },
              maxWidth: "800px",
              mx: "auto",
              px: { xs: 2, md: 0 },
            }}
          >
            {t("services_intro")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: { xs: 4, md: 4 },
            }}
          >
            <Box
              sx={{
                flex: 1,
                borderRight: { md: isRTL ? "none" : "1px solid #e0e0e0" },
                borderLeft: { md: isRTL ? "1px solid #e0e0e0" : "none" },
                borderBottom: { xs: "1px solid #e0e0e0", md: "none" },
                pb: { xs: 4, md: 0 },
                pr: { md: isRTL ? 0 : 4 },
                pl: { md: isRTL ? 4 : 0 },
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: "#008080",
                  mb: { xs: 2, md: 3 },
                  fontSize: { xs: "1.25rem", md: "1.5rem" },
                  textAlign: isRTL ? "right" : "left",
                  direction: direction,
                }}
              >
                {t("services_for_deaf_mute")}
              </Typography>
              <Box sx={{ mb: { xs: 2, md: 3 }, display: "flex", gap: { xs: 1.5, md: 2 }, alignItems: "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <AccessTimeIcon sx={{ color: "#008080", mt: 0.5, fontSize: { xs: "1.2rem", md: "1.5rem" }, flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: "#333", fontSize: { xs: "0.9rem", md: "1rem" }, textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("service_scheduled_sessions")}
                </Typography>
              </Box>
              <Box sx={{ mb: { xs: 2, md: 3 }, display: "flex", gap: { xs: 1.5, md: 2 }, alignItems: "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <VideocamIcon sx={{ color: "#008080", mt: 0.5, fontSize: { xs: "1.2rem", md: "1.5rem" }, flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: "#333", fontSize: { xs: "0.9rem", md: "1rem" }, textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("service_instant_video")}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: { xs: 1.5, md: 2 }, alignItems: "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <LanguageIcon sx={{ color: "#008080", mt: 0.5, fontSize: { xs: "1.2rem", md: "1.5rem" }, flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: "#333", fontSize: { xs: "0.9rem", md: "1rem" }, textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("service_multi_language")}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1, pl: { md: isRTL ? 0 : 4 }, pr: { md: isRTL ? 4 : 0 } }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: "#008080",
                  mb: { xs: 2, md: 3 },
                  fontSize: { xs: "1.25rem", md: "1.5rem" },
                  textAlign: isRTL ? "right" : "left",
                  direction: direction,
                }}
              >
                {t("services_for_interpreters")}
              </Typography>
              <Box sx={{ mb: { xs: 2, md: 3 }, display: "flex", gap: { xs: 1.5, md: 2 }, alignItems: "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <CalendarTodayIcon sx={{ color: "#008080", mt: 0.5, fontSize: { xs: "1.2rem", md: "1.5rem" }, flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: "#333", fontSize: { xs: "0.9rem", md: "1rem" }, textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("service_flexible_scheduling")}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: { xs: 1.5, md: 2 }, alignItems: "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <DashboardIcon sx={{ color: "#008080", mt: 0.5, fontSize: { xs: "1.2rem", md: "1.5rem" }, flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: "#333", fontSize: { xs: "0.9rem", md: "1rem" }, textAlign: isRTL ? "right" : "left", direction: direction }}>
                  {t("service_professional_dashboard")}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Contact Section */}
      <Box id="contact" sx={{ py: { xs: 4, md: 8 }, bgcolor: "white", px: { xs: 2, md: 0 } }}>
        <Container maxWidth="md">
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: "#333",
              textAlign: "center",
              mb: { xs: 3, md: 4 },
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
            }}
          >
            {t("contact_title")}
          </Typography>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              // Form submission can be handled here later
            }}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { xs: 2, md: 3 },
              maxWidth: "600px",
              mx: "auto",
            }}
          >
            <TextField
              label={t("name")}
              variant="outlined"
              fullWidth
              placeholder="Value"
              dir={direction}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "white",
                  direction: direction,
                },
                "& .MuiInputLabel-root": {
                  left: isRTL ? "auto" : undefined,
                  right: isRTL ? "14px" : undefined,
                },
                "& .MuiOutlinedInput-input": {
                  textAlign: isRTL ? "right" : "left",
                },
              }}
            />
            <TextField
              label={t("surname")}
              variant="outlined"
              fullWidth
              placeholder="Value"
              dir={direction}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "white",
                  direction: direction,
                },
                "& .MuiInputLabel-root": {
                  left: isRTL ? "auto" : undefined,
                  right: isRTL ? "14px" : undefined,
                },
                "& .MuiOutlinedInput-input": {
                  textAlign: isRTL ? "right" : "left",
                },
              }}
            />
            <TextField
              label={t("email")}
              variant="outlined"
              fullWidth
              placeholder="Value"
              type="email"
              dir={direction}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "white",
                  direction: direction,
                },
                "& .MuiInputLabel-root": {
                  left: isRTL ? "auto" : undefined,
                  right: isRTL ? "14px" : undefined,
                },
                "& .MuiOutlinedInput-input": {
                  textAlign: isRTL ? "right" : "left",
                },
              }}
            />
            <TextField
              label={t("message")}
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              placeholder="Value"
              dir={direction}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "white",
                  direction: direction,
                },
                "& .MuiInputLabel-root": {
                  left: isRTL ? "auto" : undefined,
                  right: isRTL ? "14px" : undefined,
                },
                "& .MuiOutlinedInput-input": {
                  textAlign: isRTL ? "right" : "left",
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size={isMobile ? "medium" : "large"}
              sx={{
                borderRadius: "8px",
                bgcolor: "#008080",
                py: { xs: 1.25, md: 1.5 },
                fontSize: { xs: "0.9rem", md: "1rem" },
                "&:hover": { bgcolor: "#006666" },
              }}
            >
              {t("submit")}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: "#f5e6d3", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { xs: 3, md: 2 },
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, justifyContent: "center" }}>
                <img src={logoImage} alt="Ishara Logo" style={{ height: isMobile ? "32px" : "40px" }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: "#333", fontSize: { xs: "1rem", md: "1.25rem" }, direction: direction }}>
                  {t("app_name")}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: { xs: 1, md: 2 }, justifyContent: "center" }}>
                <IconButton sx={{ color: "#333", p: { xs: 1, md: 1.5 } }}>
                  <InstagramIcon sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }} />
                </IconButton>
                <IconButton sx={{ color: "#333", p: { xs: 1, md: 1.5 } }}>
                  <WhatsAppIcon sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }} />
                </IconButton>
                <IconButton sx={{ color: "#333", p: { xs: 1, md: 1.5 } }}>
                  <TwitterIcon sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }} />
                </IconButton>
                <IconButton sx={{ color: "#333", p: { xs: 1, md: 1.5 } }}>
                  <YouTubeIcon sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }} />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <Typography
                variant="body2"
                sx={{
                  color: "#666",
                  textAlign: "center",
                  fontSize: { xs: "0.75rem", md: "0.875rem" },
                }}
              >
                {t("all_rights_reserved")}
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;

