'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

interface ProfileData {
  full_name: string;
  company_name: string | null;
  phone_number: string | null;
}

export default function UserSettingsProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    company_name: '',
    phone_number: ''
  });
  const [email, setEmail] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUser(user);
      setEmail(user.email || '');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, company_name, phone_number')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfileData({
        full_name: profile?.full_name || '',
        company_name: profile?.company_name || '',
        phone_number: profile?.phone_number || ''
      });

      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'loadUserProfile');
      showToast(appError.userMessage, 'error');
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profileData.full_name.trim()) {
      showToast('Full name is required', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name.trim(),
          company_name: profileData.company_name?.trim() || null,
          phone_number: profileData.phone_number?.trim() || null
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      showToast('Profile updated successfully!', 'success');
      await loadUserProfile();
    } catch (error) {
      const appError = handleError(error, 'handleProfileSubmit');
      showToast(appError.userMessage, 'error');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword
      });

      if (signInError) {
        showToast('Current password is incorrect', 'error');
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showToast('Password updated successfully!', 'success');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      const appError = handleError(error, 'handlePasswordSubmit');
      showToast(appError.userMessage, 'error');
    }
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh',
          color: '#fff'
        }}>
          Loading...
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="settings-wrapper">
        <h1 className="page-title">USER SETTINGS</h1>

        {/* Tab Navigation */}
        <div className="tabs-container">
          <div className="tabs">
            <a onClick={() => router.push('/user-settings-profile')} className="tab active">
              PROFILE INFORMATION
            </a>
            <span className="tab-separator">|</span>
            <a onClick={() => router.push('/user-settings-credits')} className="tab">
              USAGE & CREDITS
            </a>
            <span className="tab-separator">|</span>
            <a onClick={() => router.push('/user-settings-billing')} className="tab">
              BILLING SETTINGS
            </a>
          </div>
        </div>

        {/* Profile Information Section */}
        <div className="content-section">
          <h2 className="section-title">PROFILE INFORMATION</h2>

          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Full Name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input 
                type="email" 
                className="form-input" 
                value={email}
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Name (Optional)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Company Name (Optional)"
                value={profileData.company_name || ''}
                onChange={(e) => setProfileData({...profileData, company_name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="tel" 
                className="form-input" 
                placeholder="+90 (5xx) xxx xx xx"
                value={profileData.phone_number || ''}
                onChange={(e) => setProfileData({...profileData, phone_number: e.target.value})}
              />
            </div>

            <button type="submit" className="btn-primary">UPDATE INFORMATION</button>
          </form>

          {/* Password Change Section */}
          <div className="password-section">
            <h2 className="section-title">CHANGE PASSWORD</h2>

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Current Password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Create Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Create New Password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Confirm New Password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                />
              </div>

              <button type="submit" className="btn-primary">UPDATE MY PASSWORD</button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-wrapper {
          max-width: 1100px;
          margin: 60px auto;
          padding: 0 20px;
        }

        .page-title {
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 40px;
          color: #ffffff;
        }

        .tabs-container {
          background: linear-gradient(to bottom, #313236 0%, #1f1f22 100%);
          border-radius: 12px;
          padding: 25px 40px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          margin-bottom: 40px;
        }

        .tabs {
          display: flex;
          justify-content: center;
          gap: 40px;
        }

        .tab {
          color: #999999;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          transition: color 0.3s;
          cursor: pointer;
          padding: 8px 0;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          color: #ffffff;
        }

        .tab.active {
          color: #ffffff;
          border-bottom: 2px solid #ffffff;
        }

        .tab-separator {
          color: #555555;
          font-size: 14px;
        }

        .content-section {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .section-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-bottom: 30px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .form-group {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: center;
          margin-bottom: 25px;
        }

        .form-label {
          font-size: 14px;
          color: #cccccc;
          font-weight: 500;
        }

        .form-input {
          background: #0a0a0a;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          color: #ffffff;
          font-family: inherit;
          transition: border-color 0.3s;
          max-width: 500px;
        }

        .form-input:focus {
          outline: none;
          border-color: #0066ec;
        }

        .form-input:read-only {
          background: #151515;
          color: #888888;
          cursor: not-allowed;
        }

        .form-input::placeholder {
          color: #666666;
        }

        .btn-primary {
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 14px 40px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0, 102, 236, 0.3);
          display: block;
          margin: 30px auto 0;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .btn-primary:active {
          transform: translateY(0);
        }

        .password-section {
          margin-top: 60px;
          padding-top: 40px;
          border-top: 1px solid #333333;
        }

        @media (max-width: 768px) {
          .settings-wrapper {
            margin: 40px auto;
          }

          .tabs {
            flex-direction: column;
            gap: 15px;
          }

          .tab-separator {
            display: none;
          }

          .content-section {
            padding: 30px 20px;
          }

          .form-group {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .form-label {
            font-weight: 600;
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}