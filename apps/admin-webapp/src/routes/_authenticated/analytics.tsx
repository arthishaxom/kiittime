import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard";

export const Route = createFileRoute("/_authenticated/analytics")({
	component: AnalyticsDashboard,
});
