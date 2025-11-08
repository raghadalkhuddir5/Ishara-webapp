import { useState } from "react";
import { 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert, 
  Divider, 
  Container, 
  Card, 
  CardContent,
  Stack,
  CircularProgress
} from "@mui/material";
import { Language as LanguageIcon } from "@mui/icons-material";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t, direction } = useI18n();
  const isRTL = direction === 'rtl';

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
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
        py: { xs: 4, md: 6 },
        px: { xs: 2, md: 0 },
      }}
    >
      <Container maxWidth="sm">
        {/* Language Switcher - Top Right */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            mb: 2,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
          >
            <LanguageIcon sx={{ color: '#008080', fontSize: '1.2rem' }} />
            <LanguageSwitcher />
          </Box>
        </Box>

        {/* Login Form Card */}
        <Card
          sx={{
            width: '100%',
            maxWidth: 600,
            mx: 'auto',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mb: 0.5,
                  color: '#333',
                  direction: direction,
                  fontSize: { xs: '1.75rem', md: '2rem' },
                }}
              >
                {t("welcome_back")}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 500,
                  color: '#008080',
                  direction: direction,
                  fontSize: { xs: '1rem', md: '1.125rem' },
                }}
              >
                {t("login")}
              </Typography>
            </Box>

            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: '8px',
                  direction: direction,
                }}
              >
                {error}
              </Alert>
            )}

            {/* Google Sign-In Button */}
            <Button
              variant="outlined"
              fullWidth
              sx={{
                mb: 3,
                py: 1.5,
                backgroundColor: 'white',
                color: '#333',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dadce0',
                },
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

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, direction: direction }}>
                {t("or")}
              </Typography>
            </Divider>

            {/* Email/Password Form */}
            <Stack spacing={2.5}>
              <TextField
                label={t("email")}
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  },
                }}
                InputLabelProps={{
                  sx: { direction: direction },
                }}
                inputProps={{
                  sx: { direction: direction },
                }}
              />

              <TextField
                label={t("password")}
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  },
                }}
                InputLabelProps={{
                  sx: { direction: direction },
                }}
                inputProps={{
                  sx: { direction: direction },
                }}
              />
            </Stack>

            <Button
              variant="contained"
              fullWidth
              sx={{
                mt: 3,
                py: 1.5,
                borderRadius: '8px',
                bgcolor: '#008080',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#006666',
                },
              }}
              onClick={handleLogin}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoading ? t("signing_in") : t("login")}
            </Button>

            {/* Signup Link */}
            <Box
              sx={{
                mt: 3,
                textAlign: 'center',
                direction: direction,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ direction: direction }}>
                {t("dont_have_account") || "Don't have an account?"}{' '}
                <Link
                  to="/signup"
                  style={{
                    color: '#008080',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {t("sign_up")}
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default Login;