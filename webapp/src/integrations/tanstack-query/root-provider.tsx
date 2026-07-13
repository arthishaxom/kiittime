import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { ReactNode } from 'react'

const ONE_DAY = 1000 * 60 * 60 * 24

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: ONE_DAY,
      },
    },
  })
  return { queryClient }
}

const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

export default function TanstackQueryProvider({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_DAY }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
