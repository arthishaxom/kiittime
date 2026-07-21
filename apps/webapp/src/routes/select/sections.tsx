import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SectionSearch } from "#/components/SectionSearch";

const searchSchema = z.object({
	year: z.number().int().min(1).max(4).catch(1),
});

export const Route = createFileRoute("/select/sections")({
	validateSearch: searchSchema,
	component: () => <SectionSearch year={Route.useSearch().year} />,
});
