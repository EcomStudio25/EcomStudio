'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { showAdminToast } from './AdminToast';

interface NotificationsProps {
  supabase: SupabaseClient;
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
}

export default function Notifications({ supabase }: NotificationsProps) {
  const [notificationText, setNotificationText] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const MAX_CHARS = 150;

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);

      // Get all unique notifications (get one per message content)
      const { data, error } = await supabase
        .from('notifications')
        .select('id, message, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by message to show unique notifications
      const uniqueNotifications = data?.reduce((acc: Notification[], curr) => {
        if (!acc.find((n) => n.message === curr.message &&
            Math.abs(new Date(n.created_at).getTime() - new Date(curr.created_at).getTime()) < 60000)) {
          acc.push(curr);
        }
        return acc;
      }, []) || [];

      setNotifications(uniqueNotifications.slice(0, 20)); // Show last 20 unique notifications
      setLoading(false);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!notificationText.trim() || sending) return;

    if (notificationText.length > MAX_CHARS) {
      showAdminToast(`Message is too long. Maximum ${MAX_CHARS} characters allowed.`, 'error');
      return;
    }

    if (!confirm('This will send notification to ALL users. Are you sure?')) {
      return;
    }

    try {
      setSending(true);

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id');

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        showAdminToast('No users found', 'error');
        setSending(false);
        return;
      }

      // Create notification records for all users
      const notificationRecords = users.map((user) => ({
        user_id: user.id,
        message: notificationText.trim(),
        is_read: false
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationRecords);

      if (insertError) throw insertError;

      showAdminToast(`Notification sent successfully to ${users.length} users!`, 'success');
      setNotificationText('');
      await loadNotifications();
      setSending(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      showAdminToast('Failed to send notification. Please try again.', 'error');
      setSending(false);
    }
  };

  const deleteNotification = async (notification: Notification) => {
    if (!confirm('Are you sure you want to delete this notification for all users?')) {
      return;
    }

    try {
      // Delete all notifications with the same message sent around the same time
      const timeWindow = new Date(notification.created_at);
      const timeWindowEnd = new Date(timeWindow.getTime() + 60000); // 1 minute window
      const timeWindowStart = new Date(timeWindow.getTime() - 60000);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('message', notification.message)
        .gte('created_at', timeWindowStart.toISOString())
        .lte('created_at', timeWindowEnd.toISOString());

      if (error) throw error;

      showAdminToast('Notification deleted successfully!', 'success');
      await loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      showAdminToast('Failed to delete notification. Please try again.', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <style jsx>{`
        .notifications-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        .notification-new {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 30px;
        }

        .notification-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
          color: #ffffff;
        }

        .char-limit {
          font-size: 12px;
          color: #a8a8a8;
          margin-bottom: 15px;
        }

        .char-count {
          color: ${notificationText.length > MAX_CHARS ? '#ef4444' : '#4ade80'};
        }

        .notification-textarea {
          width: 100%;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 15px;
          color: #ffffff;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          height: 180px;
          margin-bottom: 15px;
        }

        .notification-textarea:focus {
          outline: none;
          border-color: #0066ff;
        }

        .notification-textarea::placeholder {
          color: #666;
        }

        .send-btn {
          width: 100%;
          background-color: #0066ff;
          border: none;
          border-radius: 8px;
          padding: 15px;
          color: #ffffff;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
          letter-spacing: 1px;
        }

        .send-btn:hover {
          background-color: #0052cc;
        }

        .send-btn:disabled {
          background-color: #444;
          cursor: not-allowed;
        }

        .notification-previous {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 30px;
        }

        .notification-list {
          max-height: 400px;
          overflow-y: auto;
          padding-right: 10px;
        }

        .notification-list::-webkit-scrollbar {
          width: 8px;
        }

        .notification-list::-webkit-scrollbar-track {
          background: #1f1f22;
          border-radius: 4px;
        }

        .notification-list::-webkit-scrollbar-thumb {
          background: #3a3a3e;
          border-radius: 4px;
        }

        .notification-list::-webkit-scrollbar-thumb:hover {
          background: #4a4a4e;
        }

        .notification-item {
          background-color: #1f1f22;
          border: 1px solid #3a3a3e;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .notification-content {
          flex: 1;
        }

        .notification-date {
          font-size: 12px;
          color: #a8a8a8;
          margin-bottom: 8px;
        }

        .notification-text {
          font-size: 14px;
          line-height: 1.5;
          color: #d1d1d1;
        }

        .delete-btn {
          background-color: transparent;
          border: none;
          color: #a8a8a8;
          font-size: 20px;
          cursor: pointer;
          transition: color 0.3s;
          padding: 5px;
        }

        .delete-btn:hover {
          color: #ef4444;
        }

        .no-notifications {
          text-align: center;
          color: #a8a8a8;
          padding: 40px 20px;
        }

        @media (max-width: 768px) {
          .notifications-container {
            grid-template-columns: 1fr;
          }

          .notification-new,
          .notification-previous {
            padding: 20px;
          }
        }
      `}</style>

      <div className="notifications-container">
        {/* New Notification */}
        <div className="notification-new">
          <h3 className="notification-title">NEW NOTIFICATION</h3>
          <div className="char-limit">
            (MAX. {MAX_CHARS} CHARACTER) - <span className="char-count">{notificationText.length}/{MAX_CHARS}</span>
          </div>
          <textarea
            className="notification-textarea"
            placeholder="Please write the message you want to send..."
            maxLength={MAX_CHARS}
            value={notificationText}
            onChange={(e) => setNotificationText(e.target.value)}
          />
          <button
            className="send-btn"
            onClick={sendNotification}
            disabled={sending || !notificationText.trim() || notificationText.length > MAX_CHARS}
          >
            {sending ? 'SENDING...' : 'SEND'}
          </button>
        </div>

        {/* Previous Notifications */}
        <div className="notification-previous">
          <h3 className="notification-title">PREVIOUS NOTIFICATIONS</h3>
          <div className="notification-list">
            {loading ? (
              <div className="no-notifications">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="no-notifications">No notifications sent yet</div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="notification-item">
                  <div className="notification-content">
                    <div className="notification-date">
                      Date / Time: {formatDate(notification.created_at)}
                    </div>
                    <div className="notification-text">{notification.message}</div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => deleteNotification(notification)}
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
