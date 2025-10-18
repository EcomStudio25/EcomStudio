'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { showAdminToast } from './AdminToast';

interface UserListProps {
  supabase: SupabaseClient;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone_number: string;
  credits: number;
  created_at: string;
  billing_address: string;
}

interface UserStats {
  favorites: number;
  videos: number;
  generatedImages: number;
  uploadedImages: number;
  creditSpend: number;
}

export default function UserList({ supabase }: UserListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [addCreditAmount, setAddCreditAmount] = useState('');
  const [addingCredit, setAddingCredit] = useState(false);

  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, filterBy, sortAsc]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term) ||
          user.company_name?.toLowerCase().includes(term) ||
          user.phone_number?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (filterBy) {
        case 'name':
          aVal = a.full_name || '';
          bVal = b.full_name || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'company':
          aVal = a.company_name || '';
          bVal = b.company_name || '';
          break;
        case 'date':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
    });

    setFilteredUsers(filtered);
    setCurrentPage(0);
  };

  const loadUserStats = async (userId: string) => {
    try {
      // Favorites
      const { count: favCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .eq('file_type', 'video');

      // Videos
      const { count: vidCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('folder', 'video-assets');

      // Generated Images
      const { count: genImgCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('folder', 'image-assets');

      // Uploaded Images
      const { count: uplImgCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('folder', 'uploads');

      // Credit spend (negative transactions)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .lt('amount', 0);

      const creditSpend = Math.abs(
        transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
      );

      setUserStats({
        favorites: favCount || 0,
        videos: vidCount || 0,
        generatedImages: genImgCount || 0,
        uploadedImages: uplImgCount || 0,
        creditSpend
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
      setUserStats({
        favorites: 0,
        videos: 0,
        generatedImages: 0,
        uploadedImages: 0,
        creditSpend: 0
      });
    }
  };

  const openUserLightbox = async (user: UserProfile) => {
    setSelectedUser(user);
    setUserStats(null);
    setAddCreditAmount('');
    await loadUserStats(user.id);
  };

  const closeLightbox = () => {
    setSelectedUser(null);
    setUserStats(null);
    setAddCreditAmount('');
  };

  const handleAddCredit = async () => {
    if (!selectedUser || !addCreditAmount || addingCredit) return;

    const amount = parseInt(addCreditAmount);
    if (isNaN(amount) || amount <= 0) {
      showAdminToast('Please enter a valid credit amount', 'error');
      return;
    }

    try {
      setAddingCredit(true);

      // Update user credits
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: selectedUser.credits + amount })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      // Add transaction record
      const { error: transError } = await supabase
        .from('transactions')
        .insert({
          user_id: selectedUser.id,
          description: 'Manual Credit Addition',
          amount: amount,
          transaction_type: 'manual_credit_addition'
        });

      if (transError) throw transError;

      showAdminToast(`Successfully added ${amount} credits to ${selectedUser.full_name}`, 'success');

      // Reload users and update selectedUser
      await loadUsers();
      const updatedUser = { ...selectedUser, credits: selectedUser.credits + amount };
      setSelectedUser(updatedUser);
      setAddCreditAmount('');
      setAddingCredit(false);
    } catch (error) {
      console.error('Error adding credits:', error);
      showAdminToast('Failed to add credits. Please try again.', 'error');
      setAddingCredit(false);
    }
  };

  const paginatedUsers = filteredUsers.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>Loading users...</div>;
  }

  return (
    <>
      <style jsx>{`
        .search-filter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 20px;
        }

        .search-box {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .search-box label {
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .search-box input {
          flex: 1;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
        }

        .search-box input::placeholder {
          color: #666;
        }

        .filter-box {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-box label {
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .filter-box select {
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
          cursor: pointer;
        }

        .sort-btn {
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
          font-weight: 600;
        }

        .sort-btn:hover {
          background-color: #1a1a1a;
        }

        .user-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }

        .user-table thead {
          background-color: #000000;
        }

        .user-table th {
          padding: 15px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #ffffff;
        }

        .user-table tbody tr {
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .user-table tbody tr:nth-child(odd) {
          background-color: #1b1c1e;
        }

        .user-table tbody tr:nth-child(even) {
          background-color: #141516;
        }

        .user-table tbody tr:hover {
          background-color: #252628;
        }

        .user-table td {
          padding: 18px 15px;
          font-size: 14px;
          color: #ffffff;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .page-btn {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
          min-width: 45px;
        }

        .page-btn:hover {
          background: linear-gradient(to bottom, #3a3a3e, #252528);
        }

        .page-btn.active {
          background: #1b3926;
          font-weight: 700;
        }

        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Lightbox */
        .lightbox {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          justify-content: center;
          align-items: center;
          overflow-y: auto;
          padding: 20px;
        }

        .lightbox.show {
          display: flex;
        }

        .lightbox-content {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 20px;
          padding: 40px;
          max-width: 1000px;
          width: 90%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }

        .lightbox-close {
          position: absolute;
          top: 20px;
          right: 20px;
          font-size: 32px;
          cursor: pointer;
          color: #a8a8a8;
          transition: color 0.3s;
          font-weight: 300;
          line-height: 1;
        }

        .lightbox-close:hover {
          color: #ffffff;
        }

        .lightbox-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 30px;
          text-align: center;
          letter-spacing: 1px;
          color: #ffffff;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
        }

        .detail-box {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 25px;
        }

        .detail-box-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 20px;
          letter-spacing: 0.5px;
          color: #ffffff;
        }

        .detail-row {
          display: flex;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .detail-label {
          color: #a8a8a8;
          margin-right: 10px;
          min-width: 140px;
        }

        .detail-value {
          color: #ffffff;
          font-weight: 500;
        }

        .credit-info {
          margin-bottom: 20px;
        }

        .credit-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }

        .credit-row-label {
          color: #a8a8a8;
        }

        .credit-row-value {
          color: #ffffff;
          font-weight: 700;
          font-size: 16px;
        }

        .add-credit {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-top: 20px;
        }

        .add-credit-label {
          font-size: 14px;
          white-space: nowrap;
          color: #ffffff;
        }

        .add-credit-input {
          flex: 1;
          background-color: #000000;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 10px 15px;
          color: #ffffff;
          font-size: 14px;
          text-align: center;
        }

        .add-credit-btn {
          background-color: #0066ff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.3s;
          text-transform: uppercase;
          font-size: 12px;
        }

        .add-credit-btn:hover {
          background-color: #0052cc;
        }

        .add-credit-btn:disabled {
          background-color: #444;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .search-filter {
            flex-direction: column;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .lightbox-content {
            padding: 30px 20px;
          }
        }
      `}</style>

      {/* Search and Filter */}
      <div className="search-filter">
        <div className="search-box">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <label>Filter by:</label>
          <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="company">Company</option>
            <option value="date">Date</option>
          </select>
          <button className="sort-btn" onClick={() => setSortAsc(!sortAsc)}>
            ⇅
          </button>
        </div>
      </div>

      {/* User Table */}
      <table className="user-table">
        <thead>
          <tr>
            <th>#</th>
            <th>DISPLAY NAME</th>
            <th>E-MAIL</th>
            <th>COMPANY</th>
            <th>CREDIT</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUsers.map((user, index) => (
            <tr key={user.id} onClick={() => openUserLightbox(user)}>
              <td>{currentPage * ITEMS_PER_PAGE + index + 1}</td>
              <td>{user.full_name || 'N/A'}</td>
              <td>{user.email || 'N/A'}</td>
              <td>{user.company_name || 'N/A'}</td>
              <td>{(user.credits || 0).toLocaleString('tr-TR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
        >
          PREVIOUS
        </button>
        {Array.from({ length: Math.min(8, totalPages) }, (_, i) => {
          const pageNum = i;
          return (
            <button
              key={pageNum}
              className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => setCurrentPage(pageNum)}
            >
              {pageNum + 1}
            </button>
          );
        })}
        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
        >
          NEXT
        </button>
      </div>

      {/* User Details Lightbox */}
      <div className={`lightbox ${selectedUser ? 'show' : ''}`} onClick={closeLightbox}>
        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          <span className="lightbox-close" onClick={closeLightbox}>
            &times;
          </span>
          <h3 className="lightbox-title">USER DETAILS</h3>

          {selectedUser && (
            <div className="details-grid">
              {/* Profile Information */}
              <div className="detail-box">
                <div className="detail-box-title">PROFILE INFORMATION</div>
                <div className="detail-row">
                  <span className="detail-label">Full Name</span>
                  <span className="detail-value">: {selectedUser.full_name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">E-mail</span>
                  <span className="detail-value">: {selectedUser.email || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Company Name</span>
                  <span className="detail-value">: {selectedUser.company_name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone Number</span>
                  <span className="detail-value">: {selectedUser.phone_number || 'N/A'}</span>
                </div>
              </div>

              {/* Usage */}
              <div className="detail-box">
                <div className="detail-box-title">USAGE</div>
                {userStats ? (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Favorites</span>
                      <span className="detail-value">: {userStats.favorites}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Produced Videos</span>
                      <span className="detail-value">: {userStats.videos}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Generated Images</span>
                      <span className="detail-value">: {userStats.generatedImages}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Uploaded Images</span>
                      <span className="detail-value">: {userStats.uploadedImages}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: '#a8a8a8', padding: '20px' }}>
                    Loading stats...
                  </div>
                )}
              </div>

              {/* Credits */}
              <div className="detail-box">
                <div className="detail-box-title">CREDITS</div>
                <div className="credit-info">
                  <div className="credit-row">
                    <span className="credit-row-label">Current Credits:</span>
                    <span className="credit-row-value">
                      {(selectedUser.credits || 0).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  {userStats && (
                    <div className="credit-row">
                      <span className="credit-row-label">Credit Spend:</span>
                      <span className="credit-row-value">
                        {userStats.creditSpend.toLocaleString('tr-TR')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="add-credit">
                  <label className="add-credit-label">Add Credits:</label>
                  <input
                    type="number"
                    className="add-credit-input"
                    placeholder="0"
                    value={addCreditAmount}
                    onChange={(e) => setAddCreditAmount(e.target.value)}
                  />
                  <button
                    className="add-credit-btn"
                    onClick={handleAddCredit}
                    disabled={addingCredit}
                  >
                    {addingCredit ? 'ADDING...' : 'ADD'}
                  </button>
                </div>
              </div>

              {/* Billing Address */}
              <div className="detail-box">
                <div className="detail-box-title">BILLING ADDRESS</div>
                <div className="detail-value" style={{ lineHeight: 1.6 }}>
                  {selectedUser.billing_address || 'No billing address provided'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
