import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

/**
 * QueryClient for TanStack Query with offline-first configuration
 *
 * Key Settings:
 * - networkMode: 'offlineFirst' - Shows cached data even when offline
 * - staleTime: 5 min - Data considered fresh for 5 minutes (no refetch)
 * - gcTime: 7 days - Keep cache for 7 days before garbage collection
 * - retry: 1 - Only retry failed queries once
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			networkMode: "offlineFirst", // Critical for offline support
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
			retry: 1,
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
		},
	},
});

/**
 * AsyncStorage persister for React Query cache
 *
 * Automatically saves query cache to AsyncStorage (mobile) or localStorage (web)
 * Enables offline-first behavior by restoring cache on app startup
 */
export const asyncStoragePersister = createAsyncStoragePersister({
	storage: Platform.OS === "web" ? window.localStorage : AsyncStorage,
	throttleTime: 1000, // Batch writes every 1 second
});
