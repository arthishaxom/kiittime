import { Link } from "@tanstack/react-router";
import { BarChart3, LogOut, Megaphone, Upload } from "lucide-react";

interface MobileBottomNavProps {
	onLogout: () => void;
}

export function MobileBottomNav({ onLogout }: MobileBottomNavProps) {
	return (
		<nav
			aria-label="Mobile bottom navigation"
			className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur md:hidden"
		>
			<Link
				to="/"
				activeOptions={{ exact: true }}
				activeProps={{ className: "text-[#f57c00]" }}
				inactiveProps={{ className: "text-muted-foreground" }}
				className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors hover:text-foreground active:text-[#f57c00]"
			>
				<Upload className="size-5 shrink-0" />
				<span>Upload</span>
			</Link>
			<Link
				to="/announcements"
				activeProps={{ className: "text-[#f57c00]" }}
				inactiveProps={{ className: "text-muted-foreground" }}
				className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors hover:text-foreground active:text-[#f57c00]"
			>
				<Megaphone className="size-5 shrink-0" />
				<span>Announcements</span>
			</Link>
			<Link
				to="/analytics"
				activeProps={{ className: "text-[#f57c00]" }}
				inactiveProps={{ className: "text-muted-foreground" }}
				className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors hover:text-foreground active:text-[#f57c00]"
			>
				<BarChart3 className="size-5 shrink-0" />
				<span>Analytics</span>
			</Link>
			<button
				type="button"
				onClick={onLogout}
				className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:text-[#f57c00]"
			>
				<LogOut className="size-5 shrink-0" />
				<span>Logout</span>
			</button>
		</nav>
	);
}
