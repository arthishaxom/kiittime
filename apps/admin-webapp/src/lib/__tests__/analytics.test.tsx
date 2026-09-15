// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard";
import * as ApiModule from "../api";
import * as AuthModule from "../auth";

// Mock recharts to avoid DOM size measurement issues in jsdom
vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="responsive-container">{children}</div>
	),
	LineChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="line-chart">{children}</div>
	),
	Line: () => <div data-testid="line" />,
	BarChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="bar-chart">{children}</div>
	),
	Bar: () => <div data-testid="bar" />,
	PieChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="pie-chart">{children}</div>
	),
	Pie: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="pie">{children}</div>
	),
	Cell: () => <div data-testid="cell" />,
	XAxis: () => null,
	YAxis: () => null,
	CartesianGrid: () => null,
	Tooltip: () => null,
	Legend: () => null,
}));

interface ConsolidatedPayload {
	usage: Array<{ date: string; dau: number; total_api_calls: number; timetable_searches: number }>;
	endpoint_health: Array<{
		date: string;
		endpoint: string;
		total_calls: number;
		p95_latency_ms: number;
		error_rate: number;
	}>;
	section_trends: Array<{
		date: string;
		section_name: string;
		section_year: number;
		search_volume: number;
	}>;
	data_as_of: string;
	synced_at: string;
	stale: boolean;
}

const CONSOLIDATED_EMPTY: ConsolidatedPayload = {
	usage: [],
	endpoint_health: [],
	section_trends: [],
	data_as_of: "2026-08-02T00:00:00Z",
	synced_at: "2026-08-03T00:00:00Z",
	stale: false,
};

function consolidatedResponse(overrides: Partial<ConsolidatedPayload> = {}) {
	return { ...CONSOLIDATED_EMPTY, ...overrides };
}

describe("Analytics Dashboard Component", () => {
	let queryClient: QueryClient;
	let mockApiFetch: MockInstance;

	beforeEach(() => {
		vi.restoreAllMocks();

		vi.spyOn(AuthModule, "useAuth").mockReturnValue({
			token: "mock-test-jwt-token",
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		mockApiFetch = vi.spyOn(ApiModule, "apiFetch").mockResolvedValue({
			ok: true,
			json: async () => consolidatedResponse(),
		} as Response);

		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
	});

	afterEach(() => {
		cleanup();
	});

	function renderComponent() {
		return render(
			<QueryClientProvider client={queryClient}>
				<AnalyticsDashboard />
			</QueryClientProvider>,
		);
	}

	it("renders title, description and preset buttons", async () => {
		renderComponent();

		expect(screen.getByText("Analytics Dashboard")).toBeDefined();
		expect(screen.getByText("Time Range:")).toBeDefined();
		expect(screen.getByRole("button", { name: "7D" })).toBeDefined();
		expect(screen.getByRole("button", { name: "30D" })).toBeDefined();
		expect(screen.getByRole("button", { name: "90D" })).toBeDefined();
		expect(screen.getByRole("button", { name: "1Y" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Custom" })).toBeDefined();
	});

	it("loads all panels from the consolidated dashboard endpoint", async () => {
		renderComponent();

		await waitFor(() => {
			expect(mockApiFetch).toHaveBeenCalled();
		});
		const paths = mockApiFetch.mock.calls.map((c) => String(c[0]));
		expect(paths.length).toBeGreaterThan(0);
		for (const p of paths) {
			expect(p).toContain("/admin/analytics/dashboard");
		}
		expect(paths.some((p) => p.includes("/admin/analytics/usage"))).toBe(false);
		expect(paths.some((p) => p.includes("/admin/analytics/endpoint-health"))).toBe(
			false,
		);
		expect(paths.some((p) => p.includes("/admin/analytics/section-trends"))).toBe(
			false,
		);
		// Default 30D preset
		expect(paths.some((p) => p.includes("days=30"))).toBe(true);
	});

	it("handles graceful empty states when consolidated endpoint returns empty arrays", async () => {
		renderComponent();

		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 30 days/),
			).toBeDefined();
			expect(
				screen.getByText(/No endpoint health data available for the last 30 days/),
			).toBeDefined();
			expect(
				screen.getByText(/No section trend data available for the last 30 days/),
			).toBeDefined();
		});
	});

	it("renders usage KPI stats and charts when data is available", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () =>
				consolidatedResponse({
					usage: [
						{
							date: "2026-08-01",
							dau: 150,
							total_api_calls: 1200,
							timetable_searches: 300,
						},
						{
							date: "2026-08-02",
							dau: 200,
							total_api_calls: 1800,
							timetable_searches: 450,
						},
					],
				}),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Usage Overview/)).toBeDefined();
			expect(screen.getByText("200")).toBeDefined(); // Latest DAU
			expect(screen.getByText("3,000")).toBeDefined(); // Total API calls (1200 + 1800)
			expect(screen.getByText("750")).toBeDefined(); // Total searches (300 + 450)
		});
	});

	it("renders and sorts endpoint health table", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () =>
				consolidatedResponse({
					endpoint_health: [
						{
							date: "2026-08-01",
							endpoint: "/api/search",
							total_calls: 500,
							p95_latency_ms: 120.5,
							error_rate: 0.02,
						},
						{
							date: "2026-08-01",
							endpoint: "/api/timetable",
							total_calls: 1500,
							p95_latency_ms: 45.0,
							error_rate: 0.001,
						},
					],
				}),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText("/api/search")).toBeDefined();
			expect(screen.getByText("/api/timetable")).toBeDefined();
		});

		// Sort by total calls
		const totalCallsHeader = screen.getByText(/Total Calls/);
		fireEvent.click(totalCallsHeader);
		fireEvent.click(totalCallsHeader);
	});

	it("renders section trends charts when data is available", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () =>
				consolidatedResponse({
					section_trends: [
						{
							date: "2026-08-01",
							section_name: "22CSE1",
							section_year: 2,
							search_volume: 400,
						},
						{
							date: "2026-08-02",
							section_name: "22CSE1",
							section_year: 2,
							search_volume: 100,
						},
						{
							date: "2026-08-01",
							section_name: "23CSE1",
							section_year: 1,
							search_volume: 250,
						},
					],
				}),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Section Trends \(30 Days\)/)).toBeDefined();
			expect(screen.getByText("Top 10 Sections by Searches")).toBeDefined();
			expect(screen.getByText("Searches by Academic Year")).toBeDefined();
		});
		expect(screen.queryByText(/No section trend data available/)).toBeNull();
		expect(screen.getByTestId("bar-chart")).toBeDefined();
		expect(screen.getByTestId("pie-chart")).toBeDefined();
	});

	it("shows freshness metadata and stale banner when snapshot is stale", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () =>
				consolidatedResponse({
					usage: [
						{
							date: "2026-08-01",
							dau: 150,
							total_api_calls: 1200,
							timetable_searches: 300,
						},
					],
					stale: true,
				}),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Data as of/)).toBeDefined();
			expect(screen.getByText(/Stale snapshot/)).toBeDefined();
		});
	});

	it("shows freshness metadata when snapshot is fresh", async () => {
		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Data as of/)).toBeDefined();
			expect(screen.queryByText(/Stale snapshot/)).toBeNull();
		});
	});

	it("renders loading skeletons while consolidated endpoint is pending", async () => {
		mockApiFetch.mockImplementation(() => new Promise<Response>(() => {}));

		const { container } = renderComponent();

		await waitFor(() => {
			expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
		});
	});

	it("renders confirmed empty days with zero values", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () =>
				consolidatedResponse({
					usage: [
						{
							date: "2026-08-01",
							dau: 0,
							total_api_calls: 0,
							timetable_searches: 0,
						},
					],
				}),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Usage Overview/)).toBeDefined();
			// Zero DAU renders (at least one zero KPI), and no empty-state text
			expect(screen.getAllByText("0").length).toBeGreaterThan(0);
			expect(screen.queryByText(/No usage data available/)).toBeNull();
		});
	});

	it("distinguishes stale snapshot from empty data when both occur", async () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: async () => consolidatedResponse({ stale: true }),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Stale snapshot/)).toBeDefined();
			expect(
				screen.getByText(/No usage data available for the last 30 days/),
			).toBeDefined();
		});
	});

	it("renders error state when consolidated endpoint fails", async () => {
		mockApiFetch.mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({ detail: "Analytics temporarily unavailable" }),
		} as unknown as Response);

		renderComponent();

		await waitFor(() => {
			expect(screen.getAllByText(/Failed to load dashboard/).length).toBeGreaterThan(
				0,
			);
		});
	});

	it("preserves 90D/1Y/custom range behavior", async () => {
		renderComponent();

		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 30 days/),
			).toBeDefined();
		});

		fireEvent.click(screen.getByRole("button", { name: "90D" }));
		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 90 days/),
			).toBeDefined();
		});

		fireEvent.click(screen.getByRole("button", { name: "1Y" }));
		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 365 days/),
			).toBeDefined();
		});

		fireEvent.click(screen.getByRole("button", { name: "Custom" }));
		const daysInput = screen.getByRole("spinbutton");
		fireEvent.change(daysInput, { target: { value: "45" } });
		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 45 days/),
			).toBeDefined();
		});

		const paths = mockApiFetch.mock.calls.map((c) => String(c[0]));
		expect(paths.some((p) => p.includes("days=90"))).toBe(true);
		expect(paths.some((p) => p.includes("days=365"))).toBe(true);
		expect(paths.some((p) => p.includes("days=45"))).toBe(true);
	});

	it("updates range preset when button clicked", async () => {
		renderComponent();

		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 30 days/),
			).toBeDefined();
		});

		const btn7D = screen.getByRole("button", { name: "7D" });
		fireEvent.click(btn7D);

		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 7 days/),
			).toBeDefined();
		});
		const paths = mockApiFetch.mock.calls.map((c) => String(c[0]));
		expect(paths.some((p) => p.includes("days=7"))).toBe(true);
	});
});
