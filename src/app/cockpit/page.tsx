'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ProductUsageStats from '@/components/admin/ProductUsageStats';
import CreditUsageStats from '@/components/admin/CreditUsageStats';
import UserList from '@/components/admin/UserList';
import PriceSettings from '@/components/admin/PriceSettings';
import Notifications from '@/components/admin/Notifications';
import AllTransactions from '@/components/admin/AllTransactions';
import AdminToast from '@/components/admin/AdminToast';

export default function AdminPanel() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    product: false,
    credit: false,
    users: false,
    price: false,
    notifications: false,
    transactions: false
  });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  // Auto logout after 30 minutes of inactivity
  useEffect(() => {
    if (!currentUser) return;

    let timeout: NodeJS.Timeout;
    const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        alert('Session expired due to inactivity. Please login again.');
        await supabase.auth.signOut();
        router.push('/cockpit/login');
      }, TIMEOUT_DURATION);
    };

    // Reset timeout on user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [currentUser, router, supabase]);

  const checkAdminAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push('/cockpit/login');
        return;
      }

      // Check if user is admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        router.push('/cockpit/login');
        return;
      }

      setCurrentUser(session.user);
      setLoading(false);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/cockpit/login');
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut();
      router.push('/cockpit/login');
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1b1c1e',
        color: '#fff'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <AdminToast />
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #1b1c1e;
          color: #ffffff;
          min-height: 100vh;
        }

        .header-black {
          background-color: #000000;
          padding: 15px 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-grey {
          background-color: #282828;
          padding: 15px 0;
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo {
          width: 430px;
          height: 85px;
          object-fit: contain;
        }

        .logout-btn {
          color: #a8a8a8;
          text-decoration: none;
          font-size: 16px;
          transition: color 0.3s;
          cursor: pointer;
        }

        .logout-btn:hover {
          color: #ffffff;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px;
        }

        .section-box {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 20px;
          margin-bottom: 30px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }

        .section-header {
          padding: 25px 40px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }

        .section-header:hover,
        .section-header.active {
          background: linear-gradient(to bottom, #3a3a3e, #252528);
        }

        .section-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .arrow {
          font-size: 20px;
          transition: transform 0.3s;
        }

        .arrow.open {
          transform: rotate(180deg);
        }

        .section-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s ease;
        }

        .section-content.open {
          max-height: 5000px;
        }

        .section-inner {
          padding: 30px 40px 40px;
        }

        @media (max-width: 1200px) {
          .container {
            padding: 30px 20px;
          }
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 0 20px;
          }

          .logo {
            width: 300px;
            height: 60px;
          }

          .container {
            padding: 20px 15px;
          }

          .section-header {
            padding: 20px 25px;
          }

          .section-title {
            font-size: 18px;
          }

          .section-inner {
            padding: 20px 25px 30px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header-black">
        <div className="header-content">
          <div className="logo-container">
            <img src="/admin_logo.png" alt="ECOM Studio Admin" className="logo" />
          </div>
          <div className="logout-btn" onClick={handleLogout}>Logout</div>
        </div>
      </div>
      <div className="header-grey"></div>

      {/* Main Container */}
      <div className="container">
        {/* Product Usage Stats */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.product ? 'active' : ''}`}
            onClick={() => toggleSection('product')}
          >
            <h2 className="section-title">PRODUCT USAGE STATS</h2>
            <span className={`arrow ${openSections.product ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.product ? 'open' : ''}`}>
            <div className="section-inner">
              <ProductUsageStats supabase={supabase} />
            </div>
          </div>
        </div>

        {/* Credit Usage Stats */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.credit ? 'active' : ''}`}
            onClick={() => toggleSection('credit')}
          >
            <h2 className="section-title">CREDIT USAGE STATS</h2>
            <span className={`arrow ${openSections.credit ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.credit ? 'open' : ''}`}>
            <div className="section-inner">
              <CreditUsageStats supabase={supabase} />
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.users ? 'active' : ''}`}
            onClick={() => toggleSection('users')}
          >
            <h2 className="section-title">USER LIST</h2>
            <span className={`arrow ${openSections.users ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.users ? 'open' : ''}`}>
            <div className="section-inner">
              <UserList supabase={supabase} />
            </div>
          </div>
        </div>

        {/* Price Settings */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.price ? 'active' : ''}`}
            onClick={() => toggleSection('price')}
          >
            <h2 className="section-title">PRICE SETTINGS</h2>
            <span className={`arrow ${openSections.price ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.price ? 'open' : ''}`}>
            <div className="section-inner">
              <PriceSettings supabase={supabase} />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.notifications ? 'active' : ''}`}
            onClick={() => toggleSection('notifications')}
          >
            <h2 className="section-title">NOTIFICATIONS</h2>
            <span className={`arrow ${openSections.notifications ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.notifications ? 'open' : ''}`}>
            <div className="section-inner">
              <Notifications supabase={supabase} />
            </div>
          </div>
        </div>

        {/* All Transactions */}
        <div className="section-box">
          <div
            className={`section-header ${openSections.transactions ? 'active' : ''}`}
            onClick={() => toggleSection('transactions')}
          >
            <h2 className="section-title">ALL TRANSACTIONS</h2>
            <span className={`arrow ${openSections.transactions ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`section-content ${openSections.transactions ? 'open' : ''}`}>
            <div className="section-inner">
              <AllTransactions supabase={supabase} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
