'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function AdminLoginPage() {
  const router = useRouter();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);

  // Load Turnstile script
  useEffect(() => {
    const loadTurnstile = () => {
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
  }, []);

  useEffect(() => {
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
  }, [turnstileLoaded]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('Session check error:', error);
      }

      if (session) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'admin') {
          router.push('/cockpit');
        } else {
          showMessage('Access denied. Admin privileges required.', 'error');
          await supabase.auth.signOut();
        }
      }
    });

    const rememberedEmail = localStorage.getItem('rememberAdminEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [router, supabase]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!turnstileResponse) {
      showMessage('Please complete the security verification', 'error');
      return;
    }

    if (!email || !password) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          showMessage('Please verify your email first. Check your inbox.', 'error');
        } else if (error.message.includes('Invalid login credentials')) {
          showMessage('Invalid email or password. Please try again.', 'error');
        } else {
          showMessage(error.message || 'Login failed. Please try again.', 'error');
        }
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // Debug logging
      console.log('User ID:', data.user.id);
      console.log('Profile data:', profile);
      console.log('Profile error:', profileError);
      console.log('Role:', profile?.role);

      if (profileError || profile?.role !== 'admin') {
        showMessage('Access denied. Admin privileges required.', 'error');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      showMessage('Login successful! Redirecting...', 'success');

      // Remember me
      if (rememberMe) {
        localStorage.setItem('rememberAdminEmail', email);
      } else {
        localStorage.removeItem('rememberAdminEmail');
      }

      setTimeout(() => {
        router.push('/cockpit');
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      showMessage('An unexpected error occurred. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background-color: #1b1c1e;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .header {
          background: #000000;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 2px solid #282828;
        }

        .logo img {
          height: 85px;
          width: auto;
        }

        .main-content {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 100px);
          padding: 40px 20px;
        }

        .login-box {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 20px;
          padding: 50px 60px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .login-title {
          font-size: 32px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 10px;
          letter-spacing: 2px;
          color: #ffffff;
        }

        .admin-subtitle {
          font-size: 14px;
          font-weight: 500;
          text-align: center;
          margin-bottom: 40px;
          color: #a8a8a8;
          letter-spacing: 1px;
        }

        .message {
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 25px;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .message.show {
          opacity: 1;
        }

        .message.success {
          background: #1b3926;
          color: #4ade80;
          border: 1px solid #4ade80;
        }

        .message.error {
          background: #300d0d;
          color: #ef4444;
          border: 1px solid #ef4444;
        }

        .form-group {
          margin-bottom: 25px;
        }

        .form-input {
          width: 100%;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 16px 20px;
          color: #ffffff;
          font-size: 15px;
          transition: border-color 0.3s;
        }

        .form-input:focus {
          outline: none;
          border-color: #0066ff;
        }

        .form-input::placeholder {
          color: #666;
        }

        .form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #a8a8a8;
        }

        .remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .login-button {
          width: 100%;
          background-color: #0066ff;
          border: none;
          border-radius: 8px;
          padding: 16px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          transition: background-color 0.3s;
          text-transform: uppercase;
        }

        .login-button:hover {
          background-color: #0052cc;
        }

        .login-button:disabled {
          background-color: #444;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .login-box {
            padding: 40px 30px;
          }

          .login-title {
            font-size: 28px;
          }
        }
      `}</style>

      <header className="header">
        <div className="logo">
          <img src="/admin_logo.png" alt="ECOM Studio Admin" />
        </div>
      </header>

      <main className="main-content">
        <div className="login-box">
          <h1 className="login-title">ADMIN LOGIN</h1>
          <p className="admin-subtitle">CONTROL PANEL ACCESS</p>

          {message.text && (
            <div className={`message ${message.type} show`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="E-mail"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Password"
                required
              />
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>
            </div>

            <div
              ref={turnstileRef}
              style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}
            />

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
