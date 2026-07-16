import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "../../lib/auth"
import { apiFetch } from "../../lib/api"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui/select"
import { Skeleton } from "../../components/ui/skeleton"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../components/ui/table"

export const Route = createFileRoute("/_authenticated/review/$uploadId")({
	component: RouteComponent,
})

interface SessionDetail {
	section: string
	day: string
	period_number: number
	course_code: string
	faculty_name: string
	room_number: string
	change_type?: "added" | "changed" | "removed" | "unchanged" | null
	previous?: SessionDetail | null
}

interface DiffSummary {
	session_count: number
	sections: string[]
	session_details?: SessionDetail[]
}

const PAGE_SIZE = 25

interface UploadData {
	upload_id: number
	diff: DiffSummary
	status: string
}

type ScopeMode = "full" | "year" | "sections"

function RouteComponent() {
	const { uploadId } = Route.useParams()
	const auth = useAuth()
	const router = useRouter()
	const queryClient = useQueryClient()

	const [scopeMode, setScopeMode] = useState<ScopeMode>("full")
	const [year, setYear] = useState("")
	const [sectionIdsInput, setSectionIdsInput] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [page, setPage] = useState(0)

	const { data, isLoading, isError, error: queryError } = useQuery({
		queryKey: ["upload", uploadId],
		queryFn: async () => {
			const res = await apiFetch(
				`/admin/uploads/${uploadId}`,
				{},
				auth.token ?? undefined,
			)
			if (!res.ok) {
				const detail = await res.json().then((d) => d.detail).catch(() => res.statusText)
				throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
			}
			return res.json() as Promise<UploadData>
		},
	})

	const details = data?.diff?.session_details ?? []
	const totalPages = Math.max(1, Math.ceil(details.length / PAGE_SIZE))
	const pageDetails = useMemo(
		() => details.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
		[details, page],
	)

	// Reset to page 0 when a new upload's details arrive
	useEffect(() => {
		setPage(0)
	}, [data?.upload_id])

	const isPending = data?.status === "pending"

	const approveMutation = useMutation({
		mutationFn: async () => {
			const body = buildScopeBody(scopeMode, year, sectionIdsInput)
			const res = await apiFetch(
				`/admin/uploads/${uploadId}/approve`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
				auth.token ?? undefined,
			)
			if (!res.ok) {
				const detail = await res.json().then((d) => d.detail).catch(() => res.statusText)
				const status = res.status
				throw new ApiError(
					typeof detail === "string" ? detail : JSON.stringify(detail),
					status,
				)
			}
			return res.json() as Promise<{ status: string; upload_id: number }>
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["upload", uploadId] })
			toast.success("Upload approved successfully")
			router.navigate({ to: "/" })
		},
		onError: (e) => {
			if (e instanceof ApiError && e.status === 409) {
				setError(`Already processed: ${e.message}`)
			} else {
				setError(e instanceof Error ? e.message : "Approval failed")
			}
		},
	})

	const rejectMutation = useMutation({
		mutationFn: async () => {
			const res = await apiFetch(
				`/admin/uploads/${uploadId}/reject`,
				{ method: "POST" },
				auth.token ?? undefined,
			)
			if (!res.ok) {
				const detail = await res.json().then((d) => d.detail).catch(() => res.statusText)
				const status = res.status
				throw new ApiError(
					typeof detail === "string" ? detail : JSON.stringify(detail),
					status,
				)
			}
			return res.json() as Promise<{ status: string; upload_id: number }>
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["upload", uploadId] })
			toast.success("Upload rejected")
			router.navigate({ to: "/" })
		},
		onError: (e) => {
			if (e instanceof ApiError && e.status === 409) {
				setError(`Already processed: ${e.message}`)
			} else {
				setError(e instanceof Error ? e.message : "Rejection failed")
			}
		},
	})

	if (isLoading) {
		return (
			<div className="mx-auto max-w-lg p-6">
				<Card>
					<CardContent className="flex flex-col gap-3 pt-6">
						<Skeleton className="h-6 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-4 w-full" />
					</CardContent>
				</Card>
			</div>
		)
	}

	if (isError) {
		return (
			<div className="mx-auto max-w-lg p-6">
				<Alert variant="destructive">
					<AlertTitle>Failed to load upload</AlertTitle>
					<AlertDescription>
						{queryError instanceof Error ? queryError.message : "Unknown error"}
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	if (!data) return null

	const { diff } = data

	return (
		<div className="mx-auto max-w-5xl p-6">
			<Link
				to="/"
				className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				&larr; Back to Upload
			</Link>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Upload #{uploadId}</CardTitle>
						<StatusBadge status={data.status} />
					</div>
					<CardDescription>
						{diff.session_count} sessions across {diff.sections.length} section
						{diff.sections.length !== 1 ? "s" : ""}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					{diff.sections.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{diff.sections.map((s) => (
								<Badge key={s} variant="secondary">
									{s}
								</Badge>
							))}
						</div>
					)}

					{details.length > 0 && (
						<>
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Section</TableHead>
											<TableHead>Day</TableHead>
											<TableHead>Period</TableHead>
											<TableHead>Course</TableHead>
											<TableHead>Faculty</TableHead>
											<TableHead>Room</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{pageDetails.map((s, i) => (
											<TableRow key={i}>
												<TableCell>{s.section}</TableCell>
												<TableCell>{s.day}</TableCell>
												<TableCell>{s.period_number}</TableCell>
												<TableCell>{s.course_code}</TableCell>
												<TableCell>{s.faculty_name}</TableCell>
												<TableCell>{s.room_number}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{totalPages > 1 && (
								<div className="flex items-center justify-center gap-3">
									<Button
										variant="outline"
										size="sm"
										disabled={page === 0}
										onClick={() => setPage((p) => p - 1)}
									>
										Previous
									</Button>
									<span className="text-sm text-muted-foreground">
										Page {page + 1} of {totalPages}
									</span>
									<Button
										variant="outline"
										size="sm"
										disabled={page >= totalPages - 1}
										onClick={() => setPage((p) => p + 1)}
									>
										Next
									</Button>
								</div>
							)}
						</>
					)}

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{isPending ? (
						<>
							<div className="flex flex-col gap-2">
								<Label htmlFor="scope-mode">Scope</Label>
								<Select
									value={scopeMode}
									onValueChange={(v: ScopeMode) => setScopeMode(v)}
								>
									<SelectTrigger id="scope-mode">
										<SelectValue placeholder="Select scope" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="full">Full semester</SelectItem>
										<SelectItem value="year">By year</SelectItem>
										<SelectItem value="sections">By sections</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{scopeMode === "year" && (
								<div className="flex flex-col gap-2">
									<Label htmlFor="year">Year</Label>
									<Input
										id="year"
										type="number"
										min={1}
										max={4}
										placeholder="e.g. 4"
										value={year}
										onChange={(e) => setYear(e.target.value)}
									/>
								</div>
							)}

							{scopeMode === "sections" && (
								<div className="flex flex-col gap-2">
									<Label htmlFor="section-ids">Section IDs</Label>
									<Input
										id="section-ids"
										placeholder="e.g. 1, 2, 3"
										value={sectionIdsInput}
										onChange={(e) => setSectionIdsInput(e.target.value)}
									/>
								</div>
							)}

							<div className="flex gap-3">
								<Button
									onClick={() => approveMutation.mutate()}
									disabled={approveMutation.isPending}
									className="flex-1"
								>
									{approveMutation.isPending ? "Approving..." : "Approve"}
								</Button>
								<Button
									variant="destructive"
									onClick={() => rejectMutation.mutate()}
									disabled={rejectMutation.isPending}
									className="flex-1"
								>
									{rejectMutation.isPending ? "Rejecting..." : "Reject"}
								</Button>
							</div>
						</>
					) : (
						<p className="text-sm text-muted-foreground">
							This upload has already been{" "}
							{data.status === "approved" ? "approved" : "rejected"}.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

function StatusBadge({ status }: { status: string }) {
	const variant =
		status === "approved"
			? "default"
			: status === "rejected"
				? "destructive"
				: "secondary"
	return <Badge variant={variant}>{status}</Badge>
}

class ApiError extends Error {
	status: number
	constructor(message: string, status: number) {
		super(message)
		this.status = status
	}
}

function buildScopeBody(
	mode: ScopeMode,
	year: string,
	sectionIdsInput: string,
): { section_ids: number[] | null; year: number | null } {
	switch (mode) {
		case "year": {
			const parsed = Number.parseInt(year, 10)
			return { section_ids: null, year: Number.isNaN(parsed) ? null : parsed }
		}
		case "sections": {
			const ids = sectionIdsInput
				.split(",")
				.map((s) => Number.parseInt(s.trim(), 10))
				.filter((n) => !Number.isNaN(n))
			return { section_ids: ids.length > 0 ? ids : null, year: null }
		}
		default:
			return { section_ids: null, year: null }
	}
}
