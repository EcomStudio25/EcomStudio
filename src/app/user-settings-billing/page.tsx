'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

interface BillingAddress {
  id: string;
  user_id: string;
  invoice_type: 'individual' | 'corporate';
  first_name?: string;
  last_name?: string;
  turkish_id?: string;
  company_name?: string;
  tax_office?: string;
  tax_number?: string;
  purchase_order?: string;
  authorized_person?: string;
  email: string;
  phone_number: string;
  address: string;
  country: string;
  city: string;
  state?: string;
  post_code: string;
  created_at: string;
}

interface IndividualFormData {
  first_name: string;
  last_name: string;
  turkish_id: string;
  email: string;
  phone_number: string;
  address: string;
  country: string;
  city: string;
  state: string;
  post_code: string;
}

interface CorporateFormData {
  company_name: string;
  tax_office: string;
  tax_number: string;
  purchase_order: string;
  authorized_person: string;
  email: string;
  phone_number: string;
  address: string;
  country: string;
  city: string;
  state: string;
  post_code: string;
}

export default function UserSettingsBillingPage() {
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
  const [addresses, setAddresses] = useState<BillingAddress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'individual' | 'corporate'>('individual');
  
  const [individualData, setIndividualData] = useState<IndividualFormData>({
    first_name: '',
    last_name: '',
    turkish_id: '',
    email: '',
    phone_number: '',
    address: '',
    country: '',
    city: '',
    state: '',
    post_code: ''
  });

  const [corporateData, setCorporateData] = useState<CorporateFormData>({
    company_name: '',
    tax_office: '',
    tax_number: '',
    purchase_order: '',
    authorized_person: '',
    email: '',
    phone_number: '',
    address: '',
    country: '',
    city: '',
    state: '',
    post_code: ''
  });

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
      await loadBillingAddresses(user.id);
      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'loadUserData');
      showToast(appError.userMessage, 'error');
      setLoading(false);
    }
  };

  const loadBillingAddresses = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('billing_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAddresses(data || []);
    } catch (error) {
      const appError = handleError(error, 'loadBillingAddresses');
      showToast(appError.userMessage, 'error');
      setAddresses([]);
    }
  };

  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('billing_addresses')
        .insert({
          user_id: currentUser.id,
          invoice_type: 'individual',
          ...individualData
        });

      if (error) throw error;

      showToast('Billing address saved successfully!', 'success');
      resetForm();
      await loadBillingAddresses(currentUser.id);
    } catch (error) {
      const appError = handleError(error, 'handleIndividualSubmit');
      showToast(appError.userMessage, 'error');
    }
  };

  const handleCorporateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('billing_addresses')
        .insert({
          user_id: currentUser.id,
          invoice_type: 'corporate',
          ...corporateData
        });

      if (error) throw error;

      showToast('Billing address saved successfully!', 'success');
      resetForm();
      await loadBillingAddresses(currentUser.id);
    } catch (error) {
      const appError = handleError(error, 'handleCorporateSubmit');
      showToast(appError.userMessage, 'error');
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const { error } = await supabase
        .from('billing_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;

      showToast('Address deleted successfully!', 'success');
      await loadBillingAddresses(currentUser.id);
    } catch (error) {
      const appError = handleError(error, 'deleteAddress');
      showToast(appError.userMessage, 'error');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setInvoiceType('individual');
    setIndividualData({
      first_name: '',
      last_name: '',
      turkish_id: '',
      email: '',
      phone_number: '',
      address: '',
      country: '',
      city: '',
      state: '',
      post_code: ''
    });
    setCorporateData({
      company_name: '',
      tax_office: '',
      tax_number: '',
      purchase_order: '',
      authorized_person: '',
      email: '',
      phone_number: '',
      address: '',
      country: '',
      city: '',
      state: '',
      post_code: ''
    });
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
            <a onClick={() => router.push('/user-settings-credits')} className="tab">
              USAGE & CREDITS
            </a>
            <span className="tab-separator">|</span>
            <a onClick={() => router.push('/user-settings-billing')} className="tab active">
              BILLING SETTINGS
            </a>
          </div>
        </div>

        {/* Billing Section */}
        <div className="content-section">
          <h2 className="section-title">BILLING INFORMATION</h2>
          <p className="section-subtitle">
            Please include your personal or company information so it displays properly on your invoices.
          </p>

          {/* Saved Addresses */}
          <h3 className="saved-addresses-title">SAVED BILLING ADDRESSES</h3>
          <div className="saved-addresses-list">
            {addresses.length === 0 ? (
              <div className="empty-state">There is no billing address saved.</div>
            ) : (
              addresses.map((addr) => (
                <div key={addr.id} className="address-card">
                  <div className="address-type-badge">
                    {addr.invoice_type === 'corporate' ? 'CORPORATE INVOICE' : 'INDIVIDUAL INVOICE'}
                  </div>
                  <div className="address-company">
                    {addr.invoice_type === 'corporate' 
                      ? addr.company_name 
                      : `${addr.first_name} ${addr.last_name}`}
                  </div>
                  <div className="address-details">
                    Address: {addr.address}<br />
                    {addr.state && `State: ${addr.state} `}
                    City: {addr.city} Post Code: {addr.post_code}
                  </div>
                  <div className="address-actions">
                    <button className="btn-icon" onClick={() => deleteAddress(addr.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button className="btn-primary" onClick={() => setShowForm(true)}>
            ADD NEW BILLING ADDRESS
          </button>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="form-section show">
              <p className="section-subtitle">
                Please include your personal or company information so it displays properly on your invoices.<br />
                Please ensure that this information is correct.
              </p>

              {/* Invoice Type Selector */}
              <div className="invoice-type-selector">
                <div className="radio-option">
                  <input 
                    type="radio" 
                    id="individualRadio" 
                    checked={invoiceType === 'individual'}
                    onChange={() => setInvoiceType('individual')}
                  />
                  <label htmlFor="individualRadio">Individual invoice</label>
                </div>
                <div className="radio-option">
                  <input 
                    type="radio" 
                    id="corporateRadio" 
                    checked={invoiceType === 'corporate'}
                    onChange={() => setInvoiceType('corporate')}
                  />
                  <label htmlFor="corporateRadio">Corporate invoice</label>
                </div>
              </div>

              {/* Individual Form */}
              {invoiceType === 'individual' && (
                <form onSubmit={handleIndividualSubmit}>
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Name"
                        value={individualData.first_name}
                        onChange={(e) => setIndividualData({...individualData, first_name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Surname</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Surname"
                        value={individualData.last_name}
                        onChange={(e) => setIndividualData({...individualData, last_name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Turkish ID Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Turkish ID Number"
                        maxLength={11}
                        value={individualData.turkish_id}
                        onChange={(e) => setIndividualData({...individualData, turkish_id: e.target.value})}
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">E-mail</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="E-mail"
                        value={individualData.email}
                        onChange={(e) => setIndividualData({...individualData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Phone Number</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="Phone Number"
                        value={individualData.phone_number}
                        onChange={(e) => setIndividualData({...individualData, phone_number: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Address</label>
                      <textarea 
                        className="form-textarea" 
                        placeholder="Address"
                        value={individualData.address}
                        onChange={(e) => setIndividualData({...individualData, address: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Country</label>
                      <select 
                        className="form-select"
                        value={individualData.country}
                        onChange={(e) => setIndividualData({...individualData, country: e.target.value})}
                        required
                      >
                        <option value="">Country</option>
                        <option value="Turkey">Turkey</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Germany">Germany</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">City</label>
                      <select 
                        className="form-select"
                        value={individualData.city}
                        onChange={(e) => setIndividualData({...individualData, city: e.target.value})}
                        required
                      >
                        <option value="">City</option>
                        <option value="Istanbul">Istanbul</option>
                        <option value="Ankara">Ankara</option>
                        <option value="Izmir">Izmir</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">State</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="State"
                        value={individualData.state}
                        onChange={(e) => setIndividualData({...individualData, state: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="form-label">Post Code</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Post Code"
                        value={individualData.post_code}
                        onChange={(e) => setIndividualData({...individualData, post_code: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={resetForm}>
                      CANCEL
                    </button>
                    <button type="submit" className="btn-primary">
                      SAVE
                    </button>
                  </div>
                </form>
              )}

              {/* Corporate Form */}
              {invoiceType === 'corporate' && (
                <form onSubmit={handleCorporateSubmit}>
                  <div className="form-grid">
                    <div className="form-group-full">
                      <label className="form-label">Company Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Company Name"
                        value={corporateData.company_name}
                        onChange={(e) => setCorporateData({...corporateData, company_name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Tax Office</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Tax Office"
                        value={corporateData.tax_office}
                        onChange={(e) => setCorporateData({...corporateData, tax_office: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Tax Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Tax Number"
                        value={corporateData.tax_number}
                        onChange={(e) => setCorporateData({...corporateData, tax_number: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Purchase Order (Optional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Purchase Order (Optional)"
                        value={corporateData.purchase_order}
                        onChange={(e) => setCorporateData({...corporateData, purchase_order: e.target.value})}
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Authorized Person (Name and Surname)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Authorized Person (Name and Surname)"
                        value={corporateData.authorized_person}
                        onChange={(e) => setCorporateData({...corporateData, authorized_person: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">E-mail</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="E-mail"
                        value={corporateData.email}
                        onChange={(e) => setCorporateData({...corporateData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Phone Number</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="Phone Number"
                        value={corporateData.phone_number}
                        onChange={(e) => setCorporateData({...corporateData, phone_number: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group-full">
                      <label className="form-label">Address</label>
                      <textarea 
                        className="form-textarea" 
                        placeholder="Address"
                        value={corporateData.address}
                        onChange={(e) => setCorporateData({...corporateData, address: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Country</label>
                      <select 
                        className="form-select"
                        value={corporateData.country}
                        onChange={(e) => setCorporateData({...corporateData, country: e.target.value})}
                        required
                      >
                        <option value="">Country</option>
                        <option value="Turkey">Turkey</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Germany">Germany</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">City</label>
                      <select 
                        className="form-select"
                        value={corporateData.city}
                        onChange={(e) => setCorporateData({...corporateData, city: e.target.value})}
                        required
                      >
                        <option value="">City</option>
                        <option value="Istanbul">Istanbul</option>
                        <option value="Ankara">Ankara</option>
                        <option value="Izmir">Izmir</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">State</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="State"
                        value={corporateData.state}
                        onChange={(e) => setCorporateData({...corporateData, state: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="form-label">Post Code</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Post Code"
                        value={corporateData.post_code}
                        onChange={(e) => setCorporateData({...corporateData, post_code: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={resetForm}>
                      CANCEL
                    </button>
                    <button type="submit" className="btn-primary">
                      SAVE
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
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
          margin-bottom: 10px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .section-subtitle {
          font-size: 13px;
          color: #999999;
          margin-bottom: 30px;
          line-height: 1.6;
        }

        .saved-addresses-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-bottom: 20px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .saved-addresses-list {
          margin-bottom: 30px;
        }

        .address-card {
          background: #2a2a2e;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 15px;
          position: relative;
        }

        .address-type-badge {
          display: inline-block;
          background: #0066ec;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .address-company {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
        }

        .address-details {
          font-size: 13px;
          color: #cccccc;
          line-height: 1.6;
        }

        .address-actions {
          position: absolute;
          top: 20px;
          right: 20px;
        }

        .btn-icon {
          background: transparent;
          border: 1px solid #555555;
          color: #cccccc;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-icon:hover {
          background: #333333;
          border-color: #777777;
          color: #ffffff;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666666;
          font-size: 15px;
          background: #111111;
          border-radius: 10px;
          margin-bottom: 30px;
        }

        .btn-primary {
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 14px 32px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0, 102, 236, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .form-section {
          margin-top: 40px;
          padding-top: 40px;
          border-top: 1px solid #333333;
        }

        .invoice-type-selector {
          display: flex;
          gap: 30px;
          margin-bottom: 30px;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .radio-option input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .radio-option label {
          font-size: 14px;
          color: #cccccc;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-group-full {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          font-size: 13px;
          color: #cccccc;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .form-input,
        .form-select,
        .form-textarea {
          background: #0a0a0a;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          color: #ffffff;
          font-family: inherit;
          width: 100%;
          transition: border-color 0.3s;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #0066ec;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #666666;
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }

        .form-select {
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 30px;
        }

        .btn-cancel {
          background: transparent;
          color: #cccccc;
          border: 1px solid #555555;
          border-radius: 8px;
          padding: 14px 32px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-cancel:hover {
          background: #222222;
          border-color: #777777;
          color: #ffffff;
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

          .form-grid {
            grid-template-columns: 1fr;
          }

          .address-actions {
            position: static;
            margin-top: 15px;
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}