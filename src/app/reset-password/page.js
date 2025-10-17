'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [successFinal, setSuccessFinal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);

  // Load Turnstile script (only if NOT coming from email link)
  useEffect(() => {
    // ✅ Email linkinden geliyorsa Turnstile yükleme!
    // Supabase hash (#) kullanıyor, query params (?) değil
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);

    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const type = hashParams.get('type') || searchParams.get('type');

    if (accessToken && type === 'recovery') {
      console.log('✅ Coming from email link - skipping Turnstile');
      return;
    }

    const loadTurnstile = () => {
      // Check if script already exists
      if (document.querySelector('script[src*="turnstile"]')) {
        if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
          renderTurnstile();
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;

      window.onTurnstileLoad = () => {
        setTurnstileLoaded(true);
        renderTurnstile();
      };

      document.head.appendChild(script);
    };

    const renderTurnstile = () => {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            theme: 'dark'
          });
        } catch (e) {
          console.error('Turnstile render error:', e);
        }
      }
    };

    loadTurnstile();

    return () => {
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          console.error('Turnstile cleanup error:', e);
        }
      }
    };
  }, [searchParams]);

  // Re-render Turnstile when loaded (only if NOT from email)
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);

    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const type = hashParams.get('type') || searchParams.get('type');

    if (accessToken && type === 'recovery') {
      return; // Email linkinden geliyorsa Turnstile render etme
    }

    if (turnstileLoaded && turnstileRef.current && !widgetIdRef.current) {
      try {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: 'dark'
        });
      } catch (e) {
        console.error('Turnstile render error:', e);
      }
    }
  }, [turnstileLoaded, searchParams]);

  useEffect(() => {
    // Check for errors in URL hash (Supabase redirects with hash fragments)
    const hash = window.location.hash.substring(1); // Remove the '#'
    const hashParams = new URLSearchParams(hash);

    const error = hashParams.get('error');
    const errorCode = hashParams.get('error_code');
    const errorDescription = hashParams.get('error_description');

    if (error) {
      console.error('Reset password error:', { error, errorCode, errorDescription });

      if (errorCode === 'otp_expired') {
        showError('Email link has expired. Please request a new password reset.');
      } else if (error === 'access_denied') {
        showError('Email link is invalid. Please request a new password reset.');
      } else {
        showError(errorDescription || 'Authentication failed. Please try again.');
      }

      // Clear the hash from URL to remove error params
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for valid access token (Supabase uses hash, not query params)
    const hashAccessToken = hashParams.get('access_token');
    const hashType = hashParams.get('type');

    if (hashAccessToken && hashType === 'recovery') {
      console.log('✅ Valid recovery token found in hash');
      setEmail('Verified via email link');
      setCodeSent(true);
      setShowPasswordFields(true);
    }
  }, [searchParams]);

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();

    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!turnstileResponse) {
      showError('Please complete the security verification');
      return;
    }

    if (!email) {
      showError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setCodeSent(true);

    } catch (error) {
      console.error('Reset error:', error);
      showError(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      showError('Please enter new password');
      return;
    }

    if (newPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccessFinal(true);

      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (error) {
      console.error('Update error:', error);
      showError(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Arial', sans-serif;
          background: #1b1c1e;
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header {
          background: #000000;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #1a1a1a;
        }

        .logo img {
          height: 32px;
          width: auto;
        }

        .main-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .reset-box {
          background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%);
          border: 2px solid #292a2e;
          border-radius: 20px;
          padding: 40px 60px;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          transition: all 0.5s ease;
        }

        .reset-title {
          font-size: 36px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 15px;
          letter-spacing: 2px;
        }

        .reset-subtitle {
          text-align: center;
          font-size: 14px;
          color: #999999;
          margin-bottom: 35px;
          line-height: 1.5;
        }

        .form-group {
          margin-bottom: 25px;
        }

        .form-input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #333333;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 15px;
          color: #ffffff;
          transition: all 0.3s;
          outline: none;
        }

        .form-input::placeholder {
          color: #666666;
        }

        .form-input:focus {
          border-color: #0066ec;
          background: #222222;
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-success {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 25px;
          padding: 15px;
          background: rgba(114, 255, 0, 0.05);
          border-radius: 10px;
          animation: slideDown 0.5s ease;
        }

        .verification-success.show {
          display: flex;
        }

        .verification-success .check-icon {
          width: 28px;
          height: 28px;
          background: #72ff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 18px;
        }

        .verification-success .message-text {
          color: #72ff00;
          font-size: 16px;
          font-weight: 600;
        }

        .additional-fields {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.5s ease;
        }

        .additional-fields.expanded {
          max-height: 600px;
        }

        .verification-prompt {
          font-size: 14px;
          color: #999999;
          margin-bottom: 20px;
          text-align: center;
        }

        .reset-button {
          width: 100%;
          background: linear-gradient(180deg, #0066ec 0%, #0052be 100%);
          border: none;
          border-radius: 12px;
          padding: 18px;
          font-size: 27px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(0, 102, 236, 0.3);
        }

        .reset-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 102, 236, 0.4);
        }

        .reset-button:active {
          transform: translateY(0);
        }

        .reset-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .reset-button.hidden {
          display: none;
        }

        .success-final {
          display: none;
          text-align: center;
          margin-top: 25px;
          animation: fadeIn 0.5s ease;
        }

        .success-final.show {
          display: block;
        }

        .success-final .success-text {
          color: #72ff00;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .success-final .redirect-text {
          color: #999999;
          font-size: 14px;
        }

        .error-message {
          display: none;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          background: rgba(255, 0, 0, 0.1);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: #ff6b6b;
        }

        .error-message.show {
          display: block;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 600px) {
          .reset-box {
            padding: 30px 30px;
            max-width: 100%;
          }

          .reset-title {
            font-size: 28px;
          }

          .header {
            height: 70px;
          }

          .logo img {
            height: 28px;
          }
        }
      `}</style>

      <header className="header">
        <div className="logo">
          <img src="/ECOM_STUDIO_LOGO.png" alt="ECOM STUDIO" />
        </div>
      </header>

      <main className="main-content">
        <div className="reset-box">
          <h1 className="reset-title">PASSWORD RESET</h1>
          <p className="reset-subtitle">
            Provide the email address associated<br />with your account to recover your password.
          </p>

          {errorMessage && (
            <div className="error-message show">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSendEmail}>
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Your E-mail Address"
                required
                disabled={codeSent}
              />
            </div>

            {!codeSent && (
              <>
                <div
                  ref={turnstileRef}
                  style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}
                />

                <button type="submit" className="reset-button" disabled={loading}>
                  {loading ? 'SENDING...' : 'RESET PASSWORD'}
                </button>
              </>
            )}

            <div className={`verification-success ${codeSent ? 'show' : ''}`}>
              <div className="check-icon">✓</div>
              <div className="message-text">Password reset link sent to your email!</div>
            </div>

            <div className={`additional-fields ${showPasswordFields ? 'expanded' : ''}`}>
              {showPasswordFields && !successFinal && (
                <>
                  <p className="verification-prompt">Create a new password for your account:</p>

                  <div className="form-group">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-input"
                      placeholder="New Password"
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input"
                      placeholder="Confirm New Password"
                      style={{
                        borderColor: confirmPassword && newPassword !== confirmPassword ? '#ff6b6b' : '#333333'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="reset-button"
                    disabled={loading}
                  >
                    {loading ? 'UPDATING...' : 'RESET PASSWORD'}
                  </button>
                </>
              )}
            </div>

            {codeSent && !showPasswordFields && (
              <p className="verification-prompt" style={{ color: '#72ff00' }}>
                Please check your email and click the reset link. You will be redirected back here.
              </p>
            )}

            <div className={`success-final ${successFinal ? 'show' : ''}`}>
              <div className="success-text">Your password has been changed.</div>
              <div className="redirect-text">You will be redirected to the login page in 3 seconds.</div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}