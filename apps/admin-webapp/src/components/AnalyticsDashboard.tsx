import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

export interface DailyUsageItem {
	date: string;
	dau: number;
	total_api_calls: number;
	timetable_searches: number;
}

export interface EndpointHealthItem {
	date: string;
	endpoint: string;
	total_calls: number;
	p95_latency_ms: number;
	error_rate: number;
}

export interface SectionTrendItem {
	date: string;
	section_name: string;
	section_year: number;
	search_volume: number;
}

type RangePreset = "7D" | "30D" | "90D" | "1Y" | "Custom";

const PIE_COLORS = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
];

export function AnalyticsDashboard() {
	const auth = useAuth();
	const [preset, setPreset] = useState<RangePreset>("30D");
	const [customDays, setCustomDays] = useState<number>(30);

	// Compute days for each endpoint based on shared range preset
	const { usageDays, endpointDays, sectionDays } = useMemo(() => {
		switch (preset) {
			case "7D":
				return { usageDays: 7, endpointDays: 7, sectionDays: 7 };
			case "30D":
				return { usageDays: 30, endpointDays: 30, sectionDays: 7 };
			case "90D":
				return { usageDays: 90, endpointDays: 90, sectionDays: 90 };
			case "1Y":
				return { usageDays: 365, endpointDays: 365, sectionDays: 365 };
			case "Custom":
				const validDays = Math.max(1, Math.min(365, customDays || 1));
				return {
					usageDays: validDays,
					endpointDays: validDays,
					sectionDays: validDays,
				};
		}
	}, [preset, customDays]);

	// Usage Overview Query
	const usageQuery = useQuery<DailyUsageItem[]>({
		queryKey: ["admin", "analytics", "usage", usageDays],
		queryFn: async () => {
			const res = await apiFetch(
				`/admin/analytics/usage?days=${usageDays}`,
				{},
				auth.token ?? undefined,
			);
			if (!res.ok) throw new Error("Failed to fetch usage metrics");
			return res.json();
		},
		staleTime: 1000 * 60 * 5,
	});

	// Endpoint Health Query
	const healthQuery = useQuery<EndpointHealthItem[]>({
		queryKey: ["admin", "analytics", "endpoint-health", endpointDays],
		queryFn: async () => {
			const res = await apiFetch(
				`/admin/analytics/endpoint-health?days=${endpointDays}`,
				{},
				auth.token ?? undefined,
			);
			if (!res.ok) throw new Error("Failed to fetch endpoint health metrics");
			return res.json();
		},
		staleTime: 1000 * 60 * 5,
	});

	// Section Trends Query
	const trendsQuery = useQuery<SectionTrendItem[]>({
		queryKey: ["admin", "analytics", "section-trends", sectionDays],
		queryFn: async () => {
			const res = await apiFetch(
				`/admin/analytics/section-trends?days=${sectionDays}`,
				{},
				auth.token ?? undefined,
			);
			if (!res.ok) throw new Error("Failed to fetch section trends metrics");
			return res.json();
		},
		staleTime: 1000 * 60 * 5,
	});

	return (
		<div className="mx-auto max-w-7xl p-6 flex flex-col gap-8">
			{/* Dashboard Title & Time-Range Selector */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">
						Analytics Dashboard
					</h1>
					<p className="text-sm text-muted-foreground">
						System performance and usage trends from R2 Gold Delta tables
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground mr-1">
						Time Range:
					</span>
					{(["7D", "30D", "90D", "1Y", "Custom"] as const).map((p) => (
						<Button
							key={p}
							variant={preset === p ? "default" : "outline"}
							size="sm"
							onClick={() => setPreset(p)}
						>
							{p}
						</Button>
					))}
					{preset === "Custom" && (
						<div className="flex items-center gap-2 ml-2">
							<span className="text-xs text-muted-foreground">Days:</span>
							<Input
								type="number"
								min={1}
								max={365}
								value={customDays}
								onChange={(e) => setCustomDays(Number(e.target.value))}
								className="w-20 h-8 text-xs"
							/>
						</div>
					)}
				</div>
			</div>

			{/* Panel 1: Usage Overview */}
			<UsageOverviewPanel
				query={usageQuery}
				days={usageDays}
			/>

			{/* Panel 2: Endpoint Health */}
			<EndpointHealthPanel
				query={healthQuery}
				days={endpointDays}
			/>

			{/* Panel 3: Section Trends */}
			<SectionTrendsPanel
				query={trendsQuery}
				days={sectionDays}
			/>
		</div>
	);
}

/* =========================================================================
   USAGE OVERVIEW PANEL
   ========================================================================= */
interface UsagePanelProps {
	query: ReturnType<typeof useQuery<DailyUsageItem[]>>;
	days: number;
}

function UsageOverviewPanel({ query, days }: UsagePanelProps) {
	const { data, isLoading, isError, error } = query;

	const { latestDau, totalApiCalls, totalSearches } = useMemo(() => {
		if (!data || data.length === 0) {
			return { latestDau: 0, totalApiCalls: 0, totalSearches: 0 };
		}
		const latestDau = data[data.length - 1]?.dau ?? 0;
		const totalApiCalls = data.reduce((acc, curr) => acc + curr.total_api_calls, 0);
		const totalSearches = data.reduce(
			(acc, curr) => acc + curr.timetable_searches,
			0,
		);
		return { latestDau, totalApiCalls, totalSearches };
	}, [data]);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Usage Overview ({days} Days)</CardTitle>
					<CardDescription>Daily Active Users & API Traffic</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Usage Overview ({days} Days)</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert variant="destructive">
						<AlertDescription>
							{error instanceof Error ? error.message : "Failed to load usage data"}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Usage Overview ({days} Days)</CardTitle>
					<CardDescription>Daily Active Users & API Traffic</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground text-center py-8">
						No usage data available for the last {days} days.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Usage Overview ({days} Days)</CardTitle>
				<CardDescription>Daily Active Users & API Traffic</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* 3 KPI Stat Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
						<p className="text-xs font-medium text-muted-foreground">Today's DAU</p>
						<p className="text-2xl font-bold mt-1">{latestDau.toLocaleString()}</p>
					</div>
					<div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
						<p className="text-xs font-medium text-muted-foreground">Total API Calls</p>
						<p className="text-2xl font-bold mt-1">{totalApiCalls.toLocaleString()}</p>
					</div>
					<div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
						<p className="text-xs font-medium text-muted-foreground">
							Timetable Searches
						</p>
						<p className="text-2xl font-bold mt-1">{totalSearches.toLocaleString()}</p>
					</div>
				</div>

				{/* Charts */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* DAU Chart */}
					<div className="flex flex-col gap-2">
						<h3 className="text-sm font-semibold">Daily Active Users (DAU)</h3>
						<div className="h-64 w-full min-h-[250px]">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={data}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
									<XAxis dataKey="date" fontSize={11} />
									<YAxis fontSize={11} />
									<Tooltip />
									<Line
										type="monotone"
										dataKey="dau"
										name="DAU"
										stroke="#3b82f6"
										strokeWidth={2}
										dot={{ r: 3 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					</div>

					{/* Dual-Line Chart: API Calls & Searches */}
					<div className="flex flex-col gap-2">
						<h3 className="text-sm font-semibold">API Calls vs Timetable Searches</h3>
						<div className="h-64 w-full min-h-[250px]">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={data}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
									<XAxis dataKey="date" fontSize={11} />
									<YAxis fontSize={11} />
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="total_api_calls"
										name="API Calls"
										stroke="#10b981"
										strokeWidth={2}
										dot={false}
									/>
									<Line
										type="monotone"
										dataKey="timetable_searches"
										name="Searches"
										stroke="#8b5cf6"
										strokeWidth={2}
										dot={false}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/* =========================================================================
   ENDPOINT HEALTH PANEL
   ========================================================================= */
interface HealthPanelProps {
	query: ReturnType<typeof useQuery<EndpointHealthItem[]>>;
	days: number;
}

type HealthSortField = "endpoint" | "total_calls" | "p95_latency_ms" | "error_rate";

function EndpointHealthPanel({ query, days }: HealthPanelProps) {
	const { data, isLoading, isError, error } = query;
	const [sortField, setSortField] = useState<HealthSortField>("total_calls");
	const [sortAsc, setSortAsc] = useState<boolean>(false);

	// Aggregate per endpoint
	const aggregatedEndpoints = useMemo(() => {
		if (!data || data.length === 0) return [];
		const map = new Map<
			string,
			{ total_calls: number; p95Sum: number; errorRateSum: number; count: number }
		>();

		for (const item of data) {
			const existing = map.get(item.endpoint) || {
				total_calls: 0,
				p95Sum: 0,
				errorRateSum: 0,
				count: 0,
			};
			existing.total_calls += item.total_calls;
			existing.p95Sum += item.p95_latency_ms;
			existing.errorRateSum += item.error_rate;
			existing.count += 1;
			map.set(item.endpoint, existing);
		}

		return Array.from(map.entries()).map(([endpoint, stats]) => ({
			endpoint,
			total_calls: stats.total_calls,
			p95_latency_ms: stats.count > 0 ? stats.p95Sum / stats.count : 0,
			error_rate: stats.count > 0 ? stats.errorRateSum / stats.count : 0,
		}));
	}, [data]);

	// Sorted endpoints
	const sortedEndpoints = useMemo(() => {
		return [...aggregatedEndpoints].sort((a, b) => {
			let diff = 0;
			if (sortField === "endpoint") diff = a.endpoint.localeCompare(b.endpoint);
			else diff = a[sortField] - b[sortField];
			return sortAsc ? diff : -diff;
		});
	}, [aggregatedEndpoints, sortField, sortAsc]);

	// Top 5 endpoints over time chart data
	const top5LatencyChartData = useMemo(() => {
		if (!data || data.length === 0) return { dates: [], top5: [] };

		// Top 5 endpoints by total calls
		const top5Endpoints = aggregatedEndpoints
			.sort((a, b) => b.total_calls - a.total_calls)
			.slice(0, 5)
			.map((e) => e.endpoint);

		const top5Set = new Set(top5Endpoints);
		const datesMap = new Map<string, Record<string, number | string>>();

		for (const item of data) {
			if (!top5Set.has(item.endpoint)) continue;
			const row = datesMap.get(item.date) || { date: item.date };
			row[item.endpoint] = item.p95_latency_ms;
			datesMap.set(item.date, row);
		}

		const dates = Array.from(datesMap.values()).sort((a, b) =>
			String(a.date).localeCompare(String(b.date)),
		);

		return { dates, top5: top5Endpoints };
	}, [data, aggregatedEndpoints]);

	function handleSort(field: HealthSortField) {
		if (sortField === field) {
			setSortAsc(!sortAsc);
		} else {
			setSortField(field);
			setSortAsc(false);
		}
	}

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Endpoint Health ({days} Days)</CardTitle>
					<CardDescription>Latency and error rates per API endpoint</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Endpoint Health ({days} Days)</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert variant="destructive">
						<AlertDescription>
							{error instanceof Error
								? error.message
								: "Failed to load endpoint health"}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Endpoint Health ({days} Days)</CardTitle>
					<CardDescription>Latency and error rates per API endpoint</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground text-center py-8">
						No endpoint health data available for the last {days} days.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Endpoint Health ({days} Days)</CardTitle>
				<CardDescription>Latency and error rates per API endpoint</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* Top 5 Endpoints Latency Line Chart */}
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">
						P95 Latency over Time (Top 5 Endpoints by Volume)
					</h3>
					<div className="h-64 w-full min-h-[250px]">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={top5LatencyChartData.dates}>
								<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
								<XAxis dataKey="date" fontSize={11} />
								<YAxis fontSize={11} unit=" ms" />
								<Tooltip />
								<Legend />
								{top5LatencyChartData.top5.map((ep, idx) => (
									<Line
										key={ep}
										type="monotone"
										dataKey={ep}
										name={ep}
										stroke={PIE_COLORS[idx % PIE_COLORS.length]}
										strokeWidth={2}
										dot={false}
									/>
								))}
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Sortable Endpoint Table */}
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">Endpoint Summary Table</h3>
					<div className="rounded-md border overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead
										className="cursor-pointer hover:bg-muted/50 select-none"
										onClick={() => handleSort("endpoint")}
									>
										Endpoint {sortField === "endpoint" && (sortAsc ? "▲" : "▼")}
									</TableHead>
									<TableHead
										className="text-right cursor-pointer hover:bg-muted/50 select-none"
										onClick={() => handleSort("total_calls")}
									>
										Total Calls {sortField === "total_calls" && (sortAsc ? "▲" : "▼")}
									</TableHead>
									<TableHead
										className="text-right cursor-pointer hover:bg-muted/50 select-none"
										onClick={() => handleSort("p95_latency_ms")}
									>
										Avg P95 Latency (ms){" "}
										{sortField === "p95_latency_ms" && (sortAsc ? "▲" : "▼")}
									</TableHead>
									<TableHead
										className="text-right cursor-pointer hover:bg-muted/50 select-none"
										onClick={() => handleSort("error_rate")}
									>
										Error Rate {sortField === "error_rate" && (sortAsc ? "▲" : "▼")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedEndpoints.map((item) => (
									<TableRow key={item.endpoint}>
										<TableCell className="font-mono text-xs">{item.endpoint}</TableCell>
										<TableCell className="text-right font-medium">
											{item.total_calls.toLocaleString()}
										</TableCell>
										<TableCell className="text-right">
											{item.p95_latency_ms.toFixed(1)} ms
										</TableCell>
										<TableCell className="text-right">
											{(item.error_rate * 100).toFixed(2)}%
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/* =========================================================================
   SECTION TRENDS PANEL
   ========================================================================= */
interface TrendsPanelProps {
	query: ReturnType<typeof useQuery<SectionTrendItem[]>>;
	days: number;
}

function SectionTrendsPanel({ query, days }: TrendsPanelProps) {
	const { data, isLoading, isError, error } = query;

	// Top 10 sections by search volume
	const top10Sections = useMemo(() => {
		if (!data || data.length === 0) return [];
		const map = new Map<string, number>();
		for (const item of data) {
			map.set(
				item.section_name,
				(map.get(item.section_name) || 0) + item.search_volume,
			);
		}
		return Array.from(map.entries())
			.map(([section_name, search_volume]) => ({ section_name, search_volume }))
			.sort((a, b) => b.search_volume - a.search_volume)
			.slice(0, 10);
	}, [data]);

	// Search volume by section year (Academic Year)
	const yearTrends = useMemo(() => {
		if (!data || data.length === 0) return [];
		const map = new Map<number, number>();
		for (const item of data) {
			map.set(
				item.section_year,
				(map.get(item.section_year) || 0) + item.search_volume,
			);
		}
		return Array.from(map.entries())
			.map(([year, search_volume]) => ({
				name: `Year ${year}`,
				search_volume,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [data]);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Section Trends ({days} Days)</CardTitle>
					<CardDescription>
						Search volume distribution across sections & academic years
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Skeleton className="h-64 w-full" />
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Section Trends ({days} Days)</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert variant="destructive">
						<AlertDescription>
							{error instanceof Error
								? error.message
								: "Failed to load section trends"}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Section Trends ({days} Days)</CardTitle>
					<CardDescription>
						Search volume distribution across sections & academic years
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground text-center py-8">
						No section trend data available for the last {days} days.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Section Trends ({days} Days)</CardTitle>
				<CardDescription>
					Search volume distribution across sections & academic years
				</CardDescription>
			</CardHeader>
			<CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Top 10 Sections Horizontal Bar Chart */}
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">Top 10 Sections by Searches</h3>
					<div className="h-64 w-full min-h-[250px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								layout="vertical"
								data={top10Sections}
								margin={{ left: 20 }}
							>
								<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
								<XAxis type="number" fontSize={11} />
								<YAxis
									type="category"
									dataKey="section_name"
									fontSize={11}
									width={60}
								/>
								<Tooltip />
								<Bar
									dataKey="search_volume"
									name="Searches"
									fill="#3b82f6"
									radius={[0, 4, 4, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Search Volume by Academic Year Donut Chart */}
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">Searches by Academic Year</h3>
					<div className="h-64 w-full min-h-[250px]">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={yearTrends}
									dataKey="search_volume"
									nameKey="name"
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={90}
									paddingAngle={4}
									label={({ name, percent }) =>
										`${name}: ${(percent * 100).toFixed(0)}%`
									}
								>
									{yearTrends.map((entry, idx) => (
										<Cell
											key={entry.name}
											fill={PIE_COLORS[idx % PIE_COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip />
								<Legend />
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
