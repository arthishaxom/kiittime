import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

const ONE_DAY = 1000 * 60 * 60 * 24;
const SEVEN_DAYS = 7 * ONE_DAY;

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function onAppStateChange(status: AppStateStatus) {
  // TanStack Query's refetch-on-focus relies on a browser's window focus
  // events by default, which don't exist in React Native — without this,
  // staleTime: 0 queries (like the current announcement) never refetch once
  // fetched, even after backgrounding and foregrounding the app.
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: SEVEN_DAYS }}>
      {children}
    </PersistQueryClientProvider>
  );
}
