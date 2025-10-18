'use client';

interface MethodSelectorProps {
  currentMethod: string;
  onSelectMethod: (method: string) => void;
}

export default function MethodSelector({
  currentMethod,
  onSelectMethod,
}: MethodSelectorProps) {
  const methods = [
    {
      id: 'computer',
      icon: '/icon_method_from_computer.png',
      title: 'From Computer',
      subtitle: 'Upload images',
    },
    {
      id: 'library',
      icon: '/icon_method_from_library.png',
      title: 'From Library',
      subtitle: 'Use saved images',
    },
    {
      id: 'url',
      icon: '/icon_method_from_url.png',
      title: 'From URL',
      subtitle: 'Fetch from website',
    },
    {
      id: 'batch',
      icon: '/icon_method_from_xls.png',
      title: 'Batch Processing',
      subtitle: 'from Excel file (Max. 50 URL)',
    },
  ];

  return (
    <div className="method-selector">
      <h3>Please choose an image upload method:</h3>
      <div className="method-cards">
        {methods.map((method) => (
          <div
            key={method.id}
            className={`method-card ${
              currentMethod === method.id
                ? 'active'
                : currentMethod
                ? 'inactive'
                : ''
            }`}
            onClick={() => onSelectMethod(method.id)}
          >
            <img src={method.icon} alt={method.title} className="method-icon" />
            <div className="method-title">{method.title}</div>
            <div className="method-subtitle">{method.subtitle}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .method-selector {
          text-align: center;
          margin-bottom: 50px;
        }

        .method-selector h3 {
          font-size: 18px;
          font-weight: 400;
          color: #999;
          margin-bottom: 30px;
          letter-spacing: 1px;
        }

        .method-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .method-card {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border: 2px solid #333;
          border-radius: 15px;
          padding: 40px 20px;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 1;
          position: relative;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .method-card:hover {
          border-color: #0066ff;
          transform: translateY(-5px);
        }

        .method-card.inactive {
          opacity: 0.4;
        }

        .method-card.active {
          border-color: #0066ff;
          background: #2d3a4d;
          opacity: 1;
        }

        .method-icon {
          width: 160px;
          height: 120px;
          margin: 0 auto 20px;
          display: block;
          filter: grayscale(1);
          opacity: 0.5;
          transition: all 0.3s;
        }

        .method-card.active .method-icon {
          filter: grayscale(0);
          opacity: 1;
        }

        .method-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 8px;
        }

        .method-subtitle {
          font-size: 12px;
          color: #888;
        }

        @media (max-width: 1200px) {
          .method-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .method-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
