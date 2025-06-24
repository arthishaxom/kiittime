import React, { useEffect } from 'react';
import { initializeNotificationService, setupNotificationListeners } from '~/utils/notifications';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Initialize notification service
        await initializeNotificationService();
        
        // Setup event listeners
        setupNotificationListeners();
        
        console.log('Notification service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    };

    initializeNotifications();
  }, []);

  return <>{children}</>;
}; 