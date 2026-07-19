import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import TanstackQueryProvider, {
	getContext,
} from "./integrations/tanstack-query/root-provider";
import { AuthProvider, useAuth } from "./lib/auth";
import { routeTree } from "./routeTree.gen";

const { queryClient } = getContext();

const router = createRouter({
	routeTree,
	context: { queryClient, auth: undefined! },
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function InnerApp() {
	const auth = useAuth();
	return <RouterProvider router={router} context={{ auth, queryClient }} />;
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<TanstackQueryProvider queryClient={queryClient}>
			<AuthProvider>
				<InnerApp />
			</AuthProvider>
		</TanstackQueryProvider>,
	);
}
