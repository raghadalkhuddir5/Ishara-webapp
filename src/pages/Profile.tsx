import { useEffect, useState } from "react";
import { Box, Button, MenuItem, TextField, Typography, Snackbar, Alert, Paper, Stack } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useI18n } from "../context/I18nContext";
import { getRatingsForInterpreter } from "../services/ratingService";
import type { RatingData } from "../services/ratingService";
import { Star } from "@mui/icons-material";

interface UserData {
  full_name?: string;
  age?: number;
  phone_number?: string;
  language?: string;
  role?: string;
}

function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [ratings, setRatings] = useState<RatingData[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const { t, setLocale } = useI18n();

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data() as UserData;
        setFullName(d.full_name ?? "");
        setAge(d.age?.toString() ?? "");
        setPhoneNumber(d.phone_number ?? "");
        setLanguage(d.language ?? "en");
        setUserRole(d.role ?? "");
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    const loadRatings = async () => {
      if (!user || userRole !== "interpreter") return;
      
      try {
        const interpreterRatings = await getRatingsForInterpreter(user.uid, 10);
        setRatings(interpreterRatings);
        
        // Calculate average rating
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
    
    if (userRole) {
      loadRatings();
    }
  }, [user, userRole]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        full_name: fullName,
        age: parseInt(age) || 0,
        phone_number: phoneNumber,
        language,
        updated_at: new Date(),
      });
      await setLocale(language as "en" | "ar");
      setMessage("Profile updated successfully!");
      setOpen(true);
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage("Failed to update profile. Please try again.");
      setOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (stars: number) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            sx={{
              fontSize: 18,
              color: star <= stars ? '#ffc107' : '#ddd'
            }}
          />
        ))}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t("my_profile")}</Typography>
      
      <Box sx={{ maxWidth: 520, mb: 4 }}>
        <TextField label="Full Name" fullWidth margin="normal" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Age" type="number" fullWidth margin="normal" value={age} onChange={(e) => setAge(e.target.value)} />
        <TextField label="Phone Number" fullWidth margin="normal" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        <TextField select label={t("language")} fullWidth margin="normal" value={language} onChange={(e) => setLanguage(e.target.value)}>
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="ar">العربية</MenuItem>
        </TextField>
        <Button variant="contained" sx={{ mt: 2 }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : t("save")}
        </Button>
      </Box>

      {userRole === "interpreter" && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>Your Ratings</Typography>
          
          {averageRating > 0 ? (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Average Rating: {renderStars(Math.round(averageRating))} {averageRating}/5
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="body1" color="text.secondary">
                No ratings yet
              </Typography>
            </Paper>
          )}

          {ratings.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Recent Reviews ({ratings.length})
              </Typography>
              <Stack spacing={2}>
                {ratings.map((rating, index) => (
                  <Paper key={index} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {renderStars(rating.stars)}
                      <Typography variant="body2" color="text.secondary">
                        {rating.created_at?.toDate ? new Date(rating.created_at.toDate()).toLocaleDateString() : 'Recently'}
                      </Typography>
                    </Box>
                    {rating.feedback && rating.feedback.trim() && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        "{rating.feedback}"
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}
      
      <Snackbar 
        open={open} 
        autoHideDuration={4000} 
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert 
          severity={message.includes("successfully") ? "success" : "error"} 
          onClose={() => setOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Profile;