# Notification System Documentation

## Overview

This notification system uses Notifee to schedule recurring weekly notifications for class reminders. The system is designed to be modular, persistent, and user-friendly.

## Features

- **Weekly Recurring Notifications**: Notifications are scheduled to repeat every week
- **Configurable Timing**: Users can set notifications to trigger 10, 15, 20, 25, or 30 minutes before class
- **Persistent Settings**: Notification preferences are saved and persist between app restarts
- **Android Optimized**: Uses Android-specific features like AlarmManager for reliable scheduling
- **Permission Management**: Handles notification permissions gracefully
- **Test Notifications**: Includes a test notification feature for debugging

## Architecture

### Core Components

1. **Notification Service** (`utils/notifications.ts`)
   - Main notification logic and API
   - Handles scheduling, cancellation, and settings management
   - Uses Notifee for cross-platform notification handling

2. **Notification Provider** (`components/NotificationProvider.tsx`)
   - Initializes notification service on app startup
   - Sets up event listeners for notification interactions

3. **Notification Hook** (`hooks/useNotifications.ts`)
   - Custom hook for easy notification management
   - Provides reactive state management for notification settings

4. **Store Integration** (`store/timetableStore.ts`)
   - Integrates notification settings with the main app state
   - Persists notification preferences using AsyncStorage

### Key Functions

#### `scheduleAllClassNotifications(timetable, minutesBefore)`
- Schedules notifications for all classes in the timetable
- Calculates notification times based on class start times
- Uses weekly recurring triggers for persistent notifications

#### `updateNotificationSettings(minutesBefore, timetable?)`
- Updates notification timing preferences
- Optionally reschedules all notifications if timetable is provided
- Handles disabling notifications (when minutesBefore = 0)

#### `initializeNotificationService()`
- Sets up Android notification channels
- Requests notification permissions
- Returns permission status

## Usage

### Basic Setup

```typescript
import { useNotifications } from '~/hooks/useNotifications';

const MyComponent = () => {
  const { 
    notificationTime, 
    updateSettings, 
    testNotification 
  } = useNotifications();

  const handleTimeChange = async (minutes: number) => {
    try {
      await updateSettings(minutes);
      // Show success message
    } catch (error) {
      // Handle error
    }
  };

  return (
    // Your UI components
  );
};
```

### Notification Time Selection

The system supports the following notification times:
- **10 minutes**: Quick reminder
- **15 minutes**: Standard reminder (default)
- **20 minutes**: Early reminder
- **25 minutes**: Very early reminder
- **30 minutes**: Extra early reminder
- **0 minutes**: Disabled

### Testing Notifications

```typescript
const handleTestNotification = async () => {
  try {
    await testNotification();
    // Show success message
  } catch (error) {
    // Handle error
  }
};
```

## Android Configuration

### Notification Channel

The system creates a dedicated notification channel with:
- **ID**: `class_notifications`
- **Name**: "Class Notifications"
- **Importance**: HIGH
- **Sound**: Default system sound
- **Vibration**: Custom pattern [300, 500]
- **Lights**: Enabled
- **Badge**: Enabled

### AlarmManager Integration

Notifications use Android's AlarmManager for reliable scheduling:
- Ensures notifications fire even when the app is not running
- Handles device reboots and app updates
- Provides precise timing for recurring notifications

## Data Persistence

### Storage Keys

- `notification_settings`: Notification preferences
- `notificationTime`: Current notification timing setting
- `timetable`: Cached timetable data

### Settings Structure

```typescript
interface NotificationSettings {
  enabled: boolean;
  minutesBefore: number;
  lastUpdated: number;
}
```

## Error Handling

The system includes comprehensive error handling:
- Permission denial gracefully handled
- Network failures don't break the app
- Invalid timetable data is handled safely
- Failed notification scheduling is logged but doesn't crash

## Event Handling

### Foreground Events
- User taps on notifications
- Action button presses
- Notification dismissal

### Background Events
- Same as foreground events but when app is in background
- Useful for analytics and user behavior tracking

## Troubleshooting

### Common Issues

1. **Notifications not showing**
   - Check notification permissions
   - Verify notification channel is created
   - Ensure device is not in Do Not Disturb mode

2. **Notifications not recurring**
   - Verify AlarmManager permissions
   - Check if device has battery optimization enabled
   - Ensure app is not force-stopped

3. **Wrong notification times**
   - Check timezone settings
   - Verify class time parsing
   - Ensure notification calculation logic is correct

### Debug Commands

```typescript
// Get all scheduled notifications
const notifications = await getScheduledNotifications();
console.log('Scheduled notifications:', notifications);

// Check notification permissions
const enabled = await areNotificationsEnabled();
console.log('Notifications enabled:', enabled);

// Get current settings
const settings = await getNotificationSettings();
console.log('Current settings:', settings);
```

## Future Enhancements

- **Custom notification sounds**
- **Advanced scheduling options** (specific days only)
- **Notification actions** (snooze, mark as read)
- **Analytics integration**
- **Push notifications** for timetable updates 