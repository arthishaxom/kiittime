import { createFileRoute } from "@tanstack/react-router";
import { UploadDashboard } from "../../components/UploadDashboard";

export const Route = createFileRoute("/_authenticated/")({
	component: UploadDashboard,
});
