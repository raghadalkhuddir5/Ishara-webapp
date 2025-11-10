import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Rating,
  Alert,
  Paper,
  CircularProgress,
} from "@mui/material";
import { Star } from "@mui/icons-material";
import { submitRating } from "../services/ratingService";
import type { RatingSubmission } from "../services/ratingService";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

interface RatingModalProps {
  isOpen: boolean;
  sessionId: string;
  interpreterId: string;
  interpreterName: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  sessionId,
  interpreterId,
  interpreterName,
  onClose,
  onSubmitSuccess,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!rating) {
      setError(t("please_provide_rating"));
      return;
    }

    if (!user) {
      setError(t("user_not_authenticated"));
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await submitRating({
        sessionId,
        userId: user.uid,
        interpreterId,
        stars: rating,
        feedback,
      } as RatingSubmission);

      onSubmitSuccess();
    } catch (err: unknown) {
      console.error("Failed to submit rating:", err);
      if (err instanceof Error) {
        setError(err.message || t("failed_to_submit_rating"));
      } else {
        setError(t("failed_to_submit_rating"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          bgcolor: 'white',
          color: '#333',
          fontWeight: 600,
          fontSize: '1.5rem',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          pb: 2
        }}
      >
        {t("rate_your_session")}
      </DialogTitle>
      <DialogContent sx={{ bgcolor: 'white', pt: 3 }}>
        <Box>
          <Typography 
            variant="h6" 
            gutterBottom 
            sx={{ 
              color: '#333', 
              textAlign: 'center',
              mb: 3,
              fontWeight: 500
            }}
          >
            {t("how_was_your_session").replace("{interpreterName}", interpreterName)}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <Rating
              value={rating}
              onChange={(_, newValue) => {
                setRating(newValue);
                setError("");
              }}
              size="large"
              precision={1}
              icon={<Star sx={{ fontSize: 48 }} />}
              emptyIcon={<Star sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.26)' }} />}
              sx={{
                '& .MuiRating-iconFilled': {
                  color: '#ffc107',
                  filter: 'drop-shadow(0 2px 4px rgba(255, 193, 7, 0.3))',
                },
                '& .MuiRating-iconHover': {
                  color: '#ffc107',
                  transform: 'scale(1.1)',
                  transition: 'transform 0.2s ease',
                },
                '& .MuiRating-icon': {
                  transition: 'all 0.2s ease',
                },
              }}
            />
          </Box>
          
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              borderRadius: 2,
              border: '1px solid rgba(0, 0, 0, 0.1)',
              mt: 3,
            }}
          >
            <TextField
              fullWidth
              multiline
              rows={4}
              label={t("additional_feedback")}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              variant="outlined"
              disabled={isSubmitting}
              sx={{
                mt: 0,
                '& .MuiOutlinedInput-root': {
                  color: '#333',
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.3)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#008080',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(0, 0, 0, 0.6)',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#008080',
                },
              }}
            />
          </Paper>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 2,
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                color: '#c62828',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                '& .MuiAlert-icon': {
                  color: '#f44336',
                }
              }}
            >
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions 
        sx={{ 
          bgcolor: 'white',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          p: 2,
          gap: 1
        }}
      >
        <Button 
          onClick={onClose} 
          disabled={isSubmitting}
          sx={{
            color: 'rgba(0, 0, 0, 0.6)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.05)',
            }
          }}
        >
          {t("cancel")}
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={isSubmitting || !rating}
          sx={{ 
            ml: 1,
            bgcolor: '#008080',
            color: 'white',
            fontWeight: 600,
            px: 3,
            py: 1,
            borderRadius: '8px',
            textTransform: 'none',
            fontSize: '1rem',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: '#006666',
              transform: 'scale(1.02)',
            },
            '&:disabled': {
              bgcolor: 'rgba(0, 128, 128, 0.3)',
              color: 'rgba(255, 255, 255, 0.5)',
            }
          }}
        >
          {isSubmitting ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: 'white' }} />
              {t("submitting")}
            </Box>
          ) : (
            t("submit_rating")
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatingModal;