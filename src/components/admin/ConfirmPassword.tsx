'use client';

import { useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface ConfirmPasswordProps {
  supabase: SupabaseClient;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmPassword({
  supabase,
  action,
  onConfirm,
  onCancel,
}: ConfirmPasswordProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInError) {
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      // Password correct, proceed with action
      onConfirm();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx>{`
        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .confirm-box {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }

        .confirm-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #ffffff;
          text-align: center;
        }

        .confirm-subtitle {
          font-size: 14px;
          color: #a8a8a8;
          margin-bottom: 30px;
          text-align: center;
        }

        .confirm-action {
          background: #1a1a1a;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 25px;
          text-align: center;
          color: #ffc600;
          font-weight: 600;
          font-size: 16px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 14px;
          color: #ffffff;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .form-input {
          width: 100%;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
        }

        .form-input:focus {
          outline: none;
          border-color: #0066ff;
        }

        .error-message {
          color: #ef4444;
          font-size: 13px;
          margin-top: 8px;
          text-align: center;
        }

        .button-group {
          display: flex;
          gap: 15px;
          margin-top: 25px;
        }

        .btn {
          flex: 1;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-confirm {
          background-color: #0066ff;
          color: #ffffff;
        }

        .btn-confirm:hover {
          background-color: #0052cc;
        }

        .btn-confirm:disabled {
          background-color: #444;
          cursor: not-allowed;
        }

        .btn-cancel {
          background-color: transparent;
          color: #ffffff;
          border: 1px solid #3a3a3e;
        }

        .btn-cancel:hover {
          background-color: #1a1a1a;
        }

        .security-note {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-top: 15px;
          font-style: italic;
        }
      `}</style>

      <div className="confirm-overlay">
        <div className="confirm-box">
          <h3 className="confirm-title">⚠️ Confirm Action</h3>
          <p className="confirm-subtitle">
            This is a critical action that requires password confirmation
          </p>

          <div className="confirm-action">{action}</div>

          <div className="form-group">
            <label className="form-label">Enter Your Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Your admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="button-group">
            <button className="btn btn-cancel" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button
              className="btn btn-confirm"
              onClick={handleConfirm}
              disabled={loading || !password}
            >
              {loading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>

          <div className="security-note">
            🔒 Your password will not be stored and is only used for verification
          </div>
        </div>
      </div>
    </>
  );
}
