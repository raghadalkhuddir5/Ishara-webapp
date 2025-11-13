/**
 * Signup Page Component
 * 
 * This component handles new user registration with two methods:
 * 1. Email/Password registration via Firebase Auth
 * 2. Google Sign-Up via Firebase Auth
 * 
 * Features:
 * - Role selection (Deaf/Mute or Interpreter)
 * - Profile information collection
 * - Creates user document in Firestore
 * - Creates interpreter profile if role is interpreter
 * - Form validation and error handling
 * - RTL support for Arabic
 * 
 * Data Created:
 * - Firebase Auth user account
 * - Firestore user document with profile data
 * - Firestore interpreter document (if interpreter role)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Person as PersonIcon, Translate as TranslateIcon, Language as LanguageIcon } from "@mui/icons-material";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

/**
 * Signup Component
 * Handles new user registration
 */
function Signup() {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"deaf_mute" | "interpreter">("deaf_mute"); // User role selection
  const [fullName, setFullName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState(""); // Error message display
  const [isLoading, setIsLoading] = useState(false); // Loading state during registration
  
  // Navigation and i18n
  const navigate = useNavigate();
  const { t, locale, direction } = useI18n();
  const isRTL = direction === 'rtl';

  /**
   * Calculate age from birthdate string
   * 
   * @param birthdateStr - Birthdate in ISO format (YYYY-MM-DD)
   * @returns Calculated age in years
   */
  const calculateAge = (birthdateStr: string): number => {
    if (!birthdateStr) return 0;
    const birthdate = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    
    // Adjust age if birthday hasn't occurred this year yet
    const monthDiff = today.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }
    return age;
  };

  /**
   * Handle email/password signup
   * 
   * Creates a new user account with Firebase Auth and saves profile data to Firestore.
   * Also creates interpreter profile document if user selected interpreter role.
   */
  const handleSignup = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Step 1: Create user account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Save user profile document in Firestore
      const now = new Date();
      const age = birthdate ? calculateAge(birthdate) : 0;
      await setDoc(doc(db, "users", user.uid), {
        user_id: user.uid,
        email: user.email,
        password_hash: "", // Firebase handles password hashing, not stored in Firestore
        role: role, // Store selected role
        full_name: fullName,
        birthdate: birthdate || null,
        age: age, // Store calculated age for quick access
        language: locale, // Store user's language preference
        phone_number: phoneNumber,
        created_at: now,
        updated_at: now,
      });

      // Step 3: Create interpreter profile document if user is an interpreter
      // This document stores interpreter-specific data like availability and ratings
      if (role === "interpreter") {
        await setDoc(doc(db, "interpreters", user.uid), {
          interpreter_id: user.uid,
          availability: {}, // Empty availability object, will be set later
          average_rating: 0, // Initialize rating
          total_sessions: 0, // Initialize session count
          bio: "", // Empty bio, can be filled later
        });
      }

      console.log("✅ User Firestore doc created with role:", role);

      // Step 4: Redirect to dashboard
      // ProtectedRoute will handle role-based routing
      navigate("/dashboard");
     
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Handle specific Firebase Auth error codes with translated messages
      if (error.code === 'auth/email-already-in-use') {
        setError(t("signup_failed_email_exists"));
      } else if (error.code === 'auth/weak-password') {
        setError(t("password_should_be_at_least_6_characters"));
      } else if (error.code === 'auth/invalid-email') {
        setError(t("login_failed_invalid_email"));
      } else {
        setError(error.message || t("signup_failed_generic"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google Sign-Up
   * 
   * Creates a new user account via Google OAuth and saves profile data to Firestore.
   * Uses Google display name if available, otherwise falls back to form input.
   */
  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Step 1: Authenticate with Google OAuth
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Step 2: Save user profile document in Firestore
      // Use Google display name if available, otherwise use form input
      const now = new Date();
      const age = birthdate ? calculateAge(birthdate) : 0;
      await setDoc(doc(db, "users", user.uid), {
        user_id: user.uid,
        email: user.email,
        password_hash: "", // Firebase handles password hashing
        role: role,
        full_name: user.displayName || fullName || "Google User", // Prefer Google name
        birthdate: birthdate || null,
        age: age,
        language: locale,
        phone_number: phoneNumber,
        created_at: now,
        updated_at: now,
      });

      // Step 3: Create interpreter profile if user is an interpreter
      if (role === "interpreter") {
        await setDoc(doc(db, "interpreters", user.uid), {
          interpreter_id: user.uid,
          availability: {},
          average_rating: 0,
          total_sessions: 0,
          bio: "",
        });
      }

      console.log("✅ User signed up with Google:", user);
      
      // Step 4: Redirect to dashboard
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Google signup error:", error);
      
      // Handle Google-specific error codes
      if (error.code === 'auth/popup-closed-by-user') {
        setError(t("google_login_cancelled"));
      } else if (error.code === 'auth/popup-blocked') {
        setError(t("google_login_blocked"));
      } else {
        setError(error.message || t("google_login_failed"));
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

        {/* Signup Form Card */}
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
                {t("welcome")}
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
                {t("sign_up")}
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

              {/* Role Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  sx={{
                    mb: 1.5,
                    color: '#666',
                    fontWeight: 500,
                    direction: direction,
                  }}
                >
                  {t("signup_welcome_subtitle")}
                </Typography>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}
                >
                  <Button
                    variant={role === "deaf_mute" ? "contained" : "outlined"}
                    onClick={() => setRole("deaf_mute")}
                    disabled={isLoading}
                    fullWidth
                    startIcon={<PersonIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      bgcolor: role === "deaf_mute" ? '#008080' : 'transparent',
                      color: role === "deaf_mute" ? 'white' : '#008080',
                      borderColor: '#008080',
                      '&:hover': {
                        bgcolor: role === "deaf_mute" ? '#006666' : 'rgba(0,128,128,0.05)',
                        borderColor: '#008080',
                      },
                    }}
                  >
                    {t("role_deaf_mute")}
                  </Button>
                  <Button
                    variant={role === "interpreter" ? "contained" : "outlined"}
                    onClick={() => setRole("interpreter")}
                    disabled={isLoading}
                    fullWidth
                    startIcon={<TranslateIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      bgcolor: role === "interpreter" ? '#008080' : 'transparent',
                      color: role === "interpreter" ? 'white' : '#008080',
                      borderColor: '#008080',
                      '&:hover': {
                        bgcolor: role === "interpreter" ? '#006666' : 'rgba(0,128,128,0.05)',
                        borderColor: '#008080',
                      },
                    }}
                  >
                    {t("role_interpreter")}
                  </Button>
                </Stack>
              </Box>

              {/* Google Sign-Up Button */}
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
                onClick={handleGoogleSignup}
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
                  label={t("full_name")}
                  fullWidth
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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

                <TextField
                  label={t("birthdate")}
                  type="date"
                  fullWidth
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  disabled={isLoading}
                  InputLabelProps={{
                    shrink: true,
                    sx: { direction: direction },
                  }}
                  inputProps={{
                    sx: { direction: direction },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    },
                  }}
                />
                {birthdate && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#666',
                      fontSize: '0.875rem',
                      direction: direction,
                    }}
                  >
                    {t("calculated_age")}: {calculateAge(birthdate)} {t("years")}
                  </Typography>
                )}

                <TextField
                  label={t("phone_number")}
                  fullWidth
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
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
                onClick={handleSignup}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? t("signing_in") : t("create_account")}
              </Button>

              {/* Login Link */}
              <Box
                sx={{
                  mt: 3,
                  textAlign: 'center',
                  direction: direction,
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ direction: direction }}>
                  {t("already_have_account") || "Already have an account?"}{' '}
                  <Link
                    to="/login"
                    style={{
                      color: '#008080',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    {t("login")}
                  </Link>
                </Typography>
              </Box>
            </CardContent>
          </Card>
      </Container>
    </Box>
  );
}

export default Signup;