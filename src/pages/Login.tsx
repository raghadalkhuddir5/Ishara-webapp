import { useState } from "react";
import { TextField, Button, Typography, Box, Alert, Divider } from "@mui/material";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Log in with Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);

      console.log("✅ User logged in");

      // Redirect to ProtectedRoute
      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Login error:", error);
      
      const errorMessage = error instanceof Error ? error.message : t("login_failed_generic");
      const errorCode = (error as { code?: string }).code;
      
      if (errorCode === 'auth/user-not-found') {
        setError(t("login_failed_user_not_found"));
      } else if (errorCode === 'auth/wrong-password') {
        setError(t("login_failed_wrong_password"));
      } else if (errorCode === 'auth/invalid-email') {
        setError(t("login_failed_invalid_email"));
      } else if (errorCode === 'auth/too-many-requests') {
        setError(t("login_failed_too_many_requests"));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      console.log("✅ User logged in with Google:", result.user);
      
      // Redirect to ProtectedRoute
      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Google login error:", error);
      
      const errorMessage = error instanceof Error ? error.message : t("google_login_failed");
      const errorCode = (error as { code?: string }).code;
      
      if (errorCode === 'auth/popup-closed-by-user') {
        setError(t("google_login_cancelled"));
      } else if (errorCode === 'auth/popup-blocked') {
        setError(t("google_login_blocked"));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 400, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        {t("login")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Google Sign-In Button */}
      <Button
        variant="outlined"
        fullWidth
        sx={{ 
          mt: 2, 
          mb: 2,
          backgroundColor: 'white',
          color: 'black',
          border: '1px solid #dadce0',
          '&:hover': {
            backgroundColor: '#f8f9fa',
            border: '1px solid #dadce0'
          }
        }}
        onClick={handleGoogleLogin}
        disabled={isLoading}
        startIcon={
          <img 
            src="https://developers.google.com/identity/images/g-logo.png" 
            alt="Google" 
            style={{ width: 20, height: 20 }}
          />
        }
      >
        {isLoading ? t("signing_in") : t("continue_with_google")}
      </Button>

      <Divider sx={{ my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("or")}
        </Typography>
      </Divider>

      {/* Email/Password Form */}
      <TextField
        label={t("email")}
        fullWidth
        margin="normal"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />

      <TextField
        label={t("password")}
        type="password"
        fullWidth
        margin="normal"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
      />

      <Button
        variant="contained"
        fullWidth
        sx={{ mt: 3 }}
        onClick={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? t("signing_in") : t("login")}
      </Button>
    </Box>
  );
}

export default Login;