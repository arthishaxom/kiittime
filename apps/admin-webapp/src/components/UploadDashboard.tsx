import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	FileSpreadsheet,
	FileText,
	Loader2,
	Trash2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Alert, AlertDescription } from "./ui/alert";
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
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

const CLEAR_ALL_CONFIRMATION = "CLEAR";

interface InspectResult {
	sheet_names: string[];
}

interface UploadResult {
	upload_id: number;
	status: string;
}

interface RollInspectResult {
	columns?: string[];
	sheet_names?: string[];
}

export function UploadDashboard() {
	const auth = useAuth();
	const router = useRouter();

	const fileInputRef = useRef<HTMLInputElement>(null);
	const rollFileInputRef = useRef<HTMLInputElement>(null);

	// Timetable state
	const [timetableMode, setTimetableMode] = useState<"excel" | "pdf">("excel");
	const [file, setFile] = useState<File | null>(null);
	const [sheetName, setSheetName] = useState<string>("");
	const [year, setYear] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isTimetableDragging, setIsTimetableDragging] = useState(false);

	// Roll Mappings state
	const [rollFile, setRollFile] = useState<File | null>(null);
	const [rollYear, setRollYear] = useState<number | null>(null);
	const [rollColName, setRollColName] = useState<string>("");
	const [secColName, setSecColName] = useState<string>("");
	const [rollSheetName, setRollSheetName] = useState<string>("");
	const [rollError, setRollError] = useState<string | null>(null);
	const [rollSuccess, setRollSuccess] = useState<string | null>(null);
	const [showAdvancedRoll, setShowAdvancedRoll] = useState(false);
	const [isRollDragging, setIsRollDragging] = useState(false);

	// Dialog states
	const [clearRollOpen, setClearRollOpen] = useState(false);
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

			let endpoint = "/admin/uploads";
			if (timetableMode === "excel") {
				if (!sheetName || year === null)
					throw new Error("Sheet and year are required");
				formData.append("sheet_name", sheetName);
				formData.append("year", String(year));
			} else {
				if (year === null) throw new Error("No academic year selected");
				endpoint = "/admin/uploads/pdf";
				formData.append("year", String(year));
			}

			const res = await apiFetch(
				endpoint,
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
		mutationFn: async ({ f, sheetName }: { f: File; sheetName?: string }) => {
			const formData = new FormData();
			formData.append("file", f);
			if (sheetName) {
				formData.append("sheet_name", sheetName);
			}
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
			if (rollSheetName) {
				formData.append("sheet_name", rollSheetName);
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
			setRollSheetName("");
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

	const clearRollMutation = useMutation({
		mutationFn: async () => {
			if (rollYear === null) throw new Error("No academic year selected");
			const res = await apiFetch(
				`/admin/roll-mappings/${rollYear}`,
				{ method: "DELETE" },
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
			return res.json() as Promise<{ status: string; deleted_count: number }>;
		},
		onSuccess: (data) => {
			setRollError(null);
			setRollSuccess(
				`Successfully cleared! Deleted ${data.deleted_count} mappings for Year ${rollYear}.`,
			);
			setClearRollOpen(false);
			toast.success(`Cleared mappings for Year ${rollYear}`);
		},
		onError: (e) => {
			setRollSuccess(null);
			setRollError(e instanceof Error ? e.message : "Failed to clear mappings");
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
			setClearAllOpen(false);
			toast.success("All data cleared");
		},
		onError: (e) => {
			toast.error(e instanceof Error ? e.message : "Clear all failed");
		},
	});

	function handleModeChange(newMode: "excel" | "pdf") {
		if (newMode === timetableMode) return;
		setTimetableMode(newMode);
		setFile(null);
		setSheetName("");
		setYear(null);
		setError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		inspectMutation.reset();
		uploadMutation.reset();
	}

	function handleFileSelected(selectedFile: File) {
		setFile(selectedFile);
		setSheetName("");
		setYear(null);
		setError(null);
		if (timetableMode === "excel") {
			inspectMutation.mutate(selectedFile);
		}
	}

	function handleRollFileSelected(selectedFile: File) {
		setRollFile(selectedFile);
		setRollError(null);
		setRollSuccess(null);
		setRollColName("");
		setSecColName("");
		setRollSheetName("");
		rollInspectMutation.mutate({ f: selectedFile });
	}

	function handleTimetableSubmit() {
		if (!file || year === null) return;
		if (timetableMode === "excel" && !sheetName) return;
		uploadMutation.mutate();
	}

	function handleRollUpload() {
		if (!rollFile || rollYear === null) return;
		rollUploadMutation.mutate();
	}

	const parseDisabled = !sheetName || year === null || uploadMutation.isPending;
	const pdfUploadDisabled = !file || year === null || uploadMutation.isPending;
	const showSheetForm = inspectMutation.isSuccess && inspectMutation.data;

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 text-white md:py-8">
			{/* Timetable Card */}
			<Card
				data-slot="card"
				className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-neutral-900/80 bg-white/5 p-4 shadow-xl backdrop-blur-md md:p-6"
			>
				<CardHeader className="p-0">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle className="text-xl font-bold tracking-tight text-white md:text-2xl">
								Upload Timetable
							</CardTitle>
							<CardDescription className="text-sm text-neutral-400">
								{timetableMode === "excel"
									? "Select an Excel file (.xlsx, .xls) to parse and configure timetable data"
									: "Select a PDF file (.pdf) to parse and configure timetable data"}
							</CardDescription>
						</div>
						{/* Segmented Toggle: Excel | PDF */}
						<div className="flex items-center gap-1 rounded-full border border-white/10 bg-neutral-950/60 p-1 w-fit">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => handleModeChange("excel")}
								className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
									timetableMode === "excel"
										? "bg-[#f57c00] text-black shadow-sm hover:bg-[#f57c00]/90 hover:text-black"
										: "text-neutral-400 hover:bg-white/10 hover:text-white"
								}`}
							>
								Excel
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => handleModeChange("pdf")}
								className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
									timetableMode === "pdf"
										? "bg-[#f57c00] text-black shadow-sm hover:bg-[#f57c00]/90 hover:text-black"
										: "text-neutral-400 hover:bg-white/10 hover:text-white"
								}`}
							>
								PDF
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="flex flex-col gap-5 p-0">
					{/* Drop Zone */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="timetable-file-input" className="text-neutral-200">
							{timetableMode === "excel"
								? "Excel Timetable File"
								: "PDF Timetable File"}
						</Label>
						<input
							id="timetable-file-input"
							data-testid="timetable-file-input"
							ref={fileInputRef}
							type="file"
							accept={timetableMode === "excel" ? ".xlsx,.xls" : ".pdf"}
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleFileSelected(f);
							}}
						/>
						<button
							type="button"
							data-slot="file-dropzone"
							onClick={() => fileInputRef.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setIsTimetableDragging(true);
							}}
							onDragLeave={(e) => {
								e.preventDefault();
								setIsTimetableDragging(false);
							}}
							onDrop={(e) => {
								e.preventDefault();
								setIsTimetableDragging(false);
								const f = e.dataTransfer.files?.[0];
								if (f) handleFileSelected(f);
							}}
							disabled={inspectMutation.isPending || uploadMutation.isPending}
							className={`relative flex min-h-[100px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#f57c00] focus-visible:outline-none ${
								isTimetableDragging
									? "border-[#f57c00] bg-[#f57c00]/15"
									: "border-white/20 bg-neutral-950/40 hover:border-[#f57c00]/50 hover:bg-[#f57c00]/5"
							}`}
						>
							{inspectMutation.isPending ? (
								<div className="flex flex-col items-center gap-2">
									<Loader2 className="size-6 animate-spin text-[#f57c00]" />
									<span className="text-sm text-neutral-300">
										Inspecting timetable sheets...
									</span>
								</div>
							) : file ? (
								<div className="flex flex-col items-center gap-1.5">
									<div className="flex items-center gap-2 text-[#f57c00]">
										{timetableMode === "excel" ? (
											<FileSpreadsheet className="size-5 shrink-0" />
										) : (
											<FileText className="size-5 shrink-0" />
										)}
										<span className="max-w-[280px] truncate text-sm font-semibold sm:max-w-md">
											{file.name}
										</span>
									</div>
									<span className="text-xs text-neutral-400">
										Click or drop a new file to replace
									</span>
								</div>
							) : (
								<div className="flex flex-col items-center gap-1.5">
									<Upload className="size-6 text-[#f57c00]" />
									<span className="text-sm font-medium text-neutral-200">
										{timetableMode === "excel"
											? "Drop timetable file here or click to browse"
											: "Drop PDF timetable file here or click to browse"}
									</span>
									<span className="text-xs text-neutral-400">
										{timetableMode === "excel"
											? "Supports Excel files (.xlsx, .xls)"
											: "Supports PDF files (.pdf)"}
									</span>
								</div>
							)}
						</button>
					</div>

					{timetableMode === "excel" && inspectMutation.isPending && (
						<div className="flex flex-col gap-3 pt-2">
							<Skeleton className="h-5 w-3/4 rounded-md bg-white/10" />
							<Skeleton className="h-11 w-full rounded-xl bg-white/10" />
						</div>
					)}

					{timetableMode === "excel" && showSheetForm && (
						<div className="flex flex-col gap-5 pt-1">
							{/* Sheet selector */}
							<div className="flex flex-col gap-2">
								<Label htmlFor="sheet-name" className="text-neutral-200">
									Sheet
								</Label>
								<Select value={sheetName} onValueChange={setSheetName}>
									<SelectTrigger
										id="sheet-name"
										className="h-11 min-h-[44px] w-full rounded-xl border-white/10 bg-neutral-800/90 text-white hover:bg-neutral-800 focus:ring-[#f57c00]"
									>
										<SelectValue placeholder="Select a sheet" />
									</SelectTrigger>
									<SelectContent className="border-white/10 bg-neutral-900 text-white">
										{inspectMutation.data.sheet_names.map((name) => (
											<SelectItem
												key={name}
												value={name}
												className="cursor-pointer min-h-[44px] focus:bg-white/10 focus:text-white"
											>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Year selector pills */}
							<div className="flex flex-col gap-2">
								<Label className="text-neutral-200">Year</Label>
								<div className="grid grid-cols-4 gap-2">
									{[1, 2, 3, 4].map((y) => (
										<Button
											key={y}
											type="button"
											className={`h-11 min-h-[44px] rounded-full text-sm font-semibold transition-all ${
												year === y
													? "bg-[#f57c00] text-black shadow-md hover:bg-[#f57c00]/90"
													: "border border-white/10 bg-neutral-850 bg-white/10 text-neutral-200 hover:bg-neutral-700 hover:text-white"
											}`}
											onClick={() => setYear(y)}
										>
											{y}
										</Button>
									))}
								</div>
							</div>

							{/* Parse Button */}
							<Button
								onClick={handleTimetableSubmit}
								disabled={parseDisabled}
								className="h-11 min-h-[44px] w-full rounded-xl bg-[#f57c00] font-semibold text-black shadow-lg transition-all hover:bg-[#f57c00]/90 disabled:opacity-50"
							>
								{uploadMutation.isPending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										<span>Parsing...</span>
									</>
								) : (
									"Parse"
								)}
							</Button>
						</div>
					)}

					{timetableMode === "pdf" && (
						<div className="flex flex-col gap-5 pt-1">
							{/* Year selector pills */}
							<div className="flex flex-col gap-2">
								<Label className="text-neutral-200">Year</Label>
								<div className="grid grid-cols-4 gap-2">
									{[1, 2, 3, 4].map((y) => (
										<Button
											key={y}
											type="button"
											className={`h-11 min-h-[44px] rounded-full text-sm font-semibold transition-all ${
												year === y
													? "bg-[#f57c00] text-black shadow-md hover:bg-[#f57c00]/90"
													: "border border-white/10 bg-neutral-850 bg-white/10 text-neutral-200 hover:bg-neutral-700 hover:text-white"
											}`}
											onClick={() => setYear(y)}
										>
											{y}
										</Button>
									))}
								</div>
							</div>

							{/* Upload Button */}
							<Button
								onClick={handleTimetableSubmit}
								disabled={pdfUploadDisabled}
								className="h-11 min-h-[44px] w-full rounded-xl bg-[#f57c00] font-semibold text-black shadow-lg transition-all hover:bg-[#f57c00]/90 disabled:opacity-50"
							>
								{uploadMutation.isPending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										<span>Uploading...</span>
									</>
								) : (
									"Upload"
								)}
							</Button>
						</div>
					)}

					{/* Error Alert */}
					{error && (
						<Alert
							variant="destructive"
							className="border-red-500/30 bg-red-950/40 text-red-200"
						>
							<AlertTriangle className="size-4 text-red-400" />
							<AlertDescription className="text-red-300">
								{error}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{/* Roll Mappings Card */}
			<Card
				data-slot="card"
				className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-neutral-900/80 bg-white/5 p-4 shadow-xl backdrop-blur-md md:p-6"
			>
				<CardHeader className="p-0">
					<CardTitle className="text-xl font-bold tracking-tight text-white md:text-2xl">
						Upload Roll Mappings
					</CardTitle>
					<CardDescription className="text-sm text-neutral-400">
						Upload CSV or Excel file containing Roll Number to Section mappings
					</CardDescription>
				</CardHeader>

				<CardContent className="flex flex-col gap-5 p-0">
					{/* Drop Zone */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="roll-file-input" className="text-neutral-200">
							Roll Mappings File
						</Label>
						<input
							id="roll-file-input"
							data-testid="roll-file-input"
							ref={rollFileInputRef}
							type="file"
							accept=".xlsx,.xls,.csv"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleRollFileSelected(f);
							}}
						/>
						<button
							type="button"
							data-slot="file-dropzone"
							onClick={() => rollFileInputRef.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setIsRollDragging(true);
							}}
							onDragLeave={(e) => {
								e.preventDefault();
								setIsRollDragging(false);
							}}
							onDrop={(e) => {
								e.preventDefault();
								setIsRollDragging(false);
								const f = e.dataTransfer.files?.[0];
								if (f) handleRollFileSelected(f);
							}}
							disabled={rollUploadMutation.isPending}
							className={`relative flex min-h-[100px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#f57c00] focus-visible:outline-none ${
								isRollDragging
									? "border-[#f57c00] bg-[#f57c00]/15"
									: "border-white/20 bg-neutral-950/40 hover:border-[#f57c00]/50 hover:bg-[#f57c00]/5"
							}`}
						>
							{rollInspectMutation.isPending ? (
								<div className="flex flex-col items-center gap-2">
									<Loader2 className="size-6 animate-spin text-[#f57c00]" />
									<span className="text-sm text-neutral-300">
										Inspecting columns & sheets...
									</span>
								</div>
							) : rollFile ? (
								<div className="flex flex-col items-center gap-1.5">
									<div className="flex items-center gap-2 text-[#f57c00]">
										<FileSpreadsheet className="size-5 shrink-0" />
										<span className="max-w-[280px] truncate text-sm font-semibold sm:max-w-md">
											{rollFile.name}
										</span>
									</div>
									<span className="text-xs text-neutral-400">
										Click or drop a new file to replace
									</span>
								</div>
							) : (
								<div className="flex flex-col items-center gap-1.5">
									<Upload className="size-6 text-[#f57c00]" />
									<span className="text-sm font-medium text-neutral-200">
										Drop roll mappings file here or click to browse
									</span>
									<span className="text-xs text-neutral-400">
										Supports CSV, Excel (.xlsx, .xls)
									</span>
								</div>
							)}
						</button>
					</div>

					{/* Academic Year Selector Pills */}
					<div className="flex flex-col gap-2">
						<Label className="text-neutral-200">Academic Year</Label>
						<div className="grid grid-cols-4 gap-2">
							{[1, 2, 3, 4].map((y) => (
								<Button
									key={y}
									type="button"
									disabled={rollUploadMutation.isPending}
									className={`h-11 min-h-[44px] rounded-full text-sm font-semibold transition-all ${
										rollYear === y
											? "bg-[#f57c00] text-black shadow-md hover:bg-[#f57c00]/90"
											: "border border-white/10 bg-neutral-850 bg-white/10 text-neutral-200 hover:bg-neutral-700 hover:text-white"
									}`}
									onClick={() => setRollYear(y)}
								>
									{y}
								</Button>
							))}
						</div>
					</div>

					{/* Advanced Options Accordion */}
					<div className="rounded-xl border border-white/10 bg-neutral-950/40">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setShowAdvancedRoll((prev) => !prev)}
							className="flex h-11 min-h-[44px] w-full items-center justify-between px-4 text-sm font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
						>
							<span>Advanced Options</span>
							{showAdvancedRoll ? (
								<ChevronUp className="size-4 shrink-0 text-neutral-400" />
							) : (
								<ChevronDown className="size-4 shrink-0 text-neutral-400" />
							)}
						</Button>

						{showAdvancedRoll && (
							<div className="flex flex-col gap-4 border-t border-white/10 p-4">
								{rollInspectMutation.data?.sheet_names &&
									rollInspectMutation.data.sheet_names.length > 0 && (
										<div className="flex flex-col gap-2">
											<Label
												htmlFor="roll-sheet-name"
												className="text-neutral-200"
											>
												Sheet Override
											</Label>
											<Select
												value={rollSheetName}
												onValueChange={(val: string) => {
													setRollSheetName(val);
													setRollColName("");
													setSecColName("");
													if (rollFile) {
														rollInspectMutation.mutate({
															f: rollFile,
															sheetName: val,
														});
													}
												}}
												disabled={rollUploadMutation.isPending}
											>
												<SelectTrigger
													id="roll-sheet-name"
													className="h-11 min-h-[44px] w-full rounded-xl border-white/10 bg-neutral-800/90 text-white hover:bg-neutral-800"
												>
													<SelectValue placeholder="Select a sheet" />
												</SelectTrigger>
												<SelectContent className="border-white/10 bg-neutral-900 text-white">
													{rollInspectMutation.data.sheet_names.map((name) => (
														<SelectItem
															key={name}
															value={name}
															className="cursor-pointer min-h-[44px] focus:bg-white/10 focus:text-white"
														>
															{name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}

								{rollInspectMutation.data?.columns ? (
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<div className="flex flex-col gap-2">
											<Label
												htmlFor="roll-col-name"
												className="text-neutral-200"
											>
												Roll Number Column (Optional)
											</Label>
											<Select
												value={rollColName || "DEFAULT_AUTO"}
												onValueChange={(val: string) =>
													setRollColName(val === "DEFAULT_AUTO" ? "" : val)
												}
												disabled={rollUploadMutation.isPending}
											>
												<SelectTrigger
													id="roll-col-name"
													className="h-11 min-h-[44px] w-full rounded-xl border-white/10 bg-neutral-800/90 text-white hover:bg-neutral-800"
												>
													<SelectValue placeholder="Default (Auto-detect)" />
												</SelectTrigger>
												<SelectContent className="border-white/10 bg-neutral-900 text-white">
													<SelectItem
														value="DEFAULT_AUTO"
														className="cursor-pointer min-h-[44px]"
													>
														Default (Auto-detect)
													</SelectItem>
													{rollInspectMutation.data.columns.map((col) => (
														<SelectItem
															key={col}
															value={col}
															className="cursor-pointer min-h-[44px] focus:bg-white/10 focus:text-white"
														>
															{col}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="flex flex-col gap-2">
											<Label
												htmlFor="sec-col-name"
												className="text-neutral-200"
											>
												Section Column (Optional)
											</Label>
											<Select
												value={secColName || "DEFAULT_AUTO"}
												onValueChange={(val: string) =>
													setSecColName(val === "DEFAULT_AUTO" ? "" : val)
												}
												disabled={rollUploadMutation.isPending}
											>
												<SelectTrigger
													id="sec-col-name"
													className="h-11 min-h-[44px] w-full rounded-xl border-white/10 bg-neutral-800/90 text-white hover:bg-neutral-800"
												>
													<SelectValue placeholder="Default (Auto-detect)" />
												</SelectTrigger>
												<SelectContent className="border-white/10 bg-neutral-900 text-white">
													<SelectItem
														value="DEFAULT_AUTO"
														className="cursor-pointer min-h-[44px]"
													>
														Default (Auto-detect)
													</SelectItem>
													{rollInspectMutation.data.columns.map((col) => (
														<SelectItem
															key={col}
															value={col}
															className="cursor-pointer min-h-[44px] focus:bg-white/10 focus:text-white"
														>
															{col}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
								) : (
									<p className="text-xs text-neutral-400">
										{rollFile
											? "Loading column definitions..."
											: "Select a roll mappings file above to configure custom column or sheet overrides."}
									</p>
								)}
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex flex-col gap-3 sm:flex-row">
						<Button
							onClick={handleRollUpload}
							className="h-11 min-h-[44px] flex-1 rounded-xl bg-[#f57c00] font-semibold text-black shadow-lg transition-all hover:bg-[#f57c00]/90 disabled:opacity-50"
							disabled={
								!rollFile ||
								rollYear === null ||
								rollUploadMutation.isPending ||
								Boolean(
									rollInspectMutation.data?.sheet_names &&
										rollInspectMutation.data.sheet_names.length > 0 &&
										!rollSheetName,
								)
							}
						>
							{rollUploadMutation.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									<span>Uploading...</span>
								</>
							) : (
								"Upload Mappings"
							)}
						</Button>

						<AlertDialog open={clearRollOpen} onOpenChange={setClearRollOpen}>
							<AlertDialogTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="h-11 min-h-[44px] rounded-xl border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-500/20 hover:text-red-300"
									disabled={rollYear === null || clearRollMutation.isPending}
								>
									<Trash2 className="size-4" />
									<span>Clear Year Mappings</span>
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent className="border-white/10 bg-neutral-900 text-white">
								<AlertDialogHeader>
									<AlertDialogTitle className="text-white">
										Clear Year {rollYear} Mappings?
									</AlertDialogTitle>
									<AlertDialogDescription className="text-neutral-300">
										This will permanently delete all student roll number
										mappings for academic year {rollYear}. This action cannot be
										undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel className="h-11 min-h-[44px] border-white/10 bg-white/10 text-white hover:bg-white/20">
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										className="h-11 min-h-[44px] bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
										disabled={clearRollMutation.isPending}
										onClick={() => clearRollMutation.mutate()}
									>
										{clearRollMutation.isPending ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												<span>Clearing...</span>
											</>
										) : (
											"Clear Mappings"
										)}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>

					{/* Feedback Alerts */}
					{rollError && (
						<Alert
							variant="destructive"
							className="border-red-500/30 bg-red-950/40 text-red-200"
						>
							<AlertTriangle className="size-4 text-red-400" />
							<AlertDescription className="text-red-300">
								{rollError}
							</AlertDescription>
						</Alert>
					)}

					{rollSuccess && (
						<Alert className="border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
							<CheckCircle2 className="size-4 text-emerald-400" />
							<AlertDescription className="text-emerald-300">
								{rollSuccess}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{/* Danger Zone Card */}
			<Card
				data-slot="card"
				className="flex flex-col gap-4 rounded-2xl border border-red-500/20 bg-red-950/30 bg-red-500/5 p-4 shadow-xl backdrop-blur-md md:p-6"
			>
				<CardHeader className="p-0">
					<div className="flex items-center gap-2 text-red-400">
						<AlertTriangle className="size-5" />
						<CardTitle className="text-xl font-bold tracking-tight text-red-400 md:text-2xl">
							Danger Zone
						</CardTitle>
					</div>
					<CardDescription className="text-sm text-red-300/80">
						Irreversibly wipes all sections, courses, faculty, rooms, class
						sessions, and upload history. Use at the start of a new semester.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex justify-start p-0">
					<AlertDialog
						open={clearAllOpen}
						onOpenChange={(open: boolean) => {
							setClearAllOpen(open);
							if (!open) setClearAllConfirmText("");
						}}
					>
						<AlertDialogTrigger asChild>
							<Button
								variant="destructive"
								className="h-11 min-h-[44px] rounded-xl bg-red-600 font-semibold text-white shadow-lg transition-all hover:bg-red-700"
							>
								<Trash2 className="size-4" />
								<span>Clear all data</span>
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="border-white/10 bg-neutral-900 text-white">
							<AlertDialogHeader>
								<AlertDialogTitle className="text-white">
									Clear all data?
								</AlertDialogTitle>
								<AlertDialogDescription className="text-neutral-300">
									This permanently deletes every section, course, faculty
									member, room, class session, and upload record. This cannot be
									undone. Type{" "}
									<span className="font-mono font-semibold text-red-400">
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
								className="h-11 min-h-[44px] border-white/10 bg-neutral-800 text-white placeholder:text-neutral-500"
							/>
							<AlertDialogFooter>
								<AlertDialogCancel className="h-11 min-h-[44px] border-white/10 bg-white/10 text-white hover:bg-white/20">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									className="h-11 min-h-[44px] bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
									disabled={
										clearAllConfirmText !== CLEAR_ALL_CONFIRMATION ||
										clearAllMutation.isPending
									}
									onClick={() => clearAllMutation.mutate()}
								>
									{clearAllMutation.isPending ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											<span>Clearing...</span>
										</>
									) : (
										"Clear all data"
									)}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</CardContent>
			</Card>
		</div>
	);
}
