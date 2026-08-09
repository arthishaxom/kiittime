import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPolicy } from "#/components/PrivacyPolicy";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({
		children,
		to,
		className,
	}: {
		children: React.ReactNode;
		to: string;
		className?: string;
	}) => (
		<a href={to} className={className}>
			{children}
		</a>
	),
}));

describe("PrivacyPolicy", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders privacy policy title and non-affiliation notice", () => {
		render(<PrivacyPolicy />);

		expect(screen.getByText("Privacy Policy for KIIT Time")).toBeDefined();
		expect(screen.getByText("Notice of Non-Affiliation")).toBeDefined();
		expect(
			screen.getByText(/Kalinga Institute of Industrial Technology/i),
		).toBeDefined();
	});

	it("renders all key policy sections", () => {
		render(<PrivacyPolicy />);

		expect(screen.getByText("1. Information We Collect")).toBeDefined();
		expect(screen.getByText("2. How We Use Your Information")).toBeDefined();
		expect(screen.getByText("3. Third-Party Service Providers")).toBeDefined();
		expect(screen.getByText("4. Data Retention & Security")).toBeDefined();
		expect(
			screen.getByText("5. Your Data Rights & Deletion Request"),
		).toBeDefined();
		expect(screen.getByText("6. Children's Privacy")).toBeDefined();
		expect(screen.getByText("7. Contact Information & Updates")).toBeDefined();
	});

	it("renders back link and contact email link", () => {
		render(<PrivacyPolicy />);

		const backLink = screen.getByText("Back to App");
		expect(backLink).toBeDefined();

		const contactLink = screen.getByText("Contact: pothal.builds@gmail.com");
		expect(contactLink).toBeDefined();
	});
});
