/**
 * Main Entry Point
 * 
 * This is the entry point of the React application. It:
 * - Renders the root React component
 * - Sets up context providers (Auth, I18n)
 * - Configures Material-UI theme with RTL support
 * - Registers service worker for Firebase Cloud Messaging
 * 
 * Provider Hierarchy:
 * 1. AuthProvider - Manages authentication state
 * 2. I18nProvider - Manages internationalization (language, translations)
 * 3. ThemeProvider - Provides Material-UI theme with RTL support
 * 4. App - Main application component with routing
 */

/* eslint-disable react-refresh/only-export-components */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useI18n } from "./context/I18nContext";

/**
 * Register Service Worker for Firebase Cloud Messaging
 * 
 * Registers the Firebase messaging service worker to enable push notifications.
 * The service worker handles background notifications when the app is not active.
 */
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

/**
 * ThemedApp Component
 * 
 * Wraps the App component with Material-UI ThemeProvider.
 * Dynamically creates theme based on current locale and direction (LTR/RTL).
 * Updates HTML document language attribute when locale changes.
 */
function ThemedApp() {
  // Get current locale and direction from I18n context
  const { direction, locale } = useI18n();
  
  /**
   * useEffect: Update HTML document language attribute
   * 
   * Sets the lang attribute on the HTML element to match the current locale.
   * This helps with accessibility and browser language detection.
   */
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  
  /**
   * Create Material-UI theme
   * 
   * Creates a Material-UI theme with:
   * - Direction (LTR/RTL) based on current locale
   * - Font family based on direction (Arabic font for RTL, Inter for LTR)
   * - Component overrides for RTL font support
   */
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

/**
 * Render Application
 * 
 * Renders the root React component into the DOM.
 * 
 * Provider Hierarchy (outermost to innermost):
 * 1. React.StrictMode - Enables React strict mode for development
 * 2. AuthProvider - Provides authentication context to all components
 * 3. I18nProvider - Provides internationalization context to all components
 * 4. ThemedApp - Wraps App with Material-UI theme provider
 * 5. App - Main application component with routing
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <I18nProvider>
        <ThemedApp />
      </I18nProvider>
    </AuthProvider>
  </React.StrictMode>
);