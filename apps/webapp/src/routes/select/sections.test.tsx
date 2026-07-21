import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionSearch } from "#/components/SectionSearch";
import * as hooks from "#/hooks/useSections";

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
	createFileRoute: () => () => ({
		useSearch: () => ({ year: 1 }),
	}),
}));

// Mock the API hook
vi.mock("#/hooks/useSections", () => ({
	useSections: vi.fn(),
}));

// Mock storage
vi.mock("@kiittime/api/storage", () => ({
	saveSectionIds: vi.fn(),
}));

describe("SectionSearch Component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.HTMLElement.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		cleanup();
	});

	it("limits selection to a maximum of 5 sections and displays a warning", () => {
		// 1. Mock the hook to return 6 sections
		const mockSections = [
			{ id: 1, section_name: "CS1" },
			{ id: 2, section_name: "CS2" },
			{ id: 3, section_name: "CS3" },
			{ id: 4, section_name: "CS4" },
			{ id: 5, section_name: "CS5" },
			{ id: 6, section_name: "CS6" },
		];
		vi.mocked(hooks.useSections).mockReturnValue({
			data: mockSections,
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		} as any);

		// 2. Render the component
		render(<SectionSearch year={1} />);

		// 3. Click the first 5 sections
		for (let i = 1; i <= 5; i++) {
			const button = screen.getByText(`CS${i}`);
			fireEvent.click(button);
		}

		// Verify 5 are selected (they appear in the "Selected Sections" area)
		expect(screen.getByText("Selected Sections (5)")).toBeDefined();

		// 4. Try to click the 6th section
		const sixthButton = screen.getByText("CS6");
		fireEvent.click(sixthButton);

		// 5. Verify it is NOT added to the selected count
		expect(screen.getByText("Selected Sections (5)")).toBeDefined();

		// 6. Verify the warning text is displayed
		expect(screen.getByText("Max 5 sections")).toBeDefined();
	});

	it("filters sections based on the selected prefix dropdown", async () => {
		// 1. Mock the hook with multiple prefixes
		const mockSections = [
			{ id: 1, section_name: "CS1" },
			{ id: 2, section_name: "CS2" },
			{ id: 3, section_name: "IT1" },
			{ id: 4, section_name: "IT2" },
		];
		vi.mocked(hooks.useSections).mockReturnValue({
			data: mockSections,
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		} as any);

		render(<SectionSearch year={1} />);

		// Initially all 4 sections are displayed
		expect(screen.queryByText("CS1")).toBeDefined();
		expect(screen.queryByText("CS2")).toBeDefined();
		expect(screen.queryByText("IT1")).toBeDefined();
		expect(screen.queryByText("IT2")).toBeDefined();

		// Find the select trigger (combobox/button) and open it
		const trigger = screen.getByRole("combobox");
		expect(trigger).toBeDefined();

		// In Radix Select, we can simulate change by firing a click on the trigger,
		// then clicking the SelectItem. Or we can mock ResizeObserver if needed.
		// Let's mock window.PointerEvent if needed (Radix Select sometimes requires it)
		// For JSDOM, we can click the trigger
		fireEvent.click(trigger);

		// The option 'IT' should now be in the document (within the portal)
		const itOption = screen.getByRole("option", { name: "IT" });
		fireEvent.click(itOption);

		// After selecting 'IT', only IT1 and IT2 should be visible
		expect(screen.queryByText("IT1")).toBeDefined();
		expect(screen.queryByText("IT2")).toBeDefined();
		expect(screen.queryByText("CS1")).toBeNull();
		expect(screen.queryByText("CS2")).toBeNull();
	});
});
