import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  IconButton,
  Badge,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { 
  getUserNotifications, 
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getUnreadNotificationCount,
  deleteNotification
} from '../services/notificationService';
import type { NotificationData } from '../types/services';
import { useI18n } from '../context/I18nContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface NotificationCenterProps {
  maxNotifications?: number;
  showMarkAllRead?: boolean;
  compact?: boolean; // For use in Popover
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  maxNotifications = 50, 
  showMarkAllRead = true,
  compact = false
}) => {
  const { user } = useAuth();
  const { t, direction } = useI18n();
  const navigate = useNavigate();
  const isRTL = direction === 'rtl';
  
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [userRole, setUserRole] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [notifs, unread] = await Promise.all([
        getUserNotifications(user.uid, maxNotifications),
        getUnreadNotificationCount(user.uid)
      ]);
      
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
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Load user role
  useEffect(() => {
    const loadRole = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setUserRole((snap.data() as { role?: string }).role || null);
        }
      } catch (err) {
        console.error('Error loading user role:', err);
      }
    };
    loadRole();
  }, [user]);

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

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.notification_id === notificationId
            ? { ...notif, is_read: true, read_at: Timestamp.now() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      // Find notification before deleting to check if it was unread
      const notificationToDelete = notifications.find(n => n.notification_id === notificationId);
      const wasUnread = notificationToDelete && !notificationToDelete.is_read;
      
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif.notification_id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.is_read && notification.notification_id) {
      handleMarkAsRead(notification.notification_id);
    }

    if (notification.data?.session_id) {
      const sessionId = notification.data.session_id as string;
      if (notification.type === 'session_request' || notification.type === 'session_confirmed') {
        navigate(`/call/${sessionId}`);
      } else if (notification.type === 'session_cancelled') {
        // Navigate based on user role
        if (userRole === 'deaf_mute') {
          navigate('/sessions');
        } else if (userRole === 'interpreter') {
          navigate('/interpreter/sessions');
        }
      }
    }
  };


  const getTranslatedTitle = (notification: NotificationData): string => {
    // Translate based on notification type
    switch (notification.type) {
      case 'session_request':
        return t('notification_session_request_title') || notification.title;
      case 'session_confirmed':
        return t('notification_session_confirmed_title') || notification.title;
      case 'session_cancelled':
        return t('notification_session_cancelled_title') || notification.title;
      case 'session_reminder':
        return t('notification_session_reminder_title') || notification.title;
      case 'rating_received':
        return t('notification_rating_received_title') || notification.title;
      case 'system_update':
        return t('notification_system_update_title') || notification.title;
      default:
        return notification.title;
    }
  };

  const getTranslatedMessage = (notification: NotificationData): string => {
    // For now, return the message as is since it may contain dynamic content
    // In the future, we could parse and translate parts of the message
    return notification.message;
  };

  const getNotificationIcon = (type: NotificationData['type']) => {
    const iconProps = { sx: { fontSize: '1.5rem', color: '#008080' } };
    
    switch (type) {
      case 'session_request':
        return <NotificationsActiveIcon {...iconProps} />;
      case 'session_confirmed':
        return <CheckCircleIcon {...iconProps} />;
      case 'session_cancelled':
        return <CancelIcon {...iconProps} />;
      case 'session_reminder':
        return <ScheduleIcon {...iconProps} />;
      case 'rating_received':
        return <StarIcon {...iconProps} />;
      case 'system_update':
        return <InfoIcon {...iconProps} />;
      default:
        return <NotificationsIcon {...iconProps} />;
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
    return date.toLocaleDateString("en-US", { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    }

    return filtered.sort((a, b) => {
      const dateA = typeof a.created_at === 'object' && 'toDate' in a.created_at
        ? a.created_at.toDate().getTime()
        : new Date(a.created_at).getTime();
      const dateB = typeof b.created_at === 'object' && 'toDate' in b.created_at
        ? b.created_at.toDate().getTime()
        : new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [notifications, filter]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" sx={{ mb: 2, direction: direction }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={loadNotifications} sx={{ textTransform: 'none' }}>
            {t("retry")}
          </Button>
        </Box>
      </Container>
    );
  }

  // Compact mode for Popover
  if (compact) {
    return (
      <Box sx={{ width: { xs: 320, sm: 400 }, maxHeight: 500, overflow: 'auto' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, direction: direction }}>
            {t("notifications")}
          </Typography>
          {showMarkAllRead && unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllAsRead}
              sx={{ textTransform: 'none', fontSize: '0.875rem' }}
            >
              {t("mark_all_read")}
            </Button>
          )}
        </Box>
        <Box sx={{ p: 1 }}>
          <Tabs
            value={filter}
            onChange={(_e, newValue) => setFilter(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              mb: 1,
              '& .MuiTab-root': {
                textTransform: 'none',
                minWidth: 60,
                fontSize: '0.875rem',
              },
            }}
          >
            <Tab label={t("all") || "All"} value="all" />
            <Tab 
              label={
                <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}>
                  {t("unread") || "Unread"}
                </Badge>
              } 
              value="unread" 
            />
          </Tabs>
        </Box>
        {filteredNotifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ direction: direction }}>
              {t("no_notifications_yet")}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1} sx={{ p: 1 }}>
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.notification_id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  borderRadius: '8px',
                  boxShadow: notification.is_read ? '0 1px 4px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,128,128,0.2)',
                  cursor: 'pointer',
                  border: notification.is_read ? 'none' : '1px solid #008080',
                  bgcolor: notification.is_read ? 'white' : 'rgba(0,128,128,0.02)',
                  '&:hover': { bgcolor: 'rgba(0,128,128,0.05)' },
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: notification.is_read ? 400 : 600,
                            fontSize: '0.875rem',
                            direction: direction,
                          }}
                        >
                          {getTranslatedTitle(notification)}
                        </Typography>
                        {!notification.is_read && (
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#008080' }} />
                        )}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#666',
                          fontSize: '0.75rem',
                          display: 'block',
                          direction: direction,
                        }}
                      >
                        {getTranslatedMessage(notification)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#999',
                          fontSize: '0.7rem',
                          direction: direction,
                        }}
                      >
                        {formatNotificationTime(notification.created_at)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notification.notification_id) {
                          handleDeleteNotification(notification.notification_id);
                        }
                      }}
                      sx={{ color: '#d32f2f', p: 0.5 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    );
  }

  // Full page mode
  return (
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: { xs: 3, md: 4 },
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon sx={{ fontSize: { xs: '2rem', md: '2.5rem' }, color: '#008080' }} />
            </Badge>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#333',
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                direction: direction,
              }}
            >
              {t("notifications")}
            </Typography>
          </Box>
          {showMarkAllRead && unreadCount > 0 && (
            <Button
              variant="outlined"
              onClick={handleMarkAllAsRead}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                borderColor: '#008080',
                color: '#008080',
                '&:hover': {
                  borderColor: '#006666',
                  bgcolor: 'rgba(0,128,128,0.05)',
                },
              }}
            >
              {t("mark_all_read")}
            </Button>
          )}
        </Box>

        {/* Filter Tabs */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={filter}
            onChange={(_e, newValue) => setFilter(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                minWidth: { xs: 80, md: 120 },
                fontSize: { xs: '0.875rem', md: '1rem' },
              },
            }}
          >
            <Tab label={t("all") || "All"} value="all" />
            <Tab 
              label={
                <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}>
                  {t("unread") || "Unread"}
                </Badge>
              } 
              value="unread" 
            />
          </Tabs>
        </Box>

        {/* No Notifications */}
        {filteredNotifications.length === 0 ? (
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textAlign: 'center',
              p: { xs: 4, md: 6 },
            }}
          >
            <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ direction: direction }}>
              {t("no_notifications_yet")}
            </Typography>
          </Card>
        ) : (
          /* Notifications List */
          <Stack spacing={2}>
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.notification_id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  borderRadius: '12px',
                  boxShadow: notification.is_read ? '0 2px 8px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,128,128,0.2)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  border: notification.is_read ? 'none' : '2px solid #008080',
                  bgcolor: notification.is_read ? 'white' : 'rgba(0,128,128,0.02)',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(0,128,128,0.3)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{ flexDirection: isRTL ? { xs: 'column', sm: 'row-reverse' } : { xs: 'column', sm: 'row' } }}
                  >
                    <Box
                      sx={{
                        width: { xs: '40px', md: '48px' },
                        height: { xs: '40px', md: '48px' },
                        borderRadius: '50%',
                        bgcolor: 'rgba(0,128,128,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mb: 0.5, flexDirection: isRTL ? 'row-reverse' : 'row' }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: notification.is_read ? 500 : 700,
                            color: '#333',
                            fontSize: { xs: '0.95rem', md: '1rem' },
                            direction: direction,
                          }}
                        >
                          {getTranslatedTitle(notification)}
                        </Typography>
                        {!notification.is_read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: '#008080',
                            }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#666',
                          mb: 1,
                          fontSize: { xs: '0.875rem', md: '0.95rem' },
                          direction: direction,
                        }}
                      >
                        {getTranslatedMessage(notification)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#999',
                          fontSize: { xs: '0.75rem', md: '0.875rem' },
                          direction: direction,
                        }}
                      >
                        {formatNotificationTime(notification.created_at)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notification.notification_id) {
                          handleDeleteNotification(notification.notification_id);
                        }
                      }}
                      sx={{
                        color: '#d32f2f',
                        '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.1)' },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default NotificationCenter;
