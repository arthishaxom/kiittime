import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export const Route = createFileRoute("/_authenticated/announcements")({
	component: RouteComponent,
});

const TITLE_MAX = 80;
const BODY_MAX = 500;
const LINK_LABEL_MAX = 30;

interface Announcement {
	id: number;
	title: string;
	body: string;
	link_label: string | null;
	link_url: string | null;
	created_at: string;
}

function RouteComponent() {
	const auth = useAuth();
	const queryClient = useQueryClient();

	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [linkLabel, setLinkLabel] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [clearOpen, setClearOpen] = useState(false);

	const currentQuery = useQuery({
		queryKey: ["admin", "announcement", "current"],
		queryFn: async () => {
			const res = await apiFetch("/announcements/current");
			if (!res.ok) throw new Error("Failed to load current announcement");
			return (await res.json()) as Announcement | null;
		},
	});

	const publishMutation = useMutation({
		mutationFn: async () => {
			const res = await apiFetch(
				"/admin/announcements",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title,
						body,
						link_label: linkLabel || null,
						link_url: linkUrl || null,
					}),
				},
				auth.token ?? undefined,
			);
			if (!res.ok) {
				const detail = await res
					.json()
					.then((d) => d.detail)
					.catch(() => res.statusText);
				throw new Error(
					typeof detail === "string" ? detail : JSON.stringify(detail),
				);
			}
			return res.json() as Promise<Announcement>;
		},
		onSuccess: () => {
			setError(null);
			setTitle("");
			setBody("");
			setLinkLabel("");
			setLinkUrl("");
			toast.success("Announcement published");
			queryClient.invalidateQueries({
				queryKey: ["admin", "announcement", "current"],
			});
		},
		onError: (e) => {
			setError(
				e instanceof Error ? e.message : "Failed to publish announcement",
			);
		},
	});

	const clearMutation = useMutation({
		mutationFn: async () => {
			const res = await apiFetch(
				"/admin/announcements/clear",
				{ method: "POST" },
				auth.token ?? undefined,
			);
			if (!res.ok) {
				const detail = await res
					.json()
					.then((d) => d.detail)
					.catch(() => res.statusText);
				throw new Error(
					typeof detail === "string" ? detail : JSON.stringify(detail),
				);
			}
			return res.json();
		},
		onSuccess: () => {
			setClearOpen(false);
			toast.success("Announcement cleared");
			queryClient.invalidateQueries({
				queryKey: ["admin", "announcement", "current"],
			});
		},
		onError: (e) => {
			toast.error(
				e instanceof Error ? e.message : "Failed to clear announcement",
			);
		},
	});

	const titleOverLimit = title.length > TITLE_MAX;
	const bodyOverLimit = body.length > BODY_MAX;
	const linkLabelOverLimit = linkLabel.length > LINK_LABEL_MAX;
	const publishDisabled =
		!title ||
		!body ||
		titleOverLimit ||
		bodyOverLimit ||
		linkLabelOverLimit ||
		publishMutation.isPending;

	return (
		<div className="mx-auto max-w-lg p-6 flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Current Announcement</CardTitle>
					<CardDescription>
						What students currently see when they open the app
					</CardDescription>
				</CardHeader>
				<CardContent>
					{currentQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : currentQuery.data ? (
						<div className="flex flex-col gap-3">
							<div>
								<p className="font-semibold">{currentQuery.data.title}</p>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{currentQuery.data.body}
								</p>
								{currentQuery.data.link_url && (
									<p className="text-sm">
										<a
											href={currentQuery.data.link_url}
											target="_blank"
											rel="noreferrer"
											className="text-primary underline"
										>
											{currentQuery.data.link_label ||
												currentQuery.data.link_url}
										</a>
									</p>
								)}
							</div>
							<AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
								<AlertDialogTrigger asChild>
									<Button
										variant="destructive"
										size="sm"
										className="self-start"
									>
										Clear announcement
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Clear current announcement?
										</AlertDialogTitle>
										<AlertDialogDescription>
											Students will stop seeing this announcement. This does not
											delete its history, only deactivates it.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											className="bg-destructive text-white hover:bg-destructive/90"
											disabled={clearMutation.isPending}
											onClick={() => clearMutation.mutate()}
										>
											{clearMutation.isPending
												? "Clearing..."
												: "Clear announcement"}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No active announcement
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Publish Announcement</CardTitle>
					<CardDescription>
						Publishing supersedes and deactivates whatever is currently active
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="flex flex-col gap-2">
						<Label htmlFor="announcement-title">Title</Label>
						<Input
							id="announcement-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							aria-invalid={titleOverLimit}
						/>
						<p
							className={
								"text-xs " +
								(titleOverLimit ? "text-destructive" : "text-muted-foreground")
							}
						>
							{title.length}/{TITLE_MAX}
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="announcement-body">Body</Label>
						<Textarea
							id="announcement-body"
							value={body}
							onChange={(e) => setBody(e.target.value)}
							aria-invalid={bodyOverLimit}
						/>
						<p
							className={
								"text-xs " +
								(bodyOverLimit ? "text-destructive" : "text-muted-foreground")
							}
						>
							{body.length}/{BODY_MAX}
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="announcement-link-label">
							Link label (optional)
						</Label>
						<Input
							id="announcement-link-label"
							value={linkLabel}
							onChange={(e) => setLinkLabel(e.target.value)}
							aria-invalid={linkLabelOverLimit}
						/>
						<p
							className={
								"text-xs " +
								(linkLabelOverLimit
									? "text-destructive"
									: "text-muted-foreground")
							}
						>
							{linkLabel.length}/{LINK_LABEL_MAX}
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="announcement-link-url">Link URL (optional)</Label>
						<Input
							id="announcement-link-url"
							type="url"
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
							placeholder="https://..."
						/>
					</div>

					<Button
						onClick={() => publishMutation.mutate()}
						disabled={publishDisabled}
					>
						{publishMutation.isPending ? "Publishing..." : "Publish"}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
