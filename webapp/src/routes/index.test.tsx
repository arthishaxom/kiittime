import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "#/components/Landing";
import * as api from "#/lib/api";
import * as storage from "#/lib/storage";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mockNavigate,
	createFileRoute: () => () => ({
		useSearch: () => ({}),
	}),
}));

vi.mock("#/lib/api", () => ({
	fetchRollNumberMapping: vi.fn(),
}));

vi.mock("#/lib/storage", () => ({
	getSavedSectionIds: vi.fn(),
	saveSectionIds: vi.fn(),
	ACTIVE_ROLL_NO_KEY: "kiit-time:active-roll-no",
	ACTIVE_ACADEMIC_YEAR_KEY: "kiit-time:active-academic-year",
}));

describe("Landing Component (Web Onboarding)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders roll number input by default", () => {
		render(<Landing />);
		expect(screen.getByPlaceholderText("e.g. 2105123")).toBeDefined();
		expect(screen.getByText("Find your Timetable")).toBeDefined();
		expect(screen.getByText("Select sections manually")).toBeDefined();
	});

	it("calls fetchRollNumberMapping, saves section IDs, and navigates on successful submission", async () => {
		const mockMapping = {
			roll_no: "2105123",
			academic_year: 3,
			sections: [{ id: 42, section_name: "CS1", year: 3 }],
		};
		vi.mocked(api.fetchRollNumberMapping).mockResolvedValue(mockMapping);

		render(<Landing />);

		const input = screen.getByPlaceholderText("e.g. 2105123");
		fireEvent.change(input, { target: { value: "2105123" } });

		const submitBtn = screen.getByRole("button", { name: "Find Timetable" });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(api.fetchRollNumberMapping).toHaveBeenCalledWith("2105123");
			expect(storage.saveSectionIds).toHaveBeenCalledWith([42]);
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/timetable",
				search: { section_id: [42] },
			});
		});
	});

	it('shows blocking "No timetables uploaded yet" screen on empty DB error', async () => {
		const apiError = new Error("No timetables uploaded yet");
		(apiError as any).status = 404;
		(apiError as any).detail = "No timetables uploaded yet";
		vi.mocked(api.fetchRollNumberMapping).mockRejectedValue(apiError);

		render(<Landing />);

		const input = screen.getByPlaceholderText("e.g. 2105123");
		fireEvent.change(input, { target: { value: "2105123" } });

		const submitBtn = screen.getByRole("button", { name: "Find Timetable" });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText("No timetables uploaded yet")).toBeDefined();
			expect(screen.getByText("Try Again")).toBeDefined();
		});

		// Click try again should return to the roll number input screen
		const retryBtn = screen.getByRole("button", { name: "Try Again" });
		fireEvent.click(retryBtn);

		expect(screen.getByPlaceholderText("e.g. 2105123")).toBeDefined();
	});

	it("displays standard error message when roll number is not found", async () => {
		const apiError = new Error("Roll number not found");
		(apiError as any).status = 404;
		(apiError as any).detail = "Roll number not found";
		vi.mocked(api.fetchRollNumberMapping).mockRejectedValue(apiError);

		render(<Landing />);

		const input = screen.getByPlaceholderText("e.g. 2105123");
		fireEvent.change(input, { target: { value: "9999999" } });

		const submitBtn = screen.getByRole("button", { name: "Find Timetable" });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText("Roll number not found")).toBeDefined();
		});
	});

	it('switches to manual section selection UI when clicking "Select sections manually"', () => {
		render(<Landing />);

		const manualBtn = screen.getByText("Select sections manually");
		fireEvent.click(manualBtn);

		// Should now show "Find by Section" manual selection components
		expect(screen.getByText("Find by Section")).toBeDefined();
		expect(screen.queryByPlaceholderText("e.g. 2105123")).toBeNull();

		// Can select a year
		const yearBtn = screen.getByRole("button", { name: "3" });
		fireEvent.click(yearBtn);

		// Can click back button to return to roll number search
		const backBtn = screen.getByRole("button", { name: "" }); // The ArrowLeft button has no explicit name text
		fireEvent.click(backBtn);

		expect(screen.getByPlaceholderText("e.g. 2105123")).toBeDefined();
	});
});
