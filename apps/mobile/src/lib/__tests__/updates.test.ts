import * as Updates from 'expo-updates';
import { toast } from 'sonner-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAndApplyUpdates } from '@/lib/updates';

jest.mock('expo-updates', () => ({
  isEmbeddedLaunch: true,
  updateId: undefined,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
}));

jest.mock('sonner-native', () => ({
  toast: jest.fn(),
  Toaster: () => null,
}));

const originalDev = (global as any).__DEV__;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (global as any).__DEV__ = false;
  (Updates as any).isEmbeddedLaunch = true;
  (Updates as any).updateId = undefined;
  (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: false });
  (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({ isNew: true });
});

afterAll(() => {
  (global as any).__DEV__ = originalDev;
});

describe('checkAndApplyUpdates', () => {
  it('does nothing when in __DEV__ mode', async () => {
    (global as any).__DEV__ = true;

    await checkAndApplyUpdates();

    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('checks and fetches updates in production when update is available', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });

    await checkAndApplyUpdates();

    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it('checks for update but does not fetch when no update is available', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: false });

    await checkAndApplyUpdates();

    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('swallows network/server errors during update check silently', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(checkAndApplyUpdates()).resolves.toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows toast once on freshly-applied OTA launch and suppresses toast on subsequent launch', async () => {
    (Updates as any).isEmbeddedLaunch = false;
    (Updates as any).updateId = 'test-ota-update-id-123';

    // First OTA launch
    await checkAndApplyUpdates();
    expect(toast).toHaveBeenCalledWith('App updated');
    expect(toast).toHaveBeenCalledTimes(1);

    // Second launch with same updateId
    jest.clearAllMocks();
    await checkAndApplyUpdates();
    expect(toast).not.toHaveBeenCalled();
  });
});
