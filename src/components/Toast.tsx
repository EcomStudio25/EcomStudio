'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'video-ready';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  onClick?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, onClick?: () => void) => void;
  showVideoReadyToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider(props: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'info', onClick?: () => void) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type, onClick }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const showVideoReadyToast = () => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, {
      id,
      message: 'YOUR VIDEO IS READY\nClick here to watch the video.',
      type: 'video-ready',
      onClick: () => {
        // Navigate using window.location for client-side navigation
        if (typeof window !== 'undefined') {
          window.location.href = '/video-assets';
        }
      }
    }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 8000); // Video ready toast stays longer (8 seconds)
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const providerValue: ToastContextType = {
    showToast: showToast,
    showVideoReadyToast: showVideoReadyToast
  };

  return (
    <ToastContext.Provider value={providerValue}>
      {props.children}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => {
          return (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClick={toast.onClick}
              onClose={() => removeToast(toast.id)}
            />
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

interface ToastProps {
  message: string;
  type: ToastType;
  onClick?: () => void;
  onClose: () => void;
}

function Toast(props: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(props.onClose, 300);
  };

  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
    }
  };

  const getIcon = () => {
    switch (props.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'video-ready':
        return '✓';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const toastClasses = [
    styles.toastItem,
    styles[props.type],
    isVisible ? styles.visible : '',
    props.onClick ? styles.clickable : ''
  ].filter(Boolean).join(' ');

  // Special rendering for video-ready toast
  if (props.type === 'video-ready') {
    const lines = props.message.split('\n');
    return (
      <div className={toastClasses} onClick={handleClick}>
        <div className={styles.toastIcon}>{getIcon()}</div>
        <div className={styles.toastMessage}>
          <div className={styles.videoReadyTitle}>{lines[0]}</div>
          <div className={styles.videoReadySubtitle}>{lines[1]}</div>
        </div>
        <button
          className={styles.toastClose}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          type="button"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className={toastClasses} onClick={handleClick}>
      <div className={styles.toastIcon}>{getIcon()}</div>
      <div className={styles.toastMessage}>{props.message}</div>
      <button
        className={styles.toastClose}
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        type="button"
      >
        ✕
      </button>
    </div>
  );
}