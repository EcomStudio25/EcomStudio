'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { showAdminToast } from './AdminToast';

interface AllTransactionsProps {
  supabase: SupabaseClient;
}

interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  created_at: string;
  images_count?: number;
  transaction_type?: string;
}

export default function AllTransactions({ supabase }: AllTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayedTransactions, setDisplayedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const ITEMS_PER_LOAD = 50;

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
      setDisplayedTransactions((data || []).slice(0, ITEMS_PER_LOAD));
      setLoading(false);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setLoading(false);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    const currentLength = displayedTransactions.length;
    const newTransactions = transactions.slice(
      currentLength,
      currentLength + ITEMS_PER_LOAD
    );
    setDisplayedTransactions([...displayedTransactions, ...newTransactions]);
    setLoadingMore(false);
  };

  const formatDescription = (transaction: Transaction) => {
    if (transaction.transaction_type === 'video_generation' && transaction.images_count) {
      return `Video Generation (${transaction.images_count} Images)`;
    }

    // Map transaction types to readable descriptions
    const typeMap: { [key: string]: string } = {
      video_generation: 'Video Generation',
      image_generation: 'Image Generation',
      credit_purchase: 'Credit Purchase',
      credit_topup_bonus: 'Credit Top-up Bonus',
      manual_credit_addition: 'Manual Credit Addition',
      signup_bonus: 'Sign up Bonus'
    };

    if (transaction.transaction_type && typeMap[transaction.transaction_type]) {
      return typeMap[transaction.transaction_type];
    }

    return transaction.description || 'Unknown';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadExcel = () => {
    try {
      // Prepare data for CSV
      const headers = ['#', 'User ID', 'Description', 'Date / Time', 'Amount'];
      const rows = transactions.map((transaction, index) => [
        index + 1,
        transaction.user_id,
        formatDescription(transaction),
        formatDate(transaction.created_at),
        transaction.amount
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => {
            // Escape commas and quotes in cell content
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAdminToast('Transactions exported successfully!', 'success');
    } catch (error) {
      console.error('Error downloading transactions:', error);
      showAdminToast('Failed to download transactions. Please try again.', 'error');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>Loading transactions...</div>;
  }

  return (
    <>
      <style jsx>{`
        .download-section {
          margin-bottom: 20px;
        }

        .download-btn {
          background-color: #0066ff;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
          font-weight: 600;
        }

        .download-btn:hover {
          background-color: #0052cc;
        }

        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }

        .transactions-table thead {
          background-color: #000000;
        }

        .transactions-table th {
          padding: 15px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #ffffff;
        }

        .transactions-table tbody tr:nth-child(odd) {
          background-color: #1b1c1e;
        }

        .transactions-table tbody tr:nth-child(even) {
          background-color: #141516;
        }

        .transactions-table td {
          padding: 18px 15px;
          font-size: 14px;
          color: #ffffff;
        }

        .amount-positive {
          color: #35e200;
          font-weight: 700;
        }

        .amount-negative {
          color: #ffffff;
        }

        .load-more-section {
          text-align: center;
          margin-top: 20px;
        }

        .load-more-btn {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
          font-weight: 600;
        }

        .load-more-btn:hover {
          background: linear-gradient(to bottom, #3a3a3e, #252528);
        }

        .load-more-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .user-id-cell {
          font-family: monospace;
          font-size: 12px;
          color: #a8a8a8;
        }

        @media (max-width: 768px) {
          .transactions-table {
            font-size: 12px;
          }

          .transactions-table th,
          .transactions-table td {
            padding: 12px 8px;
          }

          .user-id-cell {
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      `}</style>

      {/* Download Button */}
      <div className="download-section">
        <button className="download-btn" onClick={downloadExcel}>
          📥 DOWNLOAD XLS
        </button>
      </div>

      {/* Transactions Table */}
      <table className="transactions-table">
        <thead>
          <tr>
            <th>#</th>
            <th>USER ID</th>
            <th>DESCRIPTION</th>
            <th>DATE / TIME</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {displayedTransactions.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#a8a8a8', padding: '40px' }}>
                No transactions found
              </td>
            </tr>
          ) : (
            displayedTransactions.map((transaction, index) => (
              <tr key={transaction.id}>
                <td>{index + 1}</td>
                <td className="user-id-cell" title={transaction.user_id}>
                  {transaction.user_id.substring(0, 8)}...
                </td>
                <td>{formatDescription(transaction)}</td>
                <td>{formatDate(transaction.created_at)}</td>
                <td className={transaction.amount > 0 ? 'amount-positive' : 'amount-negative'}>
                  {transaction.amount > 0 ? '+' : ''}
                  {transaction.amount.toLocaleString('tr-TR')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Load More Button */}
      {displayedTransactions.length < transactions.length && (
        <div className="load-more-section">
          <button
            className="load-more-btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'LOADING...' : 'LOAD MORE'}
          </button>
        </div>
      )}

      {displayedTransactions.length >= transactions.length && transactions.length > 0 && (
        <div style={{ textAlign: 'center', color: '#a8a8a8', marginTop: '20px' }}>
          All transactions loaded ({transactions.length} total)
        </div>
      )}
    </>
  );
}
