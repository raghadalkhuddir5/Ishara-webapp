import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import { submitRating } from '../services/ratingService';
import { useAuth } from '../context/AuthContext';

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
  onSubmitSuccess
}) => {
  const { user } = useAuth();
  const [selectedStars, setSelectedStars] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleStarClick = (starCount: number) => {
    setSelectedStars(starCount);
    setError(''); // Clear any previous errors
  };

  const handleFeedbackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.length <= 500) {
      setFeedback(value);
    }
  };

  const getStarLabel = (stars: number): string => {
    switch (stars) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return '';
    }
  };

  const handleSubmit = async () => {
    if (selectedStars === 0) {
      setError('Please select a star rating');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      await submitRating({
        sessionId,
        userId: user.uid,
        interpreterId,
        stars: selectedStars,
        feedback: feedback.trim()
      });

      console.log('Rating submitted successfully');
      onSubmitSuccess();
    } catch (err: any) {
      console.error('Failed to submit rating:', err);
      setError(err.message || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSelectedStars(0);
    setFeedback('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    if (!isSubmitting) {
      handleSkip();
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={isSubmitting}
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          Rate Your Session
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          How was your experience with {interpreterName}?
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Star Rating */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Rate your experience:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconButton
                  key={star}
                  onClick={() => handleStarClick(star)}
                  disabled={isSubmitting}
                  sx={{ 
                    p: 0.5,
                    '&:hover': { backgroundColor: 'transparent' }
                  }}
                >
                  {star <= selectedStars ? (
                    <Star sx={{ fontSize: 32, color: '#ffc107' }} />
                  ) : (
                    <StarBorder sx={{ fontSize: 32, color: '#ddd' }} />
                  )}
                </IconButton>
              ))}
            </Box>
            {selectedStars > 0 && (
              <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                {getStarLabel(selectedStars)}
              </Typography>
            )}
          </Box>

          {/* Feedback Text Area */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Additional Comments (Optional)
            </Typography>
            <TextField
              multiline
              rows={3}
              fullWidth
              placeholder="Tell us more about your experience..."
              value={feedback}
              onChange={handleFeedbackChange}
              disabled={isSubmitting}
              inputProps={{ maxLength: 500 }}
              helperText={`${feedback.length}/500 characters`}
            />
          </Box>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button
          onClick={handleSkip}
          disabled={isSubmitting}
          color="secondary"
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={selectedStars === 0 || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatingModal;
