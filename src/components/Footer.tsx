'use client';

export default function Footer() {
  return (
    <>
      <style jsx>{`
        .footer {
          background: #000000;
          padding: 50px 40px;
          text-align: center;
          border-top: 1px solid #1a1a1a;
          margin-top: 60px;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer-logo {
          margin-bottom: 15px;
          text-align: center;
        }

        .footer-logo img {
          height: 28px;
          width: auto;
          display: block;
          margin: 0 auto;
        }

        .footer-tagline {
          margin-bottom: 30px;
          font-size: 14px;
          color: #999999;
          font-weight: 400;
        }

        .footer-links {
          margin-bottom: 35px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          font-weight: 400;
          transition: color 0.3s;
          cursor: pointer;
        }

        .footer-link:hover {
          color: #ffffff;
        }

        .footer-separator {
          color: #333333;
          font-size: 13px;
        }

        .social-icons {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }

        .social-icon {
          cursor: pointer;
          transition: all 0.3s;
          display: inline-block;
        }

        .social-icon:hover {
          transform: translateY(-3px);
          opacity: 0.8;
        }

        .social-icon img {
          width: 48px;
          height: 48px;
          display: block;
        }

        .footer-email {
          margin-top: 5px;
          font-size: 13px;
          color: #999999;
        }

        .footer-email a {
          color: #ffffff;
          text-decoration: none;
          transition: opacity 0.3s;
        }

        .footer-email a:hover {
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .footer {
            padding: 40px 20px;
          }

          .footer-links {
            flex-direction: column;
            gap: 10px;
          }

          .footer-separator {
            display: none;
          }
        }
      `}</style>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-logo">
            <img src="/ECOM_STUDIO_LOGO.png" alt="ECOM STUDIO" />
          </div>
          <div className="footer-tagline">
            Prodüksiyon, Reklam ve Danışmanlık A.Ş.
          </div>
          <div className="footer-links">
            <a href="https://www.ecomstudio.com.tr" className="footer-link" target="_blank" rel="noopener noreferrer">Homepage</a>
            <span className="footer-separator">|</span>
            <a href="/about-us" className="footer-link">About Us</a>
            <span className="footer-separator">|</span>
            <a href="/pricing" className="footer-link">Pricing</a>
            <span className="footer-separator">|</span>
            <a href="/help-center" className="footer-link">Help Center</a>
            <span className="footer-separator">|</span>
            <a href="/privacy-policy" className="footer-link">Privacy Policy</a>
            <span className="footer-separator">|</span>
            <a href="/terms-of-service" className="footer-link">Terms of Service</a>
          </div>
          <div className="social-icons">
            <a href="https://instagram.com/ecomstudio" className="social-icon" title="Instagram" target="_blank" rel="noopener noreferrer">
              <img src="/icon_SM_INS.svg" alt="Instagram" />
            </a>
            <a href="https://youtube.com/@ecomstudio" className="social-icon" title="YouTube" target="_blank" rel="noopener noreferrer">
              <img src="/icon_SM_YT.svg" alt="YouTube" />
            </a>
            <a href="https://linkedin.com/company/ecomstudio" className="social-icon" title="LinkedIn" target="_blank" rel="noopener noreferrer">
              <img src="/icon_SM_IN.svg" alt="LinkedIn" />
            </a>
          </div>
          <div className="footer-email">
            E-mail: <a href="mailto:support@ecomstudio.com.tr">support@ecomstudio.com.tr</a>
          </div>
        </div>
      </footer>
    </>
  );
}