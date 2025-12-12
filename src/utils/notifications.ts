import notifee, {
	AndroidImportance,
	AndroidNotificationSetting,
	AndroidStyle,
	EventType,
	RepeatFrequency,
	type TimestampTrigger,
	TriggerType,
} from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { GroupedSchedule, ScheduleSlot } from "~/src/store/timetableState";

// Storage keys
const NOTIFICATION_SETTINGS_KEY = "notification_settings";
const NOTIFICATION_CHANNEL_ID = "class_notifications";

// Notification settings interface
export interface NotificationSettings {
	enabled: boolean;
	minutesBefore: number;
	lastUpdated: number;
}

// Default notification settings
const DEFAULT_SETTINGS: NotificationSettings = {
	enabled: true,
	minutesBefore: 0,
	lastUpdated: Date.now(),
};

/**
 * Check if exact alarm permission is granted (required for Android 12+)
 */
export const checkExactAlarmPermission = async (): Promise<boolean> => {
	try {
		const settings = await notifee.getNotificationSettings();
		return settings.android?.alarm === AndroidNotificationSetting.ENABLED;
	} catch (error) {
		console.error("Failed to check alarm permission:", error);
		return false;
	}
};

/**
 * Open alarm permission settings for Android 12+
 */
export const openAlarmPermissionSettings = async (): Promise<void> => {
	try {
		await notifee.openAlarmPermissionSettings();
	} catch (error) {
		console.error("Failed to open alarm permission settings:", error);
	}
};

/**
 * Initialize notification service
 * Sets up channels and permissions
 */
export const initializeNotificationService = async (): Promise<boolean> => {
	try {
		// Create notification channel for Android
		if (Platform.OS === "android") {
			await notifee.createChannel({
				id: NOTIFICATION_CHANNEL_ID,
				name: "Class Notifications",
				importance: AndroidImportance.HIGH,
				sound: "default",
				vibration: true,
				vibrationPattern: [300, 500],
				lights: true,
				badge: true,
			});
		}

		// Request permissions
		const settings = await notifee.requestPermission();
		return settings.authorizationStatus === 1; // 1 = authorized
	} catch (error) {
		console.error("Failed to initialize notification service:", error);
		return false;
	}
};

/**
 * Get notification settings from storage
 */
export const getNotificationSettings =
	async (): Promise<NotificationSettings> => {
		try {
			const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
			return settings
				? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) }
				: DEFAULT_SETTINGS;
		} catch (error) {
			console.error("Failed to get notification settings:", error);
			return DEFAULT_SETTINGS;
		}
	};

/**
 * Save notification settings to storage
 */
export const saveNotificationSettings = async (
	settings: Partial<NotificationSettings>,
): Promise<void> => {
	try {
		const currentSettings = await getNotificationSettings();
		const updatedSettings = {
			...currentSettings,
			...settings,
			lastUpdated: Date.now(),
		};
		await AsyncStorage.setItem(
			NOTIFICATION_SETTINGS_KEY,
			JSON.stringify(updatedSettings),
		);
	} catch (error) {
		console.error("Failed to save notification settings:", error);
	}
};

/**
 * Parse time string to get hour and minute
 * Handles formats like "10-11", "12-1", "8-9"
 */
const parseTimeString = (
	timeString: string,
): { hour: number; minute: number } => {
	// Handle formats like "10-11", "12-1", etc.
	const startTime = timeString.split("-")[0];
	let hour = parseInt(startTime, 10);

	// Convert to 24-hour format if needed
	// Assuming morning classes start from 8 AM
	if (hour < 8) {
		hour += 12; // Convert PM hours
	}

	return { hour, minute: 0 }; // Assuming classes start at the top of the hour
};

/**
 * Convert day abbreviation to weekday number (0 = Sunday, 1 = Monday, etc.)
 */
const getWeekdayNumber = (dayAbbr: string): number => {
	const dayMap: { [key: string]: number } = {
		SUN: 0,
		MON: 1,
		TUE: 2,
		WED: 3,
		THU: 4,
		FRI: 5,
		SAT: 6,
	};
	return dayMap[dayAbbr] ?? 1;
};

/**
 * Calculate the next occurrence of a specific day and time
 */
const getNextOccurrence = (
	targetDay: number,
	targetHour: number,
	targetMinute: number,
): Date => {
	const now = new Date();
	const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

	// Calculate days until next occurrence
	let daysUntilTarget = targetDay - currentDay;
	if (daysUntilTarget < 0) {
		daysUntilTarget += 7; // Next week
	}

	// Create the target date
	const targetDate = new Date();
	targetDate.setDate(now.getDate() + daysUntilTarget);
	targetDate.setHours(targetHour, targetMinute, 0, 0);

	// If it's today but the time has passed, move to next week
	if (daysUntilTarget === 0 && targetDate <= now) {
		targetDate.setDate(targetDate.getDate() + 7);
	}

	return targetDate;
};

/**
 * Schedule a single class notification with proper alarm manager configuration
 */
const scheduleClassNotification = async (
	classData: ScheduleSlot,
	minutesBefore: number,
): Promise<string> => {
	const { hour, minute } = parseTimeString(classData.Time);
	const weekday = getWeekdayNumber(classData.Day);

	let notificationMinute = minute - minutesBefore;
	let notificationHour = hour;

	// Handle negative minutes
	if (notificationMinute < 0) {
		notificationMinute += 60;
		notificationHour -= 1;
	}

	// Handle negative hours (previous day)
	if (notificationHour < 0) {
		notificationHour += 24;
		// Note: This would need additional logic to handle day changes
	}

	// Get the next occurrence of this class time
	const nextOccurrence = getNextOccurrence(
		weekday,
		notificationHour,
		notificationMinute,
	);

	const trigger: TimestampTrigger = {
		type: TriggerType.TIMESTAMP,
		timestamp: nextOccurrence.getTime(),
		repeatFrequency: RepeatFrequency.WEEKLY,
		alarmManager: {
			type: 3, // ELAPSED_REALTIME_WAKEUP - ensures device wakes up
			allowWhileIdle: true, // Allow when device is in doze mode
		},
	};

	const notificationId = await notifee.createTriggerNotification(
		{
			title: `Class in ${minutesBefore} minutes`,
			body: `${classData.Subject} at ${classData.Room} (${classData.Time})`,
			android: {
				channelId: NOTIFICATION_CHANNEL_ID,
				importance: AndroidImportance.HIGH,
				sound: "default",
				vibrationPattern: [300, 500],
				smallIcon: "notification_icon",
				color: "#FFA500", // Orange color
				autoCancel: true,
				pressAction: {
					id: "default",
					launchActivity: "default",
				},
				style: {
					type: AndroidStyle.BIGTEXT,
					text: `Subject: ${classData.Subject}\nRoom: ${classData.Room}\nTime: ${classData.Time}`,
				},
				// Additional flags for background execution
				ongoing: false,
				localOnly: false,
				showTimestamp: false,
				lightUpScreen: false,
				badgeIconType: 2,
				onlyAlertOnce: false,
			},
			data: {
				classId: `${classData.Day}_${classData.Time}_${classData.Subject}`,
				subject: classData.Subject,
				room: classData.Room,
				time: classData.Time,
				day: classData.Day,
			},
		},
		trigger,
	);

	return notificationId;
};

/**
 * Schedule notifications for all classes in the timetable
 */
export const scheduleAllClassNotifications = async (
	timetable: { [day: string]: ScheduleSlot[] },
	minutesBefore: number = 15,
): Promise<string[]> => {
	try {
		// Initialize notification service
		const hasPermission = await initializeNotificationService();
		if (!hasPermission) {
			throw new Error("Notification permission not granted");
		}

		// Check exact alarm permission for Android 12+
		if (Platform.OS === "android") {
			const hasExactAlarmPermission = await checkExactAlarmPermission();
			if (!hasExactAlarmPermission) {
				throw new Error(
					"Exact alarm permission not granted. Notifications may not work reliably on Android 12+.",
				);
			}
		}

		// Cancel existing notifications first
		await cancelAllNotifications();

		const notificationIds: string[] = [];
		const days = Object.keys(timetable);

		for (const day of days) {
			const classes = timetable[day];
			for (const classData of classes) {
				try {
					const notificationId = await scheduleClassNotification(
						classData,
						minutesBefore,
					);
					notificationIds.push(notificationId);
					// console.log(`Scheduled notification ${notificationId} for ${classData.Subject}`);
				} catch (error) {
					console.error(
						`Failed to schedule notification for ${classData.Subject}:`,
						error,
					);
				}
			}
		}

		// Save settings
		await saveNotificationSettings({ enabled: true, minutesBefore });

		// console.log(`Successfully scheduled ${notificationIds.length} notifications`);
		return notificationIds;
	} catch (error) {
		console.error("Failed to schedule class notifications:", error);
		throw error;
	}
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
	try {
		await notifee.cancelAllNotifications();
		// console.log("All notifications cancelled");
	} catch (error) {
		console.error("Failed to cancel notifications:", error);
	}
};

/**
 * Get all scheduled notifications with detailed logging
 */
