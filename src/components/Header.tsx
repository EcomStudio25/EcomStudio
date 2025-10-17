'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';

interface HeaderProps {
  supabase: SupabaseClient;
  currentUser: User | null;
}

interface NotificationData {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  createdAt: Date;
}

export default function Header({ supabase, currentUser }: HeaderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [userName, setUserName] = useState<string>('Loading...');
  const [credits, setCredits] = useState<string | number>('Loading...');
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);
  const [hasUnreadNotification, setHasUnreadNotification] = useState<boolean>(false);
  const [unviewedVideoCount, setUnviewedVideoCount] = useState<number>(0);

  useEffect(() => {
    if (currentUser && supabase) {
      loadUserData();
      loadNotification();
      loadUnviewedVideoCount();
      const notificationInterval = setInterval(loadNotification, 30000);
      const videoCountInterval = setInterval(loadUnviewedVideoCount, 10000); // Check every 10 seconds
      return () => {
        clearInterval(notificationInterval);
        clearInterval(videoCountInterval);
      };
    }
  }, [currentUser, supabase]);

  const loadUserData = async (): Promise<void> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, credits')
        .eq('id', currentUser!.id)
        .single();

      if (error) throw error;

      if (profile) {
        setUserName(profile.full_name);
        setCredits(profile.credits || 0);
      }
    } catch (error) {
      const appError = handleError(error, 'loadUserData');
      showToast(appError.userMessage, 'error');
      setUserName('User');
      setCredits(0);
    }
  };

  const loadNotification = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        setNotificationData(null);
        setHasUnreadNotification(false);
        return;
      }

      const now = new Date();
      const createdAt = new Date(data.created_at);
      const readAt = data.read_at ? new Date(data.read_at) : null;

      if (data.is_read && readAt) {
        const hoursSinceRead = (now.getTime() - readAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceRead > 24) {
          setNotificationData(null);
          setHasUnreadNotification(false);
          return;
        }
      }

      setNotificationData({ ...data, createdAt });
      setHasUnreadNotification(!data.is_read);
    } catch (error) {
      const appError = handleError(error, 'loadNotification');
      console.error(appError.userMessage);
    }
  };

  const loadUnviewedVideoCount = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      const { count, error } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('file_type', 'video')
        .eq('folder', 'video-assets')
        .eq('is_viewed', false);

      if (error) throw error;

      setUnviewedVideoCount(count || 0);
    } catch (error) {
      console.error('Error loading unviewed video count:', error);
      setUnviewedVideoCount(0);
    }
  };

  const markNotificationAsRead = async (): Promise<void> => {
    if (!currentUser || !hasUnreadNotification) return;

    try {
      const { data: notification, error: fetchError } = await supabase
        .from('notifications')
        .select('id, is_read')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      if (notification) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        if (updateError) throw updateError;

        setHasUnreadNotification(false);
      }
    } catch (error) {
      const appError = handleError(error, 'markNotificationAsRead');
      console.error(appError.userMessage);
    }
  };

  const toggleNotificationDropdown = (): void => {
    const newState = !showNotificationDropdown;
    setShowNotificationDropdown(newState);
    if (newState && hasUnreadNotification) {
      markNotificationAsRead();
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleLogout = async (): Promise<void> => {
    if (confirm('Are you sure you want to logout?')) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        router.push('/login');
      } catch (error) {
        const appError = handleError(error, 'handleLogout');
        showToast(appError.userMessage, 'error');
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (!(e.target as HTMLElement).closest('.notification-icon')) {
        setShowNotificationDropdown(false);
      }
    };

    if (showNotificationDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showNotificationDropdown]);

  return (
    <>
      <style jsx>{`
        .header-top {
          background: #000000;
          height: 70px;
          padding: 0 50px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1f1f1f;
        }

        .logo img {
          height: 28px;
          width: auto;
          cursor: pointer;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 25px;
        }

        .welcome-text {
          font-size: 13px;
          color: #999;
        }

        .username {
          color: #fff;
          font-weight: 600;
        }

        .header-icons {
          display: flex;
          align-items: center;
          gap: 25px;
        }

        .icon-btn {
          width: 24px;
          height: 24px;
          cursor: pointer;
          opacity: 0.9;
          transition: opacity 0.3s;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          opacity: 1;
        }

        .icon-btn img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .icon-btn svg {
          width: 24px;
          height: 24px;
        }

        .logout-text {
          font-size: 13px;
          font-weight: 600;
          color: #999999;
          cursor: pointer;
          transition: color 0.3s;
          text-transform: toUpperCase;
          letter-spacing: 0.5px;
        }

        .logout-text:hover {
          color: #ffffff;
        }

        .notification-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #ff0000;
          border-radius: 50%;
          border: 2px solid #000;
          display: none;
        }

        .notification-badge.active {
          display: block;
        }

        .notification-dropdown {
          position: absolute;
          top: 55px;
          right: 0;
          width: 320px;
          background: #292a2e;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.3s ease;
          z-index: 10000;
        }

        .notification-dropdown.active {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .notification-header {
          padding: 16px 20px;
          border-bottom: 1px solid #3a3b3f;
        }

        .notification-header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 0.5px;
        }

        .notification-content {
          padding: 20px;
          max-height: 300px;
          overflow-y: auto;
        }

        .notification-item {
          color: #ffffff;
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
          word-wrap: break-word;
        }

        .notification-empty {
          color: #999999;
          font-size: 14px;
          text-align: center;
          padding: 40px 20px;
        }

        .notification-date {
          font-size: 11px;
          color: #999999;
          margin-top: 8px;
          display: block;
        }

        .divider {
          width: 1px;
          height: 40px;
          background: #333333;
        }

        .language-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background 0.3s;
        }

        .language-selector:hover {
          background: #1a1a1a;
        }

        .language-selector::before {
          content: '▼';
          font-size: 10px;
          color: #999;
        }

        .header-bottom {
          background: #333333;
          height: 50px;
          padding: 0 50px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #444444;
        }

        .nav-left {
          display: flex;
          gap: 40px;
        }

        .nav-link {
          color: #00c6ff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: color 0.3s;
          white-space: nowrap;
          cursor: pointer;
        }

        .nav-link:hover {
          color: #ffffff;
        }

        .nav-link.soon {
          color: #999999;
        }

        .nav-link.soon:hover {
          color: #999999;
        }

        .nav-link.soon::after {
          content: ' (soon)';
          font-size: 11px;
          color: #666666;
          text-transform: lowercase;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 30px;
        }

        .nav-menu {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .nav-menu-link {
          color: #ffc600;
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: color 0.3s;
          white-space: nowrap;
          cursor: pointer;
        }

        .nav-menu-link:hover {
          color: #ffffff;
        }

        .nav-menu-link.active {
          color: #ffc600;
          font-weight: 500;
        }

        .nav-menu-link.active:hover {
          color: #ffffff;
        }

        .nav-menu-separator {
          color: #555555;
          font-size: 12px;
        }

        .credits-display {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          background: #444444;
          border-radius: 6px;
          border: 1px solid #555555;
          cursor: pointer;
          transition: all 0.3s;
        }

        .credits-display:hover {
          background: #4a4a4a;
          border-color: #666666;
        }

        .credits-icon {
          font-size: 16px;
          color: #ffffff;
        }

        .credits-number {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }

        @media (max-width: 1200px) {
          .header-top,
          .header-bottom {
            padding: 0 30px;
          }
        }

        @media (max-width: 900px) {
          .nav-menu {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .header-top,
          .header-bottom {
            padding: 0 20px;
          }

          .welcome-text {
            display: none;
          }

          .nav-left {
            gap: 15px;
          }

          .nav-link {
            font-size: 11px;
          }

          .notification-dropdown {
            width: 280px;
            right: -10px;
          }
        }
      `}</style>

      <header className="header-top">
        <div className="logo">
          <img 
            src="/ECOM_STUDIO_LOGO.png" 
            alt="ECOM STUDIO" 
            onClick={() => router.push('/dashboard')}
          />
        </div>
        <div className="header-right">
          <div className="welcome-text">
            Welcome, <span className="username">{userName}</span>
          </div>
          <div className="header-icons">
            <div 
              className="icon-btn settings-icon" 
              title="Settings"
              onClick={() => router.push('/user-settings-profile')}
            >
              <img src="/settings_icon.png" alt="Settings" />
            </div>
            <div 
              className="icon-btn notification-icon" 
              title="Notifications"
              onClick={toggleNotificationDropdown}
            >
              <img src="/notification_icon.png" alt="Notifications" />
              <div className={`notification-badge ${hasUnreadNotification ? 'active' : ''}`}></div>
              
              <div className={`notification-dropdown ${showNotificationDropdown ? 'active' : ''}`}>
                <div className="notification-header">
                  <h3>Notifications</h3>
                </div>
                <div className="notification-content">
                  {!notificationData ? (
                    <div className="notification-empty">You don't have any new notifications.</div>
                  ) : (
                    <div className="notification-item">
                      {notificationData.message}
                      <span className="notification-date">{getTimeAgo(notificationData.createdAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div 
              className="logout-text" 
              title="Logout"
              onClick={handleLogout}
            >
              Logout
            </div>
          </div>
          <div className="divider"></div>
          <div className="language-selector" title="Change Language">TR</div>
        </div>
      </header>

      <nav className="header-bottom">
        <div className="nav-left">
          <a href="/create-video#" className="nav-link">CREATE VIDEO</a>
          <a href="/create-image" className="nav-link">CREATE IMAGE</a>
          <a href="#" className="nav-link soon">TRY-ON</a>
        </div>
        <div className="nav-right">
          <div className="nav-menu">
            <a onClick={() => router.push('/favorites')} className="nav-menu-link">FAVORITES</a>
            <span className="nav-menu-separator">|</span>
            <a onClick={() => router.push('/video-assets')} className="nav-menu-link active">
              VIDEO ASSETS{unviewedVideoCount > 0 && ` (${unviewedVideoCount})`}
            </a>
            <span className="nav-menu-separator">|</span>
            <a onClick={() => router.push('/image-assets')} className="nav-menu-link">IMAGE ASSETS</a>
            <span className="nav-menu-separator">|</span>
            <a onClick={() => router.push('/library')} className="nav-menu-link">LIBRARY</a>
          </div>
          <div 
            className="credits-display"
            onClick={() => router.push('/user-settings-credits')}
            title="Add Credits"
          >
            <span className="credits-icon">⊕</span>
            <span className="credits-number">{credits}</span>
          </div>
        </div>
      </nav>
    </>
  );
}