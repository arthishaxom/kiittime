import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import TanstackQueryProvider, { getContext } from './integrations/tanstack-query/root-provider'

const { queryClient } = getContext()

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <TanstackQueryProvider queryClient={queryClient}>
    <RouterProvider router={router} />
    </TanstackQueryProvider>,
  )
}
