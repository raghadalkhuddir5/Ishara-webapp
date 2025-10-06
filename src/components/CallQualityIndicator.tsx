import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Collapse
} from '@mui/material';
import {
  Videocam as VideoIcon,
  Mic as MicIcon,
  NetworkCheck as NetworkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { updateCallQuality, updateTechnicalMetrics } from '../services/callService';

interface CallQualityIndicatorProps {
  callId: string;
  showDetails?: boolean;
  onQualityUpdate?: (quality: any) => void;
}

interface CallMetrics {
  video_quality: 'poor' | 'fair' | 'good' | 'excellent';
  audio_quality: 'poor' | 'fair' | 'good' | 'excellent';
  connection_stability: 'poor' | 'fair' | 'good' | 'excellent';
  technical_metrics?: {
    avg_bitrate: number;
    packet_loss: number;
    jitter: number;
    latency: number;
  };
}

const CallQualityIndicator: React.FC<CallQualityIndicatorProps> = ({
  callId,
  showDetails = false,
  onQualityUpdate
}) => {
  const [quality, setQuality] = useState<CallMetrics>({
    video_quality: 'good',
    audio_quality: 'good',
    connection_stability: 'good'
  });
  const [expanded, setExpanded] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getQualityValue = (quality: string) => {
    switch (quality) {
      case 'excellent': return 100;
      case 'good': return 75;
      case 'fair': return 50;
      case 'poor': return 25;
      default: return 0;
    }
  };

  const simulateQualityMetrics = () => {
    // Simulate quality metrics - in real implementation, this would come from Agora SDK
    const qualities: Array<'poor' | 'fair' | 'good' | 'excellent'> = ['poor', 'fair', 'good', 'excellent'];
    const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
    
    const newQuality: CallMetrics = {
      video_quality: randomQuality,
      audio_quality: randomQuality,
      connection_stability: randomQuality,
      technical_metrics: {
        avg_bitrate: Math.floor(Math.random() * 2000) + 500, // 500-2500 kbps
        packet_loss: Math.random() * 2, // 0-2%
        jitter: Math.floor(Math.random() * 50) + 10, // 10-60ms
        latency: Math.floor(Math.random() * 200) + 50 // 50-250ms
      }
    };

    setQuality(newQuality);
    
    if (onQualityUpdate) {
      onQualityUpdate(newQuality);
    }
  };

  const updateQualityInDatabase = async (newQuality: CallMetrics) => {
    try {
      await updateCallQuality(callId, {
        video_quality: newQuality.video_quality,
        audio_quality: newQuality.audio_quality,
        connection_stability: newQuality.connection_stability
      });

      if (newQuality.technical_metrics) {
        await updateTechnicalMetrics(callId, newQuality.technical_metrics);
      }
    } catch (error) {
      console.error('Error updating call quality:', error);
    }
  };

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        simulateQualityMetrics();
      }, 10000); // Update every 10 seconds

      return () => clearInterval(interval);
    }
  }, [isMonitoring]);

  useEffect(() => {
    if (quality && callId) {
      updateQualityInDatabase(quality);
    }
  }, [quality, callId]);

  const startMonitoring = () => {
    setIsMonitoring(true);
    simulateQualityMetrics(); // Initial reading
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Call Quality
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}>
            <IconButton
              size="small"
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              color={isMonitoring ? 'error' : 'primary'}
            >
              <NetworkIcon />
            </IconButton>
          </Tooltip>
          {showDetails && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <VideoIcon color="primary" />
            <Typography variant="subtitle2">Video</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={getQualityValue(quality.video_quality)}
            color={getQualityColor(quality.video_quality) as any}
            sx={{ mb: 1 }}
          />
          <Chip
            label={quality.video_quality}
            size="small"
            color={getQualityColor(quality.video_quality) as any}
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <MicIcon color="primary" />
            <Typography variant="subtitle2">Audio</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={getQualityValue(quality.audio_quality)}
            color={getQualityColor(quality.audio_quality) as any}
            sx={{ mb: 1 }}
          />
          <Chip
            label={quality.audio_quality}
            size="small"
            color={getQualityColor(quality.audio_quality) as any}
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <NetworkIcon color="primary" />
            <Typography variant="subtitle2">Connection</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={getQualityValue(quality.connection_stability)}
            color={getQualityColor(quality.connection_stability) as any}
            sx={{ mb: 1 }}
          />
          <Chip
            label={quality.connection_stability}
            size="small"
            color={getQualityColor(quality.connection_stability) as any}
            variant="outlined"
          />
        </Grid>
      </Grid>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Technical Metrics
          </Typography>
          {quality.technical_metrics && (
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Bitrate
                </Typography>
                <Typography variant="body2">
                  {quality.technical_metrics.avg_bitrate} kbps
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Packet Loss
                </Typography>
                <Typography variant="body2">
                  {quality.technical_metrics.packet_loss.toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Jitter
                </Typography>
                <Typography variant="body2">
                  {quality.technical_metrics.jitter} ms
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Latency
                </Typography>
                <Typography variant="body2">
                  {quality.technical_metrics.latency} ms
                </Typography>
              </Grid>
            </Grid>
          )}
        </Box>
      </Collapse>

      {isMonitoring && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Monitoring call quality... Updates every 10 seconds
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CallQualityIndicator;
