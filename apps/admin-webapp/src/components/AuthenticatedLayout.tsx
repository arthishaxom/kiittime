import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "../lib/auth";
import { MobileBottomNav } from "./MobileBottomNav";
import { Button } from "./ui/button";

export function AuthenticatedLayout() {
	const auth = useAuth();
	const router = useRouter();

	function handleLogout() {
		auth.logout();
		router.navigate({ to: "/login", search: { redirect: "/" } });
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-10 border-b bg-card text-card-foreground shadow-sm">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
					<div className="flex items-center gap-6">
						<span className="font-semibold">KIIT Time Admin</span>
						<nav
							aria-label="Main navigation"
							className="hidden items-center gap-4 text-sm md:flex"
						>
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
							<Link
								to="/analytics"
								activeProps={{ className: "text-foreground font-medium" }}
								className="text-muted-foreground hover:text-foreground"
							>
								Analytics
							</Link>
						</nav>
					</div>
					<div className="hidden items-center gap-3 md:flex">
						<span className="text-sm text-muted-foreground">
							{auth.token ? "Logged in" : ""}
						</span>
						<Button variant="outline" size="sm" onClick={handleLogout}>
							Log out
						</Button>
					</div>
				</div>
			</header>
			<main className="flex-1 pb-20 md:pb-0">
				<Outlet />
			</main>
			<MobileBottomNav onLogout={handleLogout} />
		</div>
	);
}
