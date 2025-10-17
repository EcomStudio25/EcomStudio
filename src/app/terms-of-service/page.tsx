'use client';

import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import TermsOfServiceContent from '@/components/legal/TermsOfServiceContent';

export default function TermsOfServicePage() {
  return (
    <AuthenticatedLayout>
      <style jsx>{`
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 60px 20px;
        }

        .header {
          text-align: center;
          margin-bottom: 60px;
        }

        h1 {
          font-size: 36px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 15px;
        }

        .last-updated {
          font-size: 14px;
          color: #999999;
        }

        .important-notice {
          background: #1a1a1a;
          border-left: 4px solid #0066ec;
          padding: 20px 25px;
          border-radius: 8px;
          margin-bottom: 40px;
        }

        .important-notice h3 {
          color: #0066ec;
          font-size: 16px;
          margin-bottom: 10px;
        }

        .important-notice p {
          font-size: 14px;
          color: #cccccc;
        }

        .content {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 50px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        h2 {
          font-size: 24px;
          font-weight: 700;
          margin-top: 40px;
          margin-bottom: 20px;
          color: #ffffff;
          letter-spacing: 1px;
        }

        h2:first-child {
          margin-top: 0;
        }

        h3 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 30px;
          margin-bottom: 15px;
          color: #cccccc;
        }

        p {
          margin-bottom: 15px;
          color: #cccccc;
          font-size: 15px;
        }

        ul, ol {
          margin-left: 25px;
          margin-bottom: 20px;
          color: #cccccc;
        }

        li {
          margin-bottom: 10px;
          font-size: 15px;
        }

        strong {
          color: #ffffff;
          font-weight: 600;
        }

        .section {
          margin-bottom: 40px;
        }

        .contact-info {
          background: #111111;
          padding: 20px;
          border-radius: 8px;
          margin-top: 30px;
        }

        .contact-info p {
          margin-bottom: 8px;
        }

        a {
          color: #0066ec;
          text-decoration: none;
          transition: color 0.3s;
        }

        a:hover {
          color: #0052be;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .content {
            padding: 30px 20px;
          }

          h1 {
            font-size: 28px;
          }

          h2 {
            font-size: 20px;
          }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1>TERMS OF SERVICE</h1>
          <p className="last-updated">Last Updated: October 16, 2025</p>
        </div>

        <div className="important-notice">
          <h3>⚠️ Important Notice</h3>
          <p>By using the services provided at www.ecomstudio.com.tr, you are deemed to have accepted the following terms and conditions. If you do not accept these terms, please do not use the platform.</p>
        </div>

        <div className="content">
          <TermsOfServiceContent />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
