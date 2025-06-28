import type React from "react";
import { useEffect } from "react";
import {
	initializeNotificationService,
	setupNotificationListeners,
} from "~/utils/notifications";

interface NotificationProviderProps {
	children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
	children,
}) => {
	useEffect(() => {
		const initializeNotifications = async () => {
			try {
				// Initialize notification service
				await initializeNotificationService();

				// Setup event listeners
				setupNotificationListeners();
			} catch (error) {
				console.error("Failed to initialize notification service:", error);
			}
		};

		initializeNotifications();
	}, []);

	return <>{children}</>;
};
