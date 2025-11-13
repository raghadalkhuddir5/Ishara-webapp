/**
 * Dashboard Interpreter Page Component
 * 
 * This is the main dashboard page for interpreters. It provides quick access
 * to key features like viewing requests, managing availability, viewing sessions,
 * and accessing profile.
 * 
 * Features:
 * - Navigation cards to key interpreter features
 * - Responsive grid layout
 * - RTL support for Arabic
 * - Logo and branding display
 */

import { Box, Container, Typography, Button, Card, CardContent, CardActions, useTheme, useMediaQuery } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import logoImage from "../assets/images/Ishara Logo.png";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import PersonIcon from "@mui/icons-material/Person";

/**
 * DashboardInterpreter Component
 * 
 * Main dashboard component for interpreters.
 */
function DashboardInterpreter() {
  // Get internationalization context
  const { t, direction } = useI18n();
  
  // Responsive design helpers
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  /**
   * Services array
   * 
   * Defines the navigation cards displayed on the dashboard.
   * Each service has an icon, title, description, and route link.
   */
  const services = [
    {
      id: "requests",
      title: t("requests"),
      description: t("interpreter_dashboard_desc"),
      icon: <AssignmentIcon sx={{ fontSize: { xs: "2.5rem", md: "3rem" }, color: "#008080" }} />,
      link: "/requests",
      color: "#008080",
    },
    {
      id: "availability",
      title: t("availability"),
      description: t("service_flexible_scheduling"),
      icon: <CalendarTodayIcon sx={{ fontSize: { xs: "2.5rem", md: "3rem" }, color: "#008080" }} />,
      link: "/availability",
      color: "#008080",
    },
    {
      id: "sessions",
      title: t("my_sessions"),
      description: t("service_professional_dashboard"),
      icon: <VideoLibraryIcon sx={{ fontSize: { xs: "2.5rem", md: "3rem" }, color: "#008080" }} />,
      link: "/interpreter/sessions",
      color: "#008080",
    },
    {
      id: "profile",
      title: t("profile"),
      description: t("my_profile"),
      icon: <PersonIcon sx={{ fontSize: { xs: "2.5rem", md: "3rem" }, color: "#008080" }} />,
      link: "/profile",
      color: "#008080",
    },
  ];

  return (
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Container maxWidth="lg">
        {/* Header with Logo and Title */}
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
          <Box
            component="img"
            src={logoImage}
            alt="Ishara Logo"
            sx={{
              height: { xs: "40px", md: "50px" },
            }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
              {t("interpreter_dashboard_title")}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#666",
                fontSize: { xs: "0.875rem", md: "1rem" },
                mt: 0.5,
                direction: direction,
                textAlign: "center",
              }}
            >
              {t("interpreter_dashboard_desc")}
            </Typography>
          </Box>
        </Box>

        {/* Services Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(2, 1fr)",
              lg: "repeat(2, 1fr)",
            },
            gap: { xs: 2, md: 3 },
          }}
        >
          {services.map((service) => (
            <Card
              key={service.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: "0 4px 16px rgba(0,128,128,0.2)",
                  transform: "translateY(-4px)",
                },
                bgcolor: "white",
              }}
            >
              <CardContent
                sx={{
                  flexGrow: 1,
                  p: { xs: 2, md: 3 },
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Box
                  sx={{
                    mb: 2,
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  {service.icon}
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: "#333",
                    mb: 1,
                    fontSize: { xs: "1.25rem", md: "1.5rem" },
                    direction: direction,
                    textAlign: "center",
                  }}
                >
                  {service.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#666",
                    lineHeight: 1.6,
                    fontSize: { xs: "0.875rem", md: "0.95rem" },
                    direction: direction,
                    textAlign: "center",
                  }}
                >
                  {service.description}
                </Typography>
              </CardContent>
              <CardActions
                sx={{
                  p: { xs: 2, md: 3 },
                  pt: 0,
                  justifyContent: "center",
                }}
              >
                <Button
                  component={RouterLink}
                  to={service.link}
                  variant="contained"
                  size={isMobile ? "medium" : "large"}
                  sx={{
                    borderRadius: "8px",
                    bgcolor: service.color,
                    px: { xs: 3, md: 4 },
                    py: { xs: 1, md: 1.5 },
                    fontSize: { xs: "0.875rem", md: "1rem" },
                    fontWeight: 500,
                    textTransform: "none",
                    "&:hover": {
                      bgcolor: "#006666",
                    },
                  }}
                >
                  {t("view")}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default DashboardInterpreter;
