import { Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router"

import { useAuth } from "../lib/auth"
import { Button } from "../components/ui/button"

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({ to: "/login", search: { redirect: location.href } })
		}
	},
	component: RouteComponent,
})

function RouteComponent() {
	const auth = useAuth()
	const router = useRouter()

	function handleLogout() {
		auth.logout()
		router.navigate({ to: "/login" })
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-10 border-b bg-card text-card-foreground shadow-sm">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
					<span className="font-semibold">KIIT Time Admin</span>
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">
							{auth.token ? "Logged in" : ""}
						</span>
						<Button variant="outline" size="sm" onClick={handleLogout}>
							Log out
						</Button>
					</div>
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	)
}
