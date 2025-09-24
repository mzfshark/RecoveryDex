// src/components/NotificationSystem.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiInfo, FiCheck, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import styles from '../styles/Global.module.css';

// Notification types
const NOTIFICATION_TYPES = {
  info: { icon: FiInfo, color: '#3b82f6', bgColor: '#eff6ff' },
  success: { icon: FiCheck, color: '#10b981', bgColor: '#f0fdf4' },
  warning: { icon: FiAlertTriangle, color: '#f59e0b', bgColor: '#fffbeb' },
  error: { icon: FiAlertCircle, color: '#ef4444', bgColor: '#fef2f2' }
};

let notificationId = 0;

// Global notification manager
class NotificationManager {
  constructor() {
    this.listeners = [];
    this.notifications = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(type, title, message, duration = 15000) {
    const id = ++notificationId;
    const notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      duration
    };

    this.notifications.push(notification);
    this.listeners.forEach(callback => callback([...this.notifications]));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.listeners.forEach(callback => callback([...this.notifications]));
  }

  clear() {
    this.notifications = [];
    this.listeners.forEach(callback => callback([]));
  }

  // Convenience methods
  info(title, message, duration) { return this.notify('info', title, message, duration); }
  success(title, message, duration) { return this.notify('success', title, message, duration); }
  warning(title, message, duration) { return this.notify('warning', title, message, duration); }
  error(title, message, duration) { return this.notify('error', title, message, duration); }
}

// Global instance
export const notificationManager = new NotificationManager();

// Individual notification component
const NotificationItem = ({ notification, onRemove }) => {
  const { type, title, message, id } = notification;
  const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
  const IconComponent = config.icon;

  const notificationStyle = {
    backgroundColor: config.bgColor,
    borderLeft: `4px solid ${config.color}`,
    color: '#1f2937',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    animation: 'slideInRight 0.3s ease-out',
    maxWidth: '400px',
    wordBreak: 'break-word'
  };

  return (
    <div style={notificationStyle}>
      <IconComponent 
        size={20} 
        style={{ color: config.color, marginTop: '2px', flexShrink: 0 }} 
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: '13px', opacity: 0.8, lineHeight: '1.4' }}>
            {message}
          </div>
        )}
      </div>
      <button
        onClick={() => onRemove(id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
          transition: 'opacity 0.4s'
        }}
        onMouseEnter={e => e.target.style.opacity = '5'}
        onMouseLeave={e => e.target.style.opacity = '1.6'}
      >
        <FiX size={16} />
      </button>
    </div>
  );
};

// Main notification system component
const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  const removeNotification = useCallback((id) => {
    notificationManager.remove(id);
  }, []);

  if (notifications.length === 0) return null;

  const containerStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    pointerEvents: 'none'
  };

  return (
    <>
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={containerStyle}>
        {notifications.map(notification => (
          <div key={notification.id} style={{ pointerEvents: 'auto' }}>
            <NotificationItem
              notification={notification}
              onRemove={removeNotification}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationSystem;