import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";

const ONE_DAY = 1000 * 60 * 60 * 24;
const SEVEN_DAYS = 7 * ONE_DAY;

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: SEVEN_DAYS,
			},
		},
	});
	return { queryClient };
}

const persister = createSyncStoragePersister({
	storage: window.localStorage,
});

export default function TanstackQueryProvider({
	children,
	queryClient,
	}: {
	children: ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={{ persister, maxAge: SEVEN_DAYS }}
		>
			{children}
		</PersistQueryClientProvider>
	);
}
