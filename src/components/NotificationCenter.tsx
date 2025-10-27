import React, { useEffect, useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  IconButton,
  Button,
  Chip,
  Paper,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Info as InfoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { 
  getUserNotifications, 
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification
} from '../services/notificationService';
import type { NotificationData } from '../types/services';
import { useI18n } from '../context/I18nContext';

interface NotificationCenterProps {
  maxNotifications?: number;
  showMarkAllRead?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  maxNotifications = 10, 
  showMarkAllRead = true 
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [notifs, unread] = await Promise.all([
        getUserNotifications(user.uid, maxNotifications),
        getUnreadNotificationCount(user.uid)
      ]);
      
      console.log('🔔 NotificationCenter Debug:', {
        userId: user.uid,
        notificationsCount: notifs.length,
        unreadCount: unread,
        notifications: notifs.map(n => ({ id: n.notification_id, is_read: n.is_read, type: n.type }))
      });
      
      setNotifications(notifs);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(t("failed_to_load_notifications"));
    } finally {
      setLoading(false);
    }
  }, [user, maxNotifications, t]);

  useEffect(() => {
    loadNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    try {
      await markAllNotificationsAsRead(user.uid);
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true, read_at: Timestamp.now() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      // Remove from local state
      setNotifications(prev => prev.filter(notif => notif.notification_id !== notificationId));
      // Update unread count if it was unread
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationIcon = (type: NotificationData['type']) => {
    switch (type) {
      case 'session_request':
        return <NotificationsActiveIcon color="primary" />;
      case 'session_confirmed':
        return <CheckCircleIcon color="success" />;
      case 'session_cancelled':
        return <CancelIcon color="error" />;
      case 'session_reminder':
        return <ScheduleIcon color="warning" />;
      case 'rating_received':
        return <StarIcon color="secondary" />;
      case 'system_update':
        return <InfoIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getNotificationColor = (type: NotificationData['type']) => {
    switch (type) {
      case 'session_request':
        return 'primary';
      case 'session_confirmed':
        return 'success';
      case 'session_cancelled':
        return 'error';
      case 'session_reminder':
        return 'warning';
      case 'rating_received':
        return 'secondary';
      case 'system_update':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatNotificationTime = (timestamp: Date | { toDate: () => Date } | string | number) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'object' && 'toDate' in timestamp 
      ? timestamp.toDate() 
      : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("just_now");
    if (diffMins < 60) return t("minutes_ago").replace("{minutes}", diffMins.toString());
    if (diffHours < 24) return t("hours_ago").replace("{hours}", diffHours.toString());
    if (diffDays < 7) return t("days_ago").replace("{days}", diffDays.toString());
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button size="small" onClick={loadNotifications} sx={{ ml: 1 }}>
          {t("retry")}
        </Button>
      </Alert>
    );
  }

  return (
    <Paper sx={{ maxWidth: 400, maxHeight: 500, overflow: 'auto' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
            <Typography variant="h6" sx={{ ml: 1 }}>
              {t("notifications")}
            </Typography>
          </Box>
          {showMarkAllRead && unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              {t("mark_all_read")}
            </Button>
          )}
        </Box>
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t("no_notifications_yet")}
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {notifications.map((notification, index) => (
            <React.Fragment key={notification.notification_id}>
              <ListItem
                sx={{
                  backgroundColor: notification.is_read ? 'transparent' : 'action.hover',
                  '&:hover': { backgroundColor: 'action.selected' }
                }}
              >
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: notification.is_read ? 'normal' : 'bold' }}>
                        {notification.title}
                      </Typography>
                      <Chip
                        label={t(notification.type.replace('_', ' '))}
                        size="small"
                        color={getNotificationColor(notification.type)}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <span>
                      <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                        {formatNotificationTime(notification.created_at)}
                      </Typography>
                    </span>
                  }
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteNotification(notification.notification_id!)}
                  sx={{ ml: 1 }}
                  color="error"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </ListItem>
              {index < notifications.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default NotificationCenter;