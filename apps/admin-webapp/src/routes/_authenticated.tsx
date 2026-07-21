import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const auth = useAuth();
	const router = useRouter();

	function handleLogout() {
		auth.logout();
		router.navigate({ to: "/login" });
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-10 border-b bg-card text-card-foreground shadow-sm">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
					<div className="flex items-center gap-6">
						<span className="font-semibold">KIIT Time Admin</span>
						<nav className="flex items-center gap-4 text-sm">
							<Link
								to="/"
								activeOptions={{ exact: true }}
								activeProps={{ className: "text-foreground font-medium" }}
								className="text-muted-foreground hover:text-foreground"
							>
								Upload
							</Link>
							<Link
								to="/announcements"
								activeProps={{ className: "text-foreground font-medium" }}
								className="text-muted-foreground hover:text-foreground"
							>
								Announcements
							</Link>
						</nav>
					</div>
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
	);
}
