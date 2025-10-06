/* eslint-disable @typescript-eslint/no-explicit-any */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Login error:", error);
      
      if (error.code === 'auth/user-not-found') {
        setError("No account found with this email. Please sign up first.");
      } else if (error.code === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(error.message || "Login failed. Please try again.");
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
    } catch (error: any) {
      console.error("Google login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled. Please try again.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("Popup was blocked by your browser. Please allow popups and try again.");
      } else {
        setError(error.message || "Google sign-in failed. Please try again.");
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
        {isLoading ? "Signing In..." : "Continue with Google"}
      </Button>

      <Divider sx={{ my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          or
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
        {isLoading ? "Signing In..." : t("login")}
      </Button>
    </Box>
  );
}

export default Login;
