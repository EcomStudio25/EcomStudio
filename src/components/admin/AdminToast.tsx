'use client';

import { useState, useEffect } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const toastListeners: ((toast: ToastMessage) => void)[] = [];

export const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toast: ToastMessage = {
    id: toastId++,
    message,
    type
  };
  toastListeners.forEach((listener) => listener(toast));
};

export default function AdminToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };

    toastListeners.push(listener);

    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <>
      <style jsx>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .toast {
          min-width: 300px;
          max-width: 500px;
          padding: 16px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          font-size: 14px;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast.success {
          background: #1b3926;
          color: #4ade80;
          border: 1px solid #4ade80;
        }

        .toast.error {
          background: #300d0d;
          color: #ef4444;
          border: 1px solid #ef4444;
        }

        .toast.info {
          background: #1a2332;
          color: #0066ff;
          border: 1px solid #0066ff;
        }

        @media (max-width: 768px) {
          .toast-container {
            left: 20px;
            right: 20px;
          }

          .toast {
            min-width: auto;
            max-width: none;
          }
        }
      `}</style>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
