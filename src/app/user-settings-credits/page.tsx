'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export default function UserSettingsCreditsPage() {
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
  const [credits, setCredits] = useState(0);
  const [creditAmount, setCreditAmount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [showingAll, setShowingAll] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setCredits(profile?.credits || 0);

      await loadTransactions(user.id);
      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'loadUserData');
      showToast(appError.userMessage, 'error');
      setLoading(false);
    }
  };

  const loadTransactions = async (userId: string, limit: number = 50) => {
    try {
      const query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (limit > 0) {
        query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const trans = data || [];
      setTransactions(trans);
      setAllTransactions(trans);
    } catch (error) {
      const appError = handleError(error, 'loadTransactions');
      showToast(appError.userMessage, 'error');
      setTransactions([]);
    }
  };

  const handlePayment = () => {
    const amount = parseFloat(creditAmount);
    
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    // TODO: Redirect to payment page
    showToast('Payment page is not yet implemented', 'error');
  };

  const handleViewAll = async () => {
    if (!currentUser) return;

    try {
      await loadTransactions(currentUser.id, 0); // 0 = no limit
      setShowingAll(true);
      showToast(`Loaded ${allTransactions.length} transactions`, 'success');
    } catch (error) {
      const appError = handleError(error, 'handleViewAll');
      showToast(appError.userMessage, 'error');
    }
  };

  const downloadCSV = () => {
    if (!allTransactions || allTransactions.length === 0) {
      showToast('No transactions to download', 'error');
      return;
    }

    try {
      let csv = 'Description,Date,Time,Amount\n';
      
      allTransactions.forEach(t => {
        const date = new Date(t.created_at);
        const dateStr = date.toLocaleDateString('en-GB');
        const timeStr = date.toLocaleTimeString('en-GB');
        const amount = t.amount > 0 ? `+${t.amount}` : t.amount;
        
        csv += `"${t.description}","${dateStr}","${timeStr}","${amount} Credits"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('CSV file downloaded successfully!', 'success');
    } catch (error) {
      const appError = handleError(error, 'downloadCSV');
      showToast(appError.userMessage, 'error');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} / ${timeStr}`;
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
            <a onClick={() => router.push('/user-settings-profile')} className="tab">
              PROFILE INFORMATION
            </a>
            <span className="tab-separator">|</span>
            <a onClick={() => router.push('/user-settings-credits')} className="tab active">
              USAGE & CREDITS
            </a>
            <span className="tab-separator">|</span>
            <a onClick={() => router.push('/user-settings-billing')} className="tab">
              BILLING SETTINGS
            </a>
          </div>
        </div>

        {/* Credits Section */}
        <div className="content-section">
          <h2 className="section-title">CREDITS</h2>

          {/* Current Balance */}
          <div className="balance-display">
            Current Balance: <span className="balance-amount">{credits.toLocaleString('en-US')} TL</span>
          </div>

          {/* Add Credits */}
          <div className="add-credits-box">
            <h3 className="add-credits-title">ADD CREDITS</h3>
            <div className="add-credits-form">
              <label className="add-credits-label">Please enter the amount you wish to top-up:</label>
              <input 
                type="number" 
                className="credits-input" 
                placeholder="0 TL" 
                min="0" 
                step="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <button onClick={handlePayment} className="btn-green">PAY BY CREDIT CARD</button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="transaction-section">
            <div className="transaction-header">
              <h3 className="section-title">
                TRANSACTION HISTORY {showingAll ? '' : '(LAST 50)'}
              </h3>
            </div>

            <div className="transaction-table-container">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Date / Time</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-state">
                        No transaction history available yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id}>
                        <td>{t.description}</td>
                        <td>{formatDateTime(t.created_at)}</td>
                        <td className={t.amount > 0 ? 'amount-positive' : 'amount-negative'}>
                          {t.amount > 0 ? '+' : ''}{t.amount} Credits
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="action-buttons">
              <button onClick={handleViewAll} className="btn-secondary" disabled={showingAll}>
                FOR ALL TRANSACTIONS
              </button>
              <button onClick={downloadCSV} className="btn-secondary">
                DOWNLOAD CSV
              </button>
            </div>
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

        .balance-display {
          font-size: 18px;
          color: #cccccc;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid #333333;
        }

        .balance-amount {
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
          margin-left: 10px;
        }

        .add-credits-box {
          background: #000000;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 50px;
        }

        .add-credits-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-bottom: 25px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .add-credits-form {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .add-credits-label {
          font-size: 14px;
          color: #cccccc;
        }

        .credits-input {
          background: #1a1a1a;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 12px 20px;
          font-size: 16px;
          color: #ffffff;
          font-family: inherit;
          width: 200px;
          text-align: center;
        }

        .credits-input:focus {
          outline: none;
          border-color: #2ab600;
        }

        .btn-green {
          background: linear-gradient(to bottom, #2ab600 0%, #229200 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 12px 30px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(42, 182, 0, 0.3);
        }

        .btn-green:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(42, 182, 0, 0.4);
        }

        .transaction-section {
          margin-top: 50px;
        }

        .transaction-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .transaction-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }

        .transaction-table thead {
          background: #000000;
        }

        .transaction-table th {
          padding: 15px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #ffffff;
          border-bottom: 2px solid #333333;
        }

        .transaction-table th:last-child {
          text-align: right;
        }

        .transaction-table td {
          padding: 15px;
          font-size: 14px;
          color: #cccccc;
          border-bottom: 1px solid #222222;
        }

        .transaction-table td:last-child {
          text-align: right;
          font-weight: 600;
        }

        .transaction-table tbody tr:hover {
          background: #111111;
        }

        .amount-positive {
          color: #2ab600;
        }

        .amount-negative {
          color: #ff4444;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666666;
          font-size: 16px;
        }

        .action-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
        }

        .btn-secondary {
          background: transparent;
          color: #cccccc;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 10px 24px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #222222;
          border-color: #555555;
          color: #ffffff;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

          .add-credits-form {
            flex-direction: column;
            align-items: stretch;
          }

          .credits-input {
            width: 100%;
          }

          .transaction-table {
            font-size: 12px;
          }

          .transaction-table th,
          .transaction-table td {
            padding: 10px 8px;
          }

          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}