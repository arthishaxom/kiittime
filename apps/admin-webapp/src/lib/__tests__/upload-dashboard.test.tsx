// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadDashboard } from "../../components/UploadDashboard";
import * as ApiModule from "../api";
import * as AuthModule from "../auth";

// Mock router navigate
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		navigate: mockNavigate,
	}),
}));

describe("Upload Dashboard Component", () => {
	let queryClient: QueryClient;
	let mockApiFetch: MockInstance;

	beforeEach(() => {
		vi.restoreAllMocks();
		mockNavigate.mockReset();

		vi.spyOn(AuthModule, "useAuth").mockReturnValue({
			token: "mock-token",
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		mockApiFetch = vi.spyOn(ApiModule, "apiFetch").mockResolvedValue({
			ok: true,
			json: async () => ({}),
		} as unknown as Response);

		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
	});

	afterEach(() => {
		cleanup();
		queryClient.clear();
	});

	function renderComponent() {
		return render(
			<QueryClientProvider client={queryClient}>
				<UploadDashboard />
			</QueryClientProvider>,
		);
	}

	it("renders both Timetable and Roll Mappings cards simultaneously without tab buttons", () => {
		renderComponent();

		// Check that tab switcher is gone
		expect(screen.queryByRole("tab")).toBeNull();

		// Both cards are visible
		expect(screen.getByText("Upload Timetable")).toBeDefined();
		expect(screen.getByText("Upload Roll Mappings")).toBeDefined();
		expect(screen.getByText("Danger Zone")).toBeDefined();
	});

	it("renders cards with glassmorphism classes", () => {
		const { container } = renderComponent();
		const glassCards = container.querySelectorAll(".backdrop-blur-md");

		// Timetable, Roll Mappings, and Danger Zone cards have backdrop-blur-md
		expect(glassCards.length).toBeGreaterThanOrEqual(3);

		// Check classes for semi-transparent bg, border, rounded-2xl, shadow-xl
		const firstCard = glassCards[0];
		expect(firstCard.className).toContain("bg-white/5");
		expect(firstCard.className).toContain("border-white/10");
		expect(firstCard.className).toContain("rounded-2xl");
		expect(firstCard.className).toContain("shadow-xl");
	});

	it("renders file drop zones with dashed border and orange hover glow classes", () => {
		const { container } = renderComponent();
		const dropzones = container.querySelectorAll("[data-slot='file-dropzone']");

		expect(dropzones.length).toBe(2);
		for (const dropzone of dropzones) {
			expect(dropzone.className).toContain("border-dashed");
			expect(dropzone.className).toContain("hover:border-[#f57c00]/50");
			expect(dropzone.className).toContain("hover:bg-[#f57c00]/5");
			expect(dropzone.className).toContain("min-h-[100px]");
		}
	});

	it("renders year selector pill buttons with brand-orange active state", async () => {
		renderComponent();

		// For Roll Mappings, year buttons are always visible
		const rollYearButtons = screen.getAllByRole("button", { name: "1" });
		const rollYear1 = rollYearButtons[0];

		// Initially inactive: has bg-white/10
		expect(rollYear1.className).toContain("rounded-full");
		expect(rollYear1.className).toContain("bg-white/10");

		// Click Year 1 for roll mappings
		fireEvent.click(rollYear1);

		// Now active: has bg-[#f57c00] text-black
		expect(rollYear1.className).toContain("bg-[#f57c00]");
		expect(rollYear1.className).toContain("text-black");
	});

	it("collapses advanced roll mapping options by default and toggles on click", async () => {
		renderComponent();

		// Advanced options toggle button is visible
		const toggleBtn = screen.getByRole("button", {
			name: /advanced options/i,
		});
		expect(toggleBtn).toBeDefined();

		// Advanced options content is collapsed initially
		expect(screen.queryByText("Roll Number Column (Optional)")).toBeNull();
		expect(screen.queryByText("Section Column (Optional)")).toBeNull();

		// Click to expand
		fireEvent.click(toggleBtn);

		// Now options content should show placeholder message or selectors
		expect(
			screen.getByText(
				/Select a roll mappings file above to configure custom column or sheet overrides/i,
			),
		).toBeDefined();
	});

	it("renders Danger Zone card with red-tinted styling at the bottom", () => {
		renderComponent();
		const dangerZoneHeading = screen.getByText("Danger Zone");
		const dangerCard = dangerZoneHeading.closest("[data-slot='card']");

		expect(dangerCard).not.toBeNull();
		expect(dangerCard?.className).toContain("border-red-500/20");
		expect(dangerCard?.className).toContain("bg-red-500/5");
	});

	it("handles Excel timetable upload flow end-to-end", async () => {
		// Mock inspect response
		mockApiFetch.mockImplementation(async (path: string) => {
			if (path === "/admin/uploads/inspect") {
				return {
					ok: true,
					json: async () => ({ sheet_names: ["Timetable_2026", "Notes"] }),
				} as unknown as Response;
			}
			if (path === "/admin/uploads") {
				return {
					ok: true,
					json: async () => ({ upload_id: 42, status: "pending_review" }),
				} as unknown as Response;
			}
			return { ok: true, json: async () => ({}) } as unknown as Response;
		});

		renderComponent();

		const timetableFileInput = screen.getByTestId("timetable-file-input");
		const testFile = new File(["dummy content"], "timetable.xlsx", {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});

		fireEvent.change(timetableFileInput, { target: { files: [testFile] } });

		await waitFor(() => {
			expect(screen.getByText("timetable.xlsx")).toBeDefined();
			expect(screen.getByText("Select a sheet")).toBeDefined();
		});

		// Parse button is disabled before selecting sheet & year
		const parseButton = screen.getByRole("button", { name: /parse/i });
		expect(parseButton.hasAttribute("disabled")).toBe(true);
	});

	it("displays error in destructive alert when upload fails", async () => {
		mockApiFetch.mockImplementation(async (path: string) => {
			if (path === "/admin/uploads/inspect") {
				return {
					ok: false,
					statusText: "Invalid file format",
					json: async () => ({ detail: "Invalid Excel format" }),
				} as unknown as Response;
			}
			return { ok: true, json: async () => ({}) } as unknown as Response;
		});

		renderComponent();

		const timetableFileInput = screen.getByTestId("timetable-file-input");
		const testFile = new File(["bad content"], "bad.xlsx", {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});

		fireEvent.change(timetableFileInput, { target: { files: [testFile] } });

		await waitFor(() => {
			expect(screen.getByText("Invalid Excel format")).toBeDefined();
		});
	});

	it("renders Excel | PDF segmented toggle at the top of Timetable card", () => {
		renderComponent();

		const excelToggle = screen.getByRole("button", { name: /^excel$/i });
		const pdfToggle = screen.getByRole("button", { name: /^pdf$/i });

		expect(excelToggle).toBeDefined();
		expect(pdfToggle).toBeDefined();

		// Default is Excel active
		expect(excelToggle.className).toContain("bg-[#f57c00]");
	});

	it("handles PDF timetable upload happy path: select PDF mode → attach file → pick year 2 → click Upload → asserts navigation", async () => {
		let capturedPath = "";
		let capturedBody: FormData | undefined;

		mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
			if (path === "/admin/uploads/pdf") {
				capturedPath = path;
				capturedBody = options?.body as FormData;
				return {
					ok: true,
					json: async () => ({ upload_id: 42, status: "pending_review" }),
				} as unknown as Response;
			}
			return { ok: true, json: async () => ({}) } as unknown as Response;
		});

		renderComponent();

		// Switch to PDF mode
		const pdfToggle = screen.getByRole("button", { name: /^pdf$/i });
		fireEvent.click(pdfToggle);

		// Sheet selector should not exist
		expect(screen.queryByText("Select a sheet")).toBeNull();

		// Check file input accept attribute
		const timetableFileInput = screen.getByTestId("timetable-file-input") as HTMLInputElement;
		expect(timetableFileInput.accept).toBe(".pdf");

		// Year selector pills are rendered
		const year2Buttons = screen.getAllByRole("button", { name: "2" });
		const timetableYear2 = year2Buttons[0];

		// Upload button exists and is disabled initially
		const uploadButton = screen.getByRole("button", { name: /^upload$/i });
		expect(uploadButton.hasAttribute("disabled")).toBe(true);

		// Attach PDF file
		const testFile = new File(["pdf dummy content"], "timetable_y2.pdf", {
			type: "application/pdf",
		});
		fireEvent.change(timetableFileInput, { target: { files: [testFile] } });

		expect(screen.getByText("timetable_y2.pdf")).toBeDefined();

		// Upload button still disabled until year is selected
		expect(uploadButton.hasAttribute("disabled")).toBe(true);

		// Pick Year 2
		fireEvent.click(timetableYear2);
		expect(uploadButton.hasAttribute("disabled")).toBe(false);

		// Click Upload
		fireEvent.click(uploadButton);

		await waitFor(() => {
			expect(capturedPath).toBe("/admin/uploads/pdf");
			expect(capturedBody?.get("year")).toBe("2");
			expect(capturedBody?.get("file")).toBeDefined();
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/review/$uploadId",
				params: { uploadId: "42" },
			});
		});
	});

	it("displays error in destructive alert when PDF upload fails", async () => {
		mockApiFetch.mockImplementation(async (path: string) => {
			if (path === "/admin/uploads/pdf") {
				return {
					ok: false,
					statusText: "Unprocessable Entity",
					json: async () => ({ detail: "Failed to parse PDF file: Missing timetable grid" }),
				} as unknown as Response;
			}
			return { ok: true, json: async () => ({}) } as unknown as Response;
		});

		renderComponent();

		// Switch to PDF mode
		fireEvent.click(screen.getByRole("button", { name: /^pdf$/i }));

		const timetableFileInput = screen.getByTestId("timetable-file-input");
		const testFile = new File(["bad pdf"], "broken.pdf", {
			type: "application/pdf",
		});
		fireEvent.change(timetableFileInput, { target: { files: [testFile] } });

		const year1 = screen.getAllByRole("button", { name: "1" })[0];
		fireEvent.click(year1);

		const uploadBtn = screen.getByRole("button", { name: /^upload$/i });
		fireEvent.click(uploadBtn);

		await waitFor(() => {
			expect(
				screen.getByText("Failed to parse PDF file: Missing timetable grid"),
			).toBeDefined();
		});
	});

	it("switching mode resets file and year selection for that mode", async () => {
		renderComponent();

		// Switch to PDF mode
		fireEvent.click(screen.getByRole("button", { name: /^pdf$/i }));

		const timetableFileInput = screen.getByTestId("timetable-file-input");
		const pdfFile = new File(["pdf"], "year3.pdf", { type: "application/pdf" });
		fireEvent.change(timetableFileInput, { target: { files: [pdfFile] } });
		fireEvent.click(screen.getAllByRole("button", { name: "3" })[0]);

		expect(screen.getByText("year3.pdf")).toBeDefined();

		// Switch back to Excel mode
		fireEvent.click(screen.getByRole("button", { name: /^excel$/i }));

		// State should be reset
		expect(screen.queryByText("year3.pdf")).toBeNull();
		expect((screen.getByTestId("timetable-file-input") as HTMLInputElement).accept).toBe(".xlsx,.xls");
	});
});

