'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent';
import TermsOfServiceContent from '@/components/legal/TermsOfServiceContent';
import './signup.css';

export default function SignupPage() {
  const router = useRouter();
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    companyName: '',
    password: '',
    confirmPassword: ''
  });
  
  const [termsAccept, setTermsAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');

  // Load Turnstile script
  useEffect(() => {
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
  }, []);

  // Re-render Turnstile when loaded
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      }
    });
  }, [router, supabase]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const createUserFolders = async (userId) => {
    try {
      const response = await fetch('/api/create-user-folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to create folders');
      }

      const data = await response.json();
      
      if (!data.success) {
        console.warn('⚠️ Some folders could not be created:', data.results);
      }

      return data.results;
    } catch (error) {
      console.error('❌ Error calling create-user-folders API:', error);
      return [{
        folder: 'all',
        success: false,
        error: error.message
      }];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!turnstileResponse) {
      showMessage('Please complete the security verification', 'error');
      return;
    }

    const { fullName, email, companyName, password, confirmPassword } = formData;

    if (!fullName || !email || !password || !confirmPassword) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (!termsAccept) {
      showMessage('Please accept the Terms of Use & Privacy Policy', 'error');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName || null
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (error) {
        // ✅ Daha detaylı error handling
        if (error.message.includes('already') || error.message.includes('registered') || error.message.includes('exists')) {
          showMessage('This email is already registered. Please log in instead.', 'error');
        } else if (error.message.includes('email')) {
          showMessage('Please enter a valid email address.', 'error');
        } else if (error.message.includes('password')) {
          showMessage('Password must be at least 6 characters long.', 'error');
        } else {
          showMessage(error.message || 'Sign up failed. Please try again.', 'error');
        }
        return;
      }

      // ✅ KRİTİK KONTROL: User gerçekten oluşturuldu mu?
      // Supabase duplicate email'de bazen:
      // 1. Error dönmüyor
      // 2. data.user dönüyor AMA session yok
      // 3. identities array boş oluyor
      
      if (!data.user || !data.user.id) {
        console.warn('⚠️ No user created (probably duplicate)');
        showMessage('This email is already registered. Please log in instead.', 'error');
        return;
      }

      // Eğer identities yoksa veya boşsa → duplicate email
      if (!data.user.identities || data.user.identities.length === 0) {
        console.warn('⚠️ User exists but no new identity created (duplicate email)');
        showMessage('This email is already registered. Please log in instead.', 'error');
        return;
      }

      // Session yoksa → duplicate email (veya email confirmation gerekli)
      if (!data.session) {
        console.warn('⚠️ No session created - checking if duplicate');
        // Eğer user var ama session yoksa ve identities boşsa → duplicate
        if (data.user.identities.length === 0) {
          showMessage('This email is already registered. Please log in instead.', 'error');
          return;
        }
      }

      console.log('✅ User created:', data.user.id);
      console.log('✅ Identities:', data.user.identities.length);

      showMessage('Account created successfully!', 'success');

      setTimeout(() => {
        setFormData({
          fullName: '',
          email: '',
          companyName: '',
          password: '',
          confirmPassword: ''
        });
        setTermsAccept(false);
        
        // Reset Turnstile
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
        
        showMessage('Redirecting to login...', 'success');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }, 2000);

    } catch (error) {
      console.error('Signup error:', error);
      showMessage('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openModal = (type) => {
    setModalContent(type);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent('');
    document.body.style.overflow = 'unset';
  };

  return (
    <>
      <header className="header">
        <div className="logo">
          <img src="/ECOM_STUDIO_LOGO.png" alt="ECOM STUDIO" />
        </div>
      </header>

      <main className="main-content">
        <div className="signup-box">
          <h1 className="signup-title">SIGN UP FORM</h1>
          <p className="signup-subtitle">Use this form and get started quickly.</p>

          {message.text && (
            <div className={`message ${message.type} show`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="form-input"
                placeholder="Full Name"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                placeholder="E-mail"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="form-input"
                placeholder="Company Name (Optional)"
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="form-input"
                placeholder="Create Password"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className="form-input"
                placeholder="Confirm Password"
                required
                style={{
                  borderColor: formData.confirmPassword && formData.password !== formData.confirmPassword ? '#ff6b6b' : '#333333'
                }}
              />
            </div>

            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccept}
                onChange={(e) => setTermsAccept(e.target.checked)}
                required
              />
              <span>
                I accept the{' '}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); openModal('terms'); }}
                  style={{ cursor: 'pointer' }}
                >
                  Terms of Service
                </a>
                {' '}&{' '}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); openModal('privacy'); }}
                  style={{ cursor: 'pointer' }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            <div
              ref={turnstileRef}
              style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}
            />

            <button type="submit" className="signup-button" disabled={loading}>
              {loading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
            </button>
          </form>

          <div className="login-prompt">
            Already have an account?{' '}
            <a onClick={() => router.push('/login')} className="login-link">
              Log in
            </a>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-body">
              {modalContent === 'terms' ? (
                <>
                  <h1>TERMS OF SERVICE</h1>
                  <p className="last-updated">Last Updated: October 16, 2025</p>
                  <div className="important-notice">
                    <h3>⚠️ Important Notice</h3>
                    <p>By using the services provided at www.ecomstudio.com.tr, you are deemed to have accepted the following terms and conditions. If you do not accept these terms, please do not use the platform.</p>
                  </div>
                  <TermsOfServiceContent />
                </>
              ) : (
                <>
                  <h1>PRIVACY POLICY</h1>
                  <p className="last-updated">Last Updated: November 2025</p>
                  <div className="important-notice">
                    <h3>⚠️ Important Legal Notice</h3>
                    <p>This Privacy Policy is prepared in accordance with the Turkish Personal Data Protection Law (KVKK) and GDPR principles. By using our services, you acknowledge that you have read, understood, and agreed to this policy.</p>
                  </div>
                  <PrivacyPolicyContent />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          overflow-y: auto;
        }

        .modal-content {
          background: #1a1a1a;
          border-radius: 12px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .modal-close {
          position: sticky;
          top: 0;
          right: 0;
          float: right;
          background: #333333;
          border: none;
          color: #ffffff;
          font-size: 28px;
          width: 45px;
          height: 45px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
          margin: 20px 20px 0 0;
          z-index: 10;
        }

        .modal-close:hover {
          background: #444444;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 20px 50px 50px 50px;
          color: #cccccc;
          clear: both;
        }

        .modal-body h1 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 10px;
          text-align: center;
          color: #ffffff;
        }

        .modal-body h2 {
          font-size: 22px;
          font-weight: 700;
          margin-top: 35px;
          margin-bottom: 18px;
          color: #ffffff;
          letter-spacing: 1px;
        }

        .modal-body h3 {
          font-size: 17px;
          font-weight: 600;
          margin-top: 25px;
          margin-bottom: 12px;
          color: #cccccc;
        }

        .modal-body p {
          margin-bottom: 13px;
          color: #cccccc;
          font-size: 14px;
          line-height: 1.7;
        }

        .modal-body ul, .modal-body ol {
          margin-left: 22px;
          margin-bottom: 18px;
          color: #cccccc;
        }

        .modal-body li {
          margin-bottom: 8px;
          font-size: 14px;
          line-height: 1.6;
        }

        .modal-body strong {
          color: #ffffff;
          font-weight: 600;
        }

        .modal-body a {
          color: #0066ec;
          text-decoration: none;
          transition: color 0.3s;
        }

        .modal-body a:hover {
          color: #0052be;
          text-decoration: underline;
        }

        .last-updated {
          font-size: 13px;
          color: #999999;
          text-align: center;
          margin-bottom: 30px;
        }

        .important-notice {
          background: #222222;
          border-left: 4px solid #0066ec;
          padding: 18px 22px;
          border-radius: 8px;
          margin: 30px 0;
        }

        .important-notice h3 {
          color: #0066ec;
          font-size: 15px;
          margin-bottom: 8px;
          margin-top: 0;
        }

        .important-notice p {
          font-size: 13px;
          color: #cccccc;
          margin-bottom: 0;
        }

        .contact-info {
          background: #111111;
          padding: 18px;
          border-radius: 8px;
          margin-top: 25px;
        }

        .contact-info p {
          margin-bottom: 6px;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .modal-body {
            padding: 15px 25px 35px 25px;
          }

          .modal-body h1 {
            font-size: 26px;
          }

          .modal-body h2 {
            font-size: 19px;
          }

          .modal-close {
            margin: 15px 15px 0 0;
          }
        }
      `}</style>
    </>
  );
}

