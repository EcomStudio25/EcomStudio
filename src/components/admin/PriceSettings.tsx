'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { showAdminToast } from './AdminToast';

interface PriceSettingsProps {
  supabase: SupabaseClient;
}

interface Settings {
  signup_credit: number;
  credit_per_image: number;
  discount_rate: number;
  credit_topup_bonus_rate: number;
}

export default function PriceSettings({ supabase }: PriceSettingsProps) {
  const [settings, setSettings] = useState<Settings>({
    signup_credit: 0,
    credit_per_image: 100,
    discount_rate: 0,
    credit_topup_bonus_rate: 0
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const settingsObj: any = {};
        data.forEach((item) => {
          settingsObj[item.setting_key] = parseFloat(item.setting_value);
        });
        setSettings(settingsObj as Settings);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof Settings) => {
    try {
      setUpdating({ ...updating, [key]: true });

      const { error } = await supabase
        .from('admin_settings')
        .update({
          setting_value: settings[key],
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', key);

      if (error) throw error;

      showAdminToast(`${key.replace(/_/g, ' ').toUpperCase()} updated successfully!`, 'success');
      setUpdating({ ...updating, [key]: false });
    } catch (error) {
      console.error('Error updating setting:', error);
      showAdminToast('Failed to update setting. Please try again.', 'error');
      setUpdating({ ...updating, [key]: false });
    }
  };

  const handleInputChange = (key: keyof Settings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings({ ...settings, [key]: numValue });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>Loading settings...</div>;
  }

  return (
    <>
      <style jsx>{`
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .setting-label {
          font-size: 14px;
          color: #ffffff;
          white-space: nowrap;
          min-width: 150px;
        }

        .setting-input {
          flex: 1;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
          text-align: center;
        }

        .setting-input:focus {
          outline: none;
          border-color: #0066ff;
        }

        .update-btn {
          background-color: #0066ff;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s;
          text-transform: uppercase;
          font-size: 13px;
          letter-spacing: 0.5px;
        }

        .update-btn:hover {
          background-color: #0052cc;
        }

        .update-btn:disabled {
          background-color: #444;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .settings-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .setting-item {
            flex-direction: column;
            align-items: stretch;
          }

          .setting-label {
            min-width: auto;
            text-align: center;
          }
        }
      `}</style>

      <div className="settings-grid">
        <div className="setting-item">
          <label className="setting-label">Sign up Credit:</label>
          <input
            type="number"
            className="setting-input"
            value={settings.signup_credit}
            onChange={(e) => handleInputChange('signup_credit', e.target.value)}
          />
          <button
            className="update-btn"
            onClick={() => updateSetting('signup_credit')}
            disabled={updating.signup_credit}
          >
            {updating.signup_credit ? 'UPDATING...' : 'UPDATE'}
          </button>
        </div>

        <div className="setting-item">
          <label className="setting-label">Credit per Image:</label>
          <input
            type="number"
            className="setting-input"
            value={settings.credit_per_image}
            onChange={(e) => handleInputChange('credit_per_image', e.target.value)}
          />
          <button
            className="update-btn"
            onClick={() => updateSetting('credit_per_image')}
            disabled={updating.credit_per_image}
          >
            {updating.credit_per_image ? 'UPDATING...' : 'UPDATE'}
          </button>
        </div>

        <div className="setting-item">
          <label className="setting-label">Discount Rate (%):</label>
          <input
            type="number"
            className="setting-input"
            value={settings.discount_rate}
            onChange={(e) => handleInputChange('discount_rate', e.target.value)}
          />
          <button
            className="update-btn"
            onClick={() => updateSetting('discount_rate')}
            disabled={updating.discount_rate}
          >
            {updating.discount_rate ? 'UPDATING...' : 'UPDATE'}
          </button>
        </div>

        <div className="setting-item">
          <label className="setting-label">Credit Top-up Bonus Rate (%):</label>
          <input
            type="number"
            className="setting-input"
            value={settings.credit_topup_bonus_rate}
            onChange={(e) => handleInputChange('credit_topup_bonus_rate', e.target.value)}
          />
          <button
            className="update-btn"
            onClick={() => updateSetting('credit_topup_bonus_rate')}
            disabled={updating.credit_topup_bonus_rate}
          >
            {updating.credit_topup_bonus_rate ? 'UPDATING...' : 'UPDATE'}
          </button>
        </div>
      </div>
    </>
  );
}
