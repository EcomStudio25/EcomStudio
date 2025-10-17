'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import './login.css';

export default function LoginPage() {
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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Session check error (normal if logged out):', error);
        // Hata varsa da sorun yok, login sayfasındayız zaten
      }

      if (session) {
        // Zaten login olmuş, dashboard'a yönlendir
        router.push('/dashboard');
      }
    });

    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [router, supabase]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // ✅ İlk login kontrolü ve Bunny klasör oluşturma (with auth)
  const checkAndCreateFolders = async (userId, accessToken) => {
    try {
      // Kullanıcının metadata'sında klasörler oluşturuldu mu kontrol et
      const { data: userData } = await supabase.auth.getUser();
      const userMetadata = userData?.user?.user_metadata || {};

      // Eğer daha önce klasörler oluşturulmamışsa
      if (!userMetadata.folders_created) {
        console.log('🆕 First login detected! Creating Bunny folders...');

        const response = await fetch('/api/create-user-folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ userId })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Bunny folders created:', data);
          
          // Metadata'yı güncelle ki bir daha oluşturmasın
          await supabase.auth.updateUser({
            data: { folders_created: true }
          });
        } else {
          console.warn('⚠️ Could not create Bunny folders');
        }
      } else {
        console.log('✅ Folders already exist, skipping...');
      }
    } catch (error) {
      console.error('❌ Error in checkAndCreateFolders:', error);
    }
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

      showMessage('Login successful! Redirecting...', 'success');

      // ✅ İlk login ise klasörleri oluştur (with auth token)
      if (data.user?.id && data.session?.access_token) {
        await checkAndCreateFolders(data.user.id, data.session.access_token);
      }

      // Remember me
      if (rememberMe) {
        localStorage.setItem('rememberEmail', email);
      } else {
        localStorage.removeItem('rememberEmail');
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      showMessage('An unexpected error occurred. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <header className="header">
        <div className="logo">
          <img src="/ECOM_STUDIO_LOGO.png" alt="ECOM STUDIO" />
        </div>
      </header>

      <main className="main-content">
        <div className="login-box">
          <h1 className="login-title">LOGIN</h1>

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
              <a 
                onClick={() => router.push('/reset-password')} 
                className="forgot-password"
              >
                Forgot Password?
              </a>
            </div>

            <div
              ref={turnstileRef}
              style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}
            />

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
          </form>

          <div className="signup-prompt">
            Don't have an account?{' '}
            <a onClick={() => router.push('/signup')} className="signup-link">
              Sign up for free
            </a>
          </div>
        </div>
      </main>
    </>
  );
}