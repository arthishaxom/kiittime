import AsyncStorage from '@react-native-async-storage/async-storage';
<<<<<<< HEAD
<<<<<<< HEAD
import { focusManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
=======
=======
>>>>>>> origin/main
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
<<<<<<< HEAD
>>>>>>> origin/dev
=======
>>>>>>> origin/main

const ONE_DAY = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: ONE_DAY,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

<<<<<<< HEAD
<<<<<<< HEAD
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

=======
export function QueryProvider({ children }: { children: ReactNode }) {
>>>>>>> origin/dev
=======
export function QueryProvider({ children }: { children: ReactNode }) {
>>>>>>> origin/main
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_DAY }}>
      {children}
    </PersistQueryClientProvider>
  );
}
