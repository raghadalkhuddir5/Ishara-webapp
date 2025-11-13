/**
 * Profile Page Component
 * 
 * This component displays and allows editing of user profile information.
 * For interpreters, it also shows statistics like total sessions completed,
 * average rating, and recent reviews.
 * 
 * Features:
 * - View and edit personal information (name, birthdate, phone, language)
 * - For interpreters: view statistics and ratings
 * - Supports RTL (Right-to-Left) layout for Arabic language
 * - Real-time updates when profile is saved
 */

import { useEffect, useState } from "react";
import { Box, Container, Button, MenuItem, TextField, Typography, Snackbar, Alert, Stack, Card, CardContent, CircularProgress, Chip } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useI18n } from "../context/I18nContext";
import { getRatingsForInterpreter } from "../services/ratingService";
import type { RatingData } from "../services/ratingService";
import { Star } from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EmailIcon from "@mui/icons-material/Email";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";

/**
 * UserData Interface
 * Defines the structure of user data retrieved from Firestore
 */
interface UserData {
  full_name?: string;
  age?: number;
  birthdate?: string;
  phone_number?: string;
  language?: string;
  role?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  created_at?: any;
}

/**
 * Profile Component
 * Main component for displaying and editing user profile
 */
function Profile() {
  // Get authenticated user from AuthContext
  const { user } = useAuth();
  // Get internationalization functions and direction (LTR/RTL)
  const { t, setLocale, direction } = useI18n();
  // Check if current language is RTL (Right-to-Left) for layout adjustments
  const isRTL = direction === "rtl";
  // State for form fields - editable user information
  const [fullName, setFullName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState("");
  
  // State for UI feedback and loading states
  const [saving, setSaving] = useState(false); // Loading state when saving profile
  const [message, setMessage] = useState<string>(""); // Success/error message
  const [open, setOpen] = useState(false); // Controls snackbar visibility
  
  // State for user role and interpreter-specific data
  const [userRole, setUserRole] = useState<string>(""); // "interpreter" or "deaf_mute"
  const [ratings, setRatings] = useState<RatingData[]>([]); // List of ratings received
  const [averageRating, setAverageRating] = useState<number>(0); // Calculated average rating
  const [joinDate, setJoinDate] = useState<Date | null>(null); // Account creation date
  const [totalSessions, setTotalSessions] = useState<number>(0); // Total completed sessions

  /**
   * useEffect: Load user profile data from Firestore
   * 
   * This effect runs when the component mounts or when the user changes.
   * It fetches the user's profile data and populates the form fields.
   */
  useEffect(() => {
    const load = async () => {
      // Exit early if no user is authenticated
      if (!user) return;
      
      // Fetch user document from Firestore
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data() as UserData;
        
        // Populate form fields with user data
        setFullName(d.full_name ?? "");
        
        // Handle birthdate: prefer actual birthdate, fallback to calculated from age
        // If birthdate exists, use it; otherwise calculate from age if available
        if (d.birthdate) {
          setBirthdate(d.birthdate);
        } else if (d.age) {
          // Calculate approximate birthdate from age (set to January 1st of that year)
          // This is a fallback for users who only provided age during signup
          const currentYear = new Date().getFullYear();
          const birthYear = currentYear - d.age;
          setBirthdate(`${birthYear}-01-01`);
        } else {
          setBirthdate("");
        }
        
        // Set remaining form fields with default values if missing
        setPhoneNumber(d.phone_number ?? "");
        setLanguage(d.language ?? "en"); // Default to English
        setUserRole(d.role ?? ""); // Store role for conditional rendering
        
        // Convert Firestore timestamp to JavaScript Date for join date display
        if (d.created_at) {
          const createdDate = d.created_at.toDate ? d.created_at.toDate() : new Date(d.created_at);
          setJoinDate(createdDate);
        }
      }
    };
    load();
  }, [user]);

  /**
   * useEffect: Load interpreter statistics
   * 
   * This effect runs when the user role is determined and the user is an interpreter.
   * It fetches statistics like total completed sessions to display in the profile.
   */
  useEffect(() => {
    const loadStatistics = async () => {
      // Only load statistics for interpreters
      if (!user || userRole !== "interpreter") return;
      
      try {
        // Query Firestore for all completed sessions for this interpreter
        // This count is used to show total sessions completed in the profile
        const sessionsQuery = query(
          collection(db, "sessions"),
          where("interpreter_id", "==", user.uid),
          where("status", "==", "completed")
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const completedSessions = sessionsSnapshot.docs;
        setTotalSessions(completedSessions.length);
      } catch (error) {
        console.error("Failed to load statistics:", error);
      }
    };
    
    // Only load statistics once userRole is set
    if (userRole) {
      loadStatistics();
    }
  }, [user, userRole]);

  /**
   * useEffect: Load interpreter ratings
   * 
   * This effect loads the ratings received by the interpreter and calculates
   * the average rating. Only runs for interpreters.
   */
  useEffect(() => {
    const loadRatings = async () => {
      // Only load ratings for interpreters
      if (!user || userRole !== "interpreter") return;
      
      try {
        // Fetch the 10 most recent ratings for this interpreter
        const interpreterRatings = await getRatingsForInterpreter(user.uid, 10);
        setRatings(interpreterRatings);
        
        // Calculate average rating from all ratings
        // Round to 1 decimal place for display
        if (interpreterRatings.length > 0) {
          const sum = interpreterRatings.reduce((acc, rating) => acc + (rating.stars || 0), 0);
          setAverageRating(Math.round((sum / interpreterRatings.length) * 10) / 10);
        } else {
          setAverageRating(0);
        }
      } catch (error) {
        console.error("Failed to load ratings:", error);
      }
    };
    
    // Only load ratings once userRole is set
    if (userRole) {
      loadRatings();
    }
  }, [user, userRole]);

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
   * Save profile changes to Firestore
   * 
   * This function updates the user's profile in Firestore with the current form values.
   * It also updates the app locale if the language preference changed.
   */
  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Calculate age from birthdate before saving
      const age = birthdate ? calculateAge(birthdate) : 0;
      
      // Update user document in Firestore with new profile data
      await updateDoc(doc(db, "users", user.uid), {
        full_name: fullName,
        birthdate: birthdate || null,
        age: age, // Store calculated age for quick access
        phone_number: phoneNumber,
        language,
        updated_at: new Date(), // Track when profile was last updated
      });
      
      // Update app locale if language preference changed
      // This immediately changes the UI language
      await setLocale(language as "en" | "ar");
      
      // Show success message
      setMessage(t("profile_updated_success"));
      setOpen(true);
    } catch (error) {
      console.error("Failed to update profile:", error);
      // Show error message
      setMessage(t("profile_update_failed"));
      setOpen(true);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Render star rating display
   * 
   * @param stars - Number of stars (1-5)
   * @returns JSX element displaying filled/unfilled stars
   */
  const renderStars = (stars: number) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            sx={{
              fontSize: 18,
              // Fill stars up to the rating value, leave others gray
              color: star <= stars ? '#ffc107' : '#ddd'
            }}
          />
        ))}
      </Box>
    );
  };

  const calculatedAge = birthdate ? calculateAge(birthdate) : 0;
  const roleLabel = userRole === "interpreter" ? t("role_interpreter") : t("role_deaf_mute");

  return (
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mb: { xs: 3, md: 4 },
            textAlign: "center",
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "#333",
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
              mb: 1,
              direction: direction,
              textAlign: "center",
            }}
          >
            {t("my_profile")}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#666",
              fontSize: { xs: "0.875rem", md: "1rem" },
              direction: direction,
              textAlign: "center",
            }}
          >
            {t("profile")}
          </Typography>
        </Box>

        {/* Two Column Layout */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: isRTL ? "row-reverse" : "row" },
            gap: 3,
          }}
        >
          {/* Left Column - Personal Information & Account Settings */}
          <Box sx={{ flex: { xs: "1", md: userRole === "interpreter" ? "1" : "1" }, minWidth: 0 }}>
            <Stack spacing={3}>
              {/* Personal Information Section */}
              <Card
                sx={{
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  bgcolor: "white",
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: "#333",
                      mb: 3,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      direction: direction,
                    }}
                  >
                    {t("personal_information")}
                  </Typography>
                  <Stack spacing={3}>
                    {/* Role Badge */}
                    <Box>
                      <Chip
                        label={roleLabel}
                        sx={{
                          bgcolor: "#008080",
                          color: "white",
                          fontWeight: 600,
                          fontSize: { xs: "0.875rem", md: "0.95rem" },
                          px: 1,
                        }}
                      />
                    </Box>

                    {/* Full Name */}
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <PersonIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            fontSize: { xs: "0.875rem", md: "0.95rem" },
                            direction: direction,
                          }}
                        >
                          {t("full_name")}
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t("full_name")}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                          },
                        }}
                        dir={direction}
                      />
                    </Box>

                    {/* Email (Read-only) */}
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <EmailIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            fontSize: { xs: "0.875rem", md: "0.95rem" },
                            direction: direction,
                          }}
                        >
                          {t("email")}
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        value={user?.email || ""}
                        disabled
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                            bgcolor: "#f5f5f5",
                          },
                        }}
                        dir={direction}
                      />
                    </Box>

                    {/* Birthdate */}
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <CalendarTodayIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            fontSize: { xs: "0.875rem", md: "0.95rem" },
                            direction: direction,
                          }}
                        >
                          {t("birthdate")}
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        type="date"
                        value={birthdate}
                        onChange={(e) => setBirthdate(e.target.value)}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                          },
                        }}
                        dir={direction}
                      />
                      {/* Calculated Age Display */}
                      {calculatedAge > 0 && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#666",
                            mt: 1,
                            ml: isRTL ? 0 : 1.5,
                            mr: isRTL ? 1.5 : 0,
                            direction: direction,
                          }}
                        >
                          {t("calculated_age")}: {calculatedAge} {t("years")}
                        </Typography>
                      )}
                    </Box>

                    {/* Phone Number */}
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <PhoneIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            fontSize: { xs: "0.875rem", md: "0.95rem" },
                            direction: direction,
                          }}
                        >
                          {t("phone_number")}
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder={t("phone_number")}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                          },
                        }}
                        dir={direction}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Account Settings Section */}
              <Card
                sx={{
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  bgcolor: "white",
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: "#333",
                      mb: 3,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      direction: direction,
                    }}
                  >
                    {t("account_settings")}
                  </Typography>
                  <Stack spacing={3}>
                    {/* Language */}
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <LanguageIcon sx={{ color: "#008080", fontSize: "1.2rem" }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: "#333",
                            fontSize: { xs: "0.875rem", md: "0.95rem" },
                            direction: direction,
                          }}
                        >
                          {t("language")}
                        </Typography>
                      </Box>
                      <TextField
                        select
                        fullWidth
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                          },
                        }}
                        dir={direction}
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="ar">العربية</MenuItem>
                      </TextField>
                    </Box>

                    {/* Save Button */}
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={save}
                        disabled={saving}
                        size="large"
                        sx={{
                          borderRadius: "8px",
                          bgcolor: "#008080",
                          px: { xs: 4, md: 6 },
                          py: { xs: 1.25, md: 1.5 },
                          fontSize: { xs: "0.95rem", md: "1rem" },
                          fontWeight: 500,
                          textTransform: "none",
                          minWidth: { xs: "200px", md: "250px" },
                          "&:hover": {
                            bgcolor: "#006666",
                          },
                          "&:disabled": {
                            bgcolor: "#cccccc",
                          },
                        }}
                      >
                        {saving ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CircularProgress size={20} sx={{ color: "white" }} />
                            <Typography sx={{ direction: direction }}>{t("loading")}</Typography>
                          </Box>
                        ) : (
                          t("save_changes")
                        )}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Right Column - Statistics & Ratings (for interpreters only) */}
          {userRole === "interpreter" && (
            <Box sx={{ flex: "1", minWidth: 0 }}>
              <Stack spacing={3}>
                {/* Account Statistics */}
                <Card
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    bgcolor: "white",
                  }}
                >
                  <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#333",
                        mb: 3,
                        fontSize: { xs: "1.1rem", md: "1.25rem" },
                        direction: direction,
                      }}
                    >
                      {t("account_statistics")}
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                        gap: 2,
                      }}
                    >
                      {/* Total Sessions */}
                      <Card
                        sx={{
                          bgcolor: "rgba(0,128,128,0.05)",
                          borderRadius: "8px",
                          p: 2,
                          textAlign: "center",
                          border: "1px solid rgba(0,128,128,0.2)",
                        }}
                      >
                        <AssignmentIcon sx={{ color: "#008080", fontSize: "2rem", mb: 1 }} />
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 700,
                            color: "#008080",
                            mb: 0.5,
                            direction: direction,
                          }}
                        >
                          {totalSessions}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#666",
                            fontSize: { xs: "0.75rem", md: "0.875rem" },
                            direction: direction,
                          }}
                        >
                          {t("total_sessions_completed")}
                        </Typography>
                      </Card>

                      {/* Join Date */}
                      <Card
                        sx={{
                          bgcolor: "rgba(0,128,128,0.05)",
                          borderRadius: "8px",
                          p: 2,
                          textAlign: "center",
                          border: "1px solid rgba(0,128,128,0.2)",
                        }}
                      >
                        <EventIcon sx={{ color: "#008080", fontSize: "2rem", mb: 1 }} />
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 600,
                            color: "#008080",
                            mb: 0.5,
                            fontSize: { xs: "0.875rem", md: "1rem" },
                            direction: direction,
                          }}
                        >
                          {joinDate ? joinDate.toLocaleDateString() : "-"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#666",
                            fontSize: { xs: "0.75rem", md: "0.875rem" },
                            direction: direction,
                          }}
                        >
                          {t("join_date")}
                        </Typography>
                      </Card>
                    </Box>
                  </CardContent>
                </Card>

                {/* Ratings Section */}
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: "#333",
                      mb: 2,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      direction: direction,
                    }}
                  >
                    {t("your_ratings")}
                  </Typography>
            
                  {averageRating > 0 ? (
                    <Card
                      sx={{
                        borderRadius: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        bgcolor: "white",
                        mb: 2,
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, md: 3 }, textAlign: "center" }}>
                        <Typography
                          variant="h6"
                          sx={{
                            mb: 2,
                            direction: direction,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 1,
                            flexDirection: isRTL ? "row-reverse" : "row",
                          }}
                        >
                          {t("average_rating")}: {renderStars(Math.round(averageRating))} {averageRating}/5
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "#666",
                            direction: direction,
                          }}
                        >
                          {t("based_on_ratings").replace("{count}", ratings.length.toString())}
                        </Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card
                      sx={{
                        borderRadius: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        bgcolor: "white",
                        mb: 2,
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, md: 3 }, textAlign: "center" }}>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "#666",
                            direction: direction,
                          }}
                        >
                          {t("no_ratings_yet")}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  {ratings.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          color: "#333",
                          mb: 2,
                          fontSize: { xs: "0.95rem", md: "1rem" },
                          direction: direction,
                        }}
                      >
                        {t("recent_reviews").replace("{count}", ratings.length.toString())}
                      </Typography>
                      <Stack spacing={2}>
                        {ratings.map((rating, index) => (
                          <Card
                            key={index}
                            sx={{
                              borderRadius: "12px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              bgcolor: "white",
                            }}
                          >
                            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  mb: 1,
                                  flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                              >
                                {renderStars(rating.stars)}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: "#666",
                                    direction: direction,
                                  }}
                                >
                                  {rating.created_at?.toDate ? new Date(rating.created_at.toDate()).toLocaleDateString() : t("recently")}
                                </Typography>
                              </Box>
                              {rating.feedback && rating.feedback.trim() && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    mt: 1,
                                    fontStyle: "italic",
                                    color: "#333",
                                    direction: direction,
                                  }}
                                >
                                  "{rating.feedback}"
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Stack>
            </Box>
          )}
        </Box>
      
        <Snackbar
          open={open}
          autoHideDuration={4000}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={message.includes("successfully") ? "success" : "error"}
            onClose={() => setOpen(false)}
            sx={{ direction: direction }}
          >
            {message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default Profile;