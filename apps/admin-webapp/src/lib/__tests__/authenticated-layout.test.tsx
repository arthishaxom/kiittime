// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedLayout } from "../../components/AuthenticatedLayout";
import * as AuthModule from "../auth";

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
			const isActive = to === "/";
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
		Outlet: () => <div data-testid="outlet-content">Main Outlet Content</div>,
		useRouter: () => ({
			navigate: vi.fn(),
		}),
	};
});

describe("Authenticated Layout Shell", () => {
	beforeEach(() => {
		vi.spyOn(AuthModule, "useAuth").mockReturnValue({
			token: "mock-token",
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("hides top nav links on mobile with hidden md:flex", () => {
		const { container } = render(<AuthenticatedLayout />);
		const topNav = container.querySelector("header nav");

		expect(topNav).not.toBeNull();
		expect(topNav?.className).toContain("hidden");
		expect(topNav?.className).toContain("md:flex");
	});

	it("renders main content with bottom padding on mobile to clear bottom bar", () => {
		const { container } = render(<AuthenticatedLayout />);
		const main = container.querySelector("main");

		expect(main).not.toBeNull();
		expect(main?.className).toContain("pb-20");
		expect(main?.className).toContain("md:pb-0");
		expect(screen.getByTestId("outlet-content")).toBeDefined();
	});

	it("renders mobile bottom navigation bar in the shell", () => {
		render(<AuthenticatedLayout />);
		const bottomNav = screen.getByRole("navigation", {
			name: "Mobile bottom navigation",
		});

		expect(bottomNav).toBeDefined();
		expect(bottomNav.className).toContain("md:hidden");
	});
});