export const getScheduledNotifications = async () => {
	try {
		const notifications = await notifee.getTriggerNotifications();

		notifications.forEach((notification, index) => {
			const trigger = notification.trigger as TimestampTrigger;
			const timestamp = trigger.timestamp;
			const date = timestamp ? new Date(timestamp) : null;

			console.log(`${index + 1}. ${notification.notification.title}`);
			console.log(`   ID: ${notification.notification.id}`);
			console.log(`   Timestamp: ${timestamp}`);
			console.log(`   Date: ${date ? date.toISOString() : "Invalid"}`);
			console.log(`   Repeat: ${trigger.repeatFrequency}`);
			console.log(`   AlarmManager: ${JSON.stringify(trigger.alarmManager)}`);
			console.log("---");
		});

		return notifications;
	} catch (error) {
		console.error("Failed to get scheduled notifications:", error);
		return [];
	}
};

/**
 * Schedule a test notification (2 minutes from now)
 */
export const scheduleTestNotification = async (): Promise<string> => {
	try {
		const hasPermission = await initializeNotificationService();
		if (!hasPermission) {
			throw new Error("Notification permission not granted");
		}

		const trigger: TimestampTrigger = {
			type: TriggerType.TIMESTAMP,
			timestamp: Date.now() + 30 * 1000, // 30 seconds from now
			alarmManager: {
				type: 3, // ELAPSED_REALTIME_WAKEUP
				allowWhileIdle: true,
			},
		};

		const notificationId = await notifee.createTriggerNotification(
			{
				title: "Test Notification",
				body: "This is a test notification. If you see this, notifications are working!",
				android: {
					channelId: NOTIFICATION_CHANNEL_ID,
					importance: AndroidImportance.HIGH,
					sound: "default",
					vibrationPattern: [300, 500],
					smallIcon: "notification_icon",
					color: "#ffffff",
					pressAction: {
						id: "default",
						launchActivity: "default",
					},
				},
			},
			trigger,
		);

		// console.log(`Test notification scheduled with ID: ${notificationId}`);
		// console.log(
		// 	`Will trigger at: ${new Date(trigger.timestamp).toISOString()}`,
		// );

		return notificationId;
	} catch (error) {
		console.error("Failed to schedule test notification:", error);
		throw error;
	}
};

/**
 * Debug function to check notification status
 */
export const debugNotificationStatus = async () => {
	try {
		const settings = await notifee.getNotificationSettings();
		const scheduledNotifications = await getScheduledNotifications();

		console.log("=== NOTIFICATION DEBUG INFO ===");
		console.log("Authorization Status:", settings.authorizationStatus);
		console.log("Android Alarm Permission:", settings.android?.alarm);
		console.log(
			"Scheduled Notifications Count:",
			scheduledNotifications.length,
		);
		console.log("Current Time:", new Date().toISOString());

		return {
			hasPermission: settings.authorizationStatus === 1,
			hasAlarmPermission:
				settings.android?.alarm === AndroidNotificationSetting.ENABLED,
			scheduledCount: scheduledNotifications.length,
			notifications: scheduledNotifications,
		};
	} catch (error) {
		console.error("Debug failed:", error);
		return null;
	}
};

export const updateNotificationSettings = async (
	minutesBefore: number,
	timetable?: GroupedSchedule,
): Promise<void> => {
	const _settings = await getNotificationSettings();

	if (minutesBefore === 0) {
		await cancelAllNotifications();
		await saveNotificationSettings({ enabled: false, minutesBefore: 0 });
		return;
	}

	if (timetable && Object.keys(timetable).length > 0) {
		await scheduleAllClassNotifications(timetable, minutesBefore);
	} else {
		await saveNotificationSettings({ enabled: true, minutesBefore });
	}
};

export const areNotificationsEnabled = async (): Promise<boolean> => {
	try {
		const settings = await notifee.getNotificationSettings();
		return settings.authorizationStatus === 1;
	} catch (error) {
		console.error("Failed to check notification settings:", error);
		return false;
	}
};

export const setupNotificationListeners = () => {
	notifee.onForegroundEvent(({ type, detail }) => {
		switch (type) {
			case EventType.PRESS:
				console.log("User pressed notification:", detail.notification);
				break;
			case EventType.ACTION_PRESS:
				console.log("User pressed action:", detail.pressAction);
				break;
		}
	});

	notifee.onBackgroundEvent(async ({ type, detail }) => {
		switch (type) {
			case EventType.PRESS:
				console.log(
					"User pressed notification (background):",
					detail.notification,
				);
				break;
			case EventType.ACTION_PRESS:
				console.log("User pressed action (background):", detail.pressAction);
				break;
		}
	});
};
