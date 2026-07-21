import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Toaster } from "../components/ui/sonner";
import type { AuthContextType } from "../lib/auth";
import "../styles.css";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	auth: AuthContextType;
}>()({
	component: RootComponent,
});

function RootComponent() {
	return (
		<>
			<Outlet />
			<Toaster />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</>
	);
}
