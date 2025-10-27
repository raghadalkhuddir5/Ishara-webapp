/* eslint-disable react-refresh/only-export-components */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useI18n } from "./context/I18nContext";

// Register service worker for FCM
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

function ThemedApp() {
  const { direction, locale } = useI18n();
  
  // Update document language attribute
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  
  const theme = createTheme({
    direction,
    typography: {
      fontFamily: direction === "rtl" ? "'Noto Naskh Arabic', system-ui, Arial" : "'Inter', system-ui, Arial",
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            ...(direction === "rtl" && {
              fontFamily: "'Noto Naskh Arabic', system-ui, Arial",
            }),
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            ...(direction === "rtl" && {
              fontFamily: "'Noto Naskh Arabic', system-ui, Arial",
            }),
          },
        },
      },
    },
  });
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <I18nProvider>
        <ThemedApp />
      </I18nProvider>
    </AuthProvider>
  </React.StrictMode>
);