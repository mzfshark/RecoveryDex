// src/services/notificationService.js
// Simple notification service that can work with or without the UI notification system

let notificationManager = null;

// Function to set the notification manager (called by App after initialization)
export function setNotificationManager(manager) {
  notificationManager = manager;
}

// Helper for notifications that work even when notification system is not available
export const notify = {
  info: (title, message, duration = 3000) => {
    console.log(`[INFO] ${title}: ${message}`);
    if (notificationManager) {
      try {
        notificationManager.info(title, message, duration);
      } catch (e) {
        console.warn('Notification manager error:', e);
      }
    }
  },
  success: (title, message, duration = 4000) => {
    console.log(`[SUCCESS] ${title}: ${message}`);
    if (notificationManager) {
      try {
        notificationManager.success(title, message, duration);
      } catch (e) {
        console.warn('Notification manager error:', e);
      }
    }
  },
  warning: (title, message, duration = 5000) => {
    console.log(`[WARNING] ${title}: ${message}`);
    if (notificationManager) {
      try {
        notificationManager.warning(title, message, duration);
      } catch (e) {
        console.warn('Notification manager error:', e);
      }
    }
  },
  error: (title, message, duration = 6000) => {
    console.error(`[ERROR] ${title}: ${message}`);
    if (notificationManager) {
      try {
        notificationManager.error(title, message, duration);
      } catch (e) {
        console.warn('Notification manager error:', e);
      }
    }
  }
};