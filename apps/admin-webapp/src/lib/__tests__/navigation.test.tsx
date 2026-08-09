// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../../components/MobileBottomNav";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => {
	return {
		Link: ({
			to,
			children,
			className,
			activeProps,
			inactiveProps,
			activeOptions,
			...rest
		}: {
			to?: string;
			children?: React.ReactNode;
			className?: string;
			activeProps?: { className?: string };
			inactiveProps?: { className?: string };
			activeOptions?: unknown;
		}) => {
			const isActive = to === "/"; // Mock "/" as active route
			const finalClass = [
				className,
				isActive ? activeProps?.className : inactiveProps?.className,
			]
				.filter(Boolean)
				.join(" ");

			return (
				<a
					href={to}
					className={finalClass}
					data-active={isActive ? "true" : "false"}
					{...rest}
				>
					{children}
				</a>
			);
		},
	};
});

describe("MobileBottomNav Component", () => {
	let onLogoutMock: () => void;

	beforeEach(() => {
		onLogoutMock = vi.fn();
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders all four navigation items: Upload, Announcements, Analytics, Logout", () => {
		render(<MobileBottomNav onLogout={onLogoutMock} />);

		expect(screen.getByText("Upload")).toBeDefined();
		expect(screen.getByText("Announcements")).toBeDefined();
		expect(screen.getByText("Analytics")).toBeDefined();
		expect(screen.getByText("Logout")).toBeDefined();
	});

	it("renders fixed bottom bar with md:hidden responsive class", () => {
		const { container } = render(<MobileBottomNav onLogout={onLogoutMock} />);
		const nav = container.querySelector("nav");

		expect(nav).not.toBeNull();
		expect(nav?.className).toContain("fixed");
		expect(nav?.className).toContain("bottom-0");
		expect(nav?.className).toContain("md:hidden");
	});

	it("ensures each nav item meets minimum tap target of 44px", () => {
		const { container } = render(<MobileBottomNav onLogout={onLogoutMock} />);
		const links = container.querySelectorAll("nav a, nav button");

		expect(links.length).toBe(4);
		for (const item of links) {
			expect(item.className).toContain("min-h-[44px]");
			expect(item.className).toContain("min-w-[44px]");
		}
	});

	it("renders active route item with brand orange (#f57c00)", () => {
		render(<MobileBottomNav onLogout={onLogoutMock} />);
		const uploadLink = screen.getByText("Upload").closest("a");

		expect(uploadLink).not.toBeNull();
		expect(uploadLink?.className).toContain("text-[#f57c00]");
	});

	it("renders inactive route items with muted colour", () => {
		render(<MobileBottomNav onLogout={onLogoutMock} />);
		const announcementsLink = screen.getByText("Announcements").closest("a");
		const analyticsLink = screen.getByText("Analytics").closest("a");

		expect(announcementsLink).not.toBeNull();
		expect(announcementsLink?.className).toContain("text-muted-foreground");
		expect(analyticsLink).not.toBeNull();
		expect(analyticsLink?.className).toContain("text-muted-foreground");
	});

	it("calls onLogout when Logout button is clicked", () => {
		render(<MobileBottomNav onLogout={onLogoutMock} />);
		const logoutButton = screen.getByRole("button", { name: /Logout/i });

		fireEvent.click(logoutButton);
		expect(onLogoutMock).toHaveBeenCalledTimes(1);
	});
});
