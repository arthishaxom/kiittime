import * as Updates from 'expo-updates';
import { toast } from 'sonner-native';
import { getLastShownUpdateId, setLastShownUpdateId } from '@kiittime/api/storage';

export async function checkAndApplyUpdates(): Promise<void> {
  if (__DEV__) {
    return;
  }

  if (!Updates.isEmbeddedLaunch) {
    const updateId = Updates.updateId ?? (Updates as any).currentlyRunning?.updateId;
    if (updateId) {
      try {
        const lastShownId = await getLastShownUpdateId();
        if (lastShownId !== updateId) {
          toast('App updated');
          await setLastShownUpdateId(updateId);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
    }
  } catch {
    // Catch and swallow all network or server errors silently
  }
}
