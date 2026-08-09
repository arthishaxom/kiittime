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
			json: async () => [],
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

	it("handles graceful empty states when endpoints return empty array []", async () => {
		renderComponent();

		await waitFor(() => {
			expect(
				screen.getByText(/No usage data available for the last 30 days/),
			).toBeDefined();
			expect(
				screen.getByText(/No endpoint health data available for the last 30 days/),
			).toBeDefined();
			expect(
				screen.getByText(/No section trend data available for the last 7 days/),
			).toBeDefined();
		});
	});

	it("renders usage KPI stats and charts when data is available", async () => {
		mockApiFetch.mockImplementation(async (path: string) => {
			if (path.includes("/admin/analytics/usage")) {
				return {
					ok: true,
					json: async () => [
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
				} as unknown as Response;
			}
			return { ok: true, json: async () => [] } as unknown as Response;
		});

		renderComponent();

		await waitFor(() => {
			expect(screen.getByText(/Usage Overview/)).toBeDefined();
			expect(screen.getByText("200")).toBeDefined(); // Latest DAU
			expect(screen.getByText("3,000")).toBeDefined(); // Total API calls (1200 + 1800)
			expect(screen.getByText("750")).toBeDefined(); // Total searches (300 + 450)
		});
	});

	it("renders and sorts endpoint health table", async () => {
		mockApiFetch.mockImplementation(async (path: string) => {
			if (path.includes("/admin/analytics/endpoint-health")) {
				return {
					ok: true,
					json: async () => [
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
				} as unknown as Response;
			}
			return { ok: true, json: async () => [] } as unknown as Response;
		});

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
	});
});
