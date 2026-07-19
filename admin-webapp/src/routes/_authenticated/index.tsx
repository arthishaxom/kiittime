import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const CLEAR_ALL_CONFIRMATION = "CLEAR";

export const Route = createFileRoute("/_authenticated/")({
	component: RouteComponent,
});

interface InspectResult {
	sheet_names: string[];
}

interface UploadResult {
	upload_id: number;
	status: string;
}

interface RollInspectResult {
	columns: string[];
}

function RouteComponent() {
	const auth = useAuth();
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const rollFileInputRef = useRef<HTMLInputElement>(null);

	const [activeTab, setActiveTab] = useState<"timetable" | "roll-mappings">(
		"timetable",
	);

	const [file, setFile] = useState<File | null>(null);
	const [sheetName, setSheetName] = useState<string>("");
	const [year, setYear] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [rollFile, setRollFile] = useState<File | null>(null);
	const [rollYear, setRollYear] = useState<number | null>(null);
	const [rollColName, setRollColName] = useState<string>("");
	const [secColName, setSecColName] = useState<string>("");
	const [rollError, setRollError] = useState<string | null>(null);
	const [rollSuccess, setRollSuccess] = useState<string | null>(null);

	const [clearAllOpen, setClearAllOpen] = useState(false);
	const [clearAllConfirmText, setClearAllConfirmText] = useState("");

	const inspectMutation = useMutation({
		mutationFn: async (f: File) => {
			const formData = new FormData();
			formData.append("file", f);
			const res = await apiFetch(
				"/admin/uploads/inspect",
				{
					method: "POST",
					body: formData,
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
			return res.json() as Promise<InspectResult>;
		},
		onSuccess: () => {
			setError(null);
		},
		onError: (e) => {
			setError(e instanceof Error ? e.message : "Inspection failed");
		},
	});

	const uploadMutation = useMutation({
		mutationFn: async () => {
			if (!file) throw new Error("No file selected");
			const formData = new FormData();
			formData.append("file", file);
			formData.append("sheet_name", sheetName);
			formData.append("year", String(year));
			const res = await apiFetch(
				"/admin/uploads",
				{
					method: "POST",
					body: formData,
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
			return res.json() as Promise<UploadResult>;
		},
		onSuccess: (data) => {
			setError(null);
			router.navigate({
				to: "/review/$uploadId",
				params: { uploadId: String(data.upload_id) },
			});
		},
		onError: (e) => {
			setError(e instanceof Error ? e.message : "Upload failed");
		},
	});

	const rollInspectMutation = useMutation({
		mutationFn: async (f: File) => {
			const formData = new FormData();
			formData.append("file", f);
			const res = await apiFetch(
				"/admin/roll-mappings/inspect",
				{
					method: "POST",
					body: formData,
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
			return res.json() as Promise<RollInspectResult>;
		},
		onSuccess: () => {
			setRollError(null);
		},
		onError: (e) => {
			setRollError(
				e instanceof Error ? e.message : "Failed to inspect file columns",
			);
		},
	});

	const rollUploadMutation = useMutation({
		mutationFn: async () => {
			if (!rollFile) throw new Error("No file selected");
			if (rollYear === null) throw new Error("No academic year selected");
			const formData = new FormData();
			formData.append("file", rollFile);
			formData.append("academic_year", String(rollYear));
			if (rollColName.trim()) {
				formData.append("roll_col_name", rollColName.trim());
			}
			if (secColName.trim()) {
				formData.append("sec_col_name", secColName.trim());
			}
			const res = await apiFetch(
				"/admin/roll-mappings/upload",
				{
					method: "POST",
					body: formData,
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
			return res.json() as Promise<{
				status: string;
				created_count: number;
				deleted_count: number;
			}>;
		},
		onSuccess: (data) => {
			setRollError(null);
			setRollSuccess(
				`Successfully uploaded! Created ${data.created_count} mappings, deleted ${data.deleted_count} old mappings.`,
			);
			setRollFile(null);
			setRollColName("");
			setSecColName("");
			rollInspectMutation.reset();
			if (rollFileInputRef.current) {
				rollFileInputRef.current.value = "";
			}
			toast.success("Roll number mappings uploaded successfully");
		},
		onError: (e) => {
			setRollSuccess(null);
			setRollError(e instanceof Error ? e.message : "Upload failed");
		},
	});

	const clearAllMutation = useMutation({
		mutationFn: async () => {
			const res = await apiFetch(
				"/admin/clear-all",
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
			setClearAllConfirmText("");
			toast.success("All data cleared");
		},
		onError: (e) => {
			toast.error(e instanceof Error ? e.message : "Clear all failed");
		},
	});

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (f) {
			setFile(f);
			setSheetName("");
			setYear(null);
			inspectMutation.mutate(f);
		}
	}

	function handleRollFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (f) {
			setRollFile(f);
			setRollError(null);
			setRollSuccess(null);
			setRollColName("");
			setSecColName("");
			rollInspectMutation.mutate(f);
		}
	}

	function handleParse() {
		if (!file || !sheetName || year === null) return;
		uploadMutation.mutate();
	}

	function handleRollUpload() {
		if (!rollFile || rollYear === null) return;
		rollUploadMutation.mutate();
	}

	const parseDisabled = !sheetName || year === null || uploadMutation.isPending;
	const showSheetForm = inspectMutation.isSuccess && inspectMutation.data;

	return (
		<div className="mx-auto max-w-lg p-6">
			<div className="mb-6 flex gap-2">
				<Button
					variant={activeTab === "timetable" ? "default" : "outline"}
					className="flex-1"
					onClick={() => {
						setActiveTab("timetable");
						setError(null);
					}}
				>
					Timetable
				</Button>
				<Button
					variant={activeTab === "roll-mappings" ? "default" : "outline"}
					className="flex-1"
					onClick={() => {
						setActiveTab("roll-mappings");
						setRollError(null);
						setRollSuccess(null);
					}}
				>
					Roll Mappings
				</Button>
			</div>

			{activeTab === "timetable" && (
				<Card>
					<CardHeader>
						<CardTitle>Upload Timetable</CardTitle>
						<CardDescription>
							Select an Excel file to parse and upload
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="file-input">File</Label>
							<input
								id="file-input"
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls"
								className="hidden"
								onChange={handleFileChange}
							/>
							<Button
								type="button"
								variant="outline"
								className="cursor-pointer gap-2"
								onClick={() => fileInputRef.current?.click()}
								disabled={inspectMutation.isPending}
							>
								<Upload className="size-4" />
								{file ? file.name : "Select File"}
							</Button>
						</div>

						{inspectMutation.isPending && (
							<div className="flex flex-col gap-3">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						)}

						{showSheetForm && (
							<>
								<div className="flex flex-col gap-2">
									<Label htmlFor="sheet-name">Sheet</Label>
									<Select value={sheetName} onValueChange={setSheetName}>
										<SelectTrigger id="sheet-name">
											<SelectValue placeholder="Select a sheet" />
										</SelectTrigger>
										<SelectContent>
											{inspectMutation.data.sheet_names.map((name) => (
												<SelectItem key={name} value={name}>
													{name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="flex flex-col gap-2">
									<Label>Year</Label>
									<div className="flex gap-2">
										{[1, 2, 3, 4].map((y) => (
											<Button
												key={y}
												type="button"
												variant={year === y ? "default" : "outline"}
												className="flex-1"
												onClick={() => setYear(y)}
											>
												{y}
											</Button>
										))}
									</div>
								</div>

								<Button onClick={handleParse} disabled={parseDisabled}>
									{uploadMutation.isPending ? "Parsing..." : "Parse"}
								</Button>
							</>
						)}
					</CardContent>
				</Card>
			)}

			{activeTab === "roll-mappings" && (
				<Card>
					<CardHeader>
						<CardTitle>Upload Roll Mappings</CardTitle>
						<CardDescription>
							Upload a CSV or Excel file containing Roll Number to Section
							mappings
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						{rollError && (
							<Alert variant="destructive">
								<AlertDescription>{rollError}</AlertDescription>
							</Alert>
						)}
						{rollSuccess && (
							<Alert className="border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
								<AlertDescription>{rollSuccess}</AlertDescription>
							</Alert>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="roll-file-input">File</Label>
							<input
								id="roll-file-input"
								ref={rollFileInputRef}
								type="file"
								accept=".xlsx,.xls,.csv"
								className="hidden"
								onChange={handleRollFileChange}
							/>
							<Button
								type="button"
								variant="outline"
								className="cursor-pointer gap-2"
								onClick={() => rollFileInputRef.current?.click()}
								disabled={rollUploadMutation.isPending}
							>
								<Upload className="size-4" />
								{rollFile ? rollFile.name : "Select File"}
							</Button>
						</div>

						<div className="flex flex-col gap-2">
							<Label>Academic Year</Label>
							<div className="flex gap-2">
								{[1, 2, 3, 4].map((y) => (
									<Button
										key={y}
										type="button"
										variant={rollYear === y ? "default" : "outline"}
										className="flex-1"
										onClick={() => setRollYear(y)}
										disabled={rollUploadMutation.isPending}
									>
										{y}
									</Button>
								))}
							</div>
						</div>

						{rollInspectMutation.isPending && (
							<div className="flex flex-col gap-3">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						)}

						{rollInspectMutation.isSuccess && rollInspectMutation.data && (
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-2">
									<Label htmlFor="roll-col-name">
										Roll Number Column (Optional)
									</Label>
									<Select
										value={rollColName || "DEFAULT_AUTO"}
										onValueChange={(val) =>
											setRollColName(val === "DEFAULT_AUTO" ? "" : val)
										}
										disabled={rollUploadMutation.isPending}
									>
										<SelectTrigger id="roll-col-name">
											<SelectValue placeholder="Default (Auto-detect)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="DEFAULT_AUTO">
												Default (Auto-detect)
											</SelectItem>
											{rollInspectMutation.data.columns.map((col) => (
												<SelectItem key={col} value={col}>
													{col}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="sec-col-name">
										Section Column (Optional)
									</Label>
									<Select
										value={secColName || "DEFAULT_AUTO"}
										onValueChange={(val) =>
											setSecColName(val === "DEFAULT_AUTO" ? "" : val)
										}
										disabled={rollUploadMutation.isPending}
									>
										<SelectTrigger id="sec-col-name">
											<SelectValue placeholder="Default (Auto-detect)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="DEFAULT_AUTO">
												Default (Auto-detect)
											</SelectItem>
											{rollInspectMutation.data.columns.map((col) => (
												<SelectItem key={col} value={col}>
													{col}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}

						<Button
							onClick={handleRollUpload}
							disabled={
								!rollFile || rollYear === null || rollUploadMutation.isPending
							}
						>
							{rollUploadMutation.isPending
								? "Uploading..."
								: "Upload Mappings"}
						</Button>
					</CardContent>
				</Card>
			)}

			<Card className="mt-6 border-destructive/50">
				<CardHeader>
					<CardTitle>Danger Zone</CardTitle>
					<CardDescription>
						Irreversibly wipes all sections, courses, faculty, rooms, class
						sessions, and upload history. Use at the start of a new semester.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AlertDialog
						open={clearAllOpen}
						onOpenChange={(open) => {
							setClearAllOpen(open);
							if (!open) setClearAllConfirmText("");
						}}
					>
						<AlertDialogTrigger asChild>
							<Button variant="destructive">Clear all data</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Clear all data?</AlertDialogTitle>
								<AlertDialogDescription>
									This permanently deletes every section, course, faculty
									member, room, class session, and upload record. This cannot be
									undone. Type{" "}
									<span className="font-mono font-semibold">
										{CLEAR_ALL_CONFIRMATION}
									</span>{" "}
									to confirm.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<Input
								autoFocus
								value={clearAllConfirmText}
								onChange={(e) => setClearAllConfirmText(e.target.value)}
								placeholder={CLEAR_ALL_CONFIRMATION}
							/>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									className="bg-destructive text-white hover:bg-destructive/90"
									disabled={
										clearAllConfirmText !== CLEAR_ALL_CONFIRMATION ||
										clearAllMutation.isPending
									}
									onClick={() => clearAllMutation.mutate()}
								>
									{clearAllMutation.isPending
										? "Clearing..."
										: "Clear all data"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</CardContent>
			</Card>
		</div>
	);
}
