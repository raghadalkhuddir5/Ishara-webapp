import React, { useState } from 'react';
import {
  Box,
  Typography,
  Rating,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { createRating, hasUserRatedSession } from '../services/ratingService';
import type { RatingData } from '../types/services';

interface RatingFormProps {
  sessionId: string;
  interpreterId: string;
  interpreterName?: string;
  onRatingSubmitted?: (ratingId: string) => void;
  onCancel?: () => void;
  open?: boolean;
}

const RatingForm: React.FC<RatingFormProps> = ({
  sessionId,
  interpreterId,
  interpreterName = 'Interpreter',
  onRatingSubmitted,
  onCancel,
  open = true
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [categories, setCategories] = useState({
    communication: 5,
    professionalism: 5,
    punctuality: 5,
    technical_quality: 5
  });

  React.useEffect(() => {
    const checkIfRated = async () => {
      if (!user) return;
      try {
        const rated = await hasUserRatedSession(sessionId, user.uid);
        setHasRated(rated);
      } catch (err) {
        console.error('Error checking if user has rated:', err);
      }
    };
    checkIfRated();
  }, [sessionId, user]);

  const handleCategoryChange = (category: keyof typeof categories, value: number) => {
    setCategories(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (rating < 1 || rating > 5) {
      setError('Please provide a rating between 1 and 5');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ratingData: Omit<RatingData, 'rating_id' | 'created_at' | 'updated_at'> = {
        session_id: sessionId,
        rater_id: user.uid,
        rated_id: interpreterId,
        rater_role: 'deaf_mute',
        rated_role: 'interpreter',
        rating,
        comment: comment.trim() || undefined,
        categories,
        is_anonymous: isAnonymous
      };

      const ratingId = await createRating(ratingData);
      setSuccess(true);
      setHasRated(true);
      
      if (onRatingSubmitted) {
        onRatingSubmitted(ratingId);
      }
    } catch (err: unknown) {
      console.error('Error creating rating:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit rating';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (hasRated) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Rating Submitted</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <StarIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Thank you for your feedback!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your rating has been submitted successfully.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Rate Your Session with {interpreterName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Rating submitted successfully!
            </Alert>
          )}

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Overall Rating
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue || 0)}
                size="large"
                icon={<StarIcon fontSize="inherit" />}
              />
              <Typography variant="body1">
                {rating} star{rating !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Category Ratings
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Communication
                  </Typography>
                  <Rating
                    value={categories.communication}
                    onChange={(_, newValue) => handleCategoryChange('communication', newValue || 0)}
                    size="medium"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Professionalism
                  </Typography>
                  <Rating
                    value={categories.professionalism}
                    onChange={(_, newValue) => handleCategoryChange('professionalism', newValue || 0)}
                    size="medium"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Punctuality
                  </Typography>
                  <Rating
                    value={categories.punctuality}
                    onChange={(_, newValue) => handleCategoryChange('punctuality', newValue || 0)}
                    size="medium"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Technical Quality
                  </Typography>
                  <Rating
                    value={categories.technical_quality}
                    onChange={(_, newValue) => handleCategoryChange('technical_quality', newValue || 0)}
                    size="medium"
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Additional Comments
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this interpreter..."
              variant="outlined"
            />
          </Paper>

          <Paper sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
              }
              label="Submit rating anonymously"
            />
            <Typography variant="caption" display="block" color="text.secondary">
              Your name will not be shown to the interpreter
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || rating === 0}
          startIcon={loading ? <CircularProgress size={20} /> : <StarIcon />}
        >
          {loading ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatingForm;
