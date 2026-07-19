import { createFileRoute, redirect } from "@tanstack/react-router";
import { Landing } from "#/components/Landing";
import { getSavedSectionIds } from "#/lib/storage";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		const saved = getSavedSectionIds();
		if (saved && saved.length > 0) {
			throw redirect({ to: "/timetable", search: { section_id: saved } });
		}
	},
	component: Landing,
});
