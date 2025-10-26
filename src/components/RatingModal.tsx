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
} from "@mui/material";
import { submitRating } from "../services/ratingService";
import type { RatingSubmission } from "../services/ratingService";
import { useAuth } from "../context/AuthContext";

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
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please provide a rating");
      return;
    }

    if (!user) {
      setError("User not authenticated");
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
        setError(err.message || "Failed to submit rating. Please try again.");
      } else {
        setError("Failed to submit rating. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rate Your Session</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            How was your session with {interpreterName}?
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Rating
              value={rating}
              onChange={(_, newValue) => setRating(newValue)}
              size="large"
              precision={0.5}
            />
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Additional Feedback (Optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            variant="outlined"
            sx={{ mt: 2 }}
          />
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={isSubmitting || !rating}
          sx={{ ml: 1 }}
        >
          {isSubmitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatingModal;