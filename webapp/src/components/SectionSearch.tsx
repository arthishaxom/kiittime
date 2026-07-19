import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { useSections } from "#/hooks/useSections";
import { sendOtp, verifyOtp } from "#/lib/api";
import { buildMailto } from "#/lib/mailto";
import { saveSectionIds } from "#/lib/storage";

export function SectionSearch({ year }: { year: number }) {
	const navigate = useNavigate();

	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<number[]>([]);
	const [selectedPrefix, setSelectedPrefix] = useState("All");

	// OTP flow states
	const [isConfirmLinkOpen, setIsConfirmLinkOpen] = useState(false);
	const [isOtpOpen, setIsOtpOpen] = useState(false);
	const [otp, setOtp] = useState("");
	const [otpError, setOtpError] = useState<string | null>(null);
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
	const [isOtpInputFocused, setIsOtpInputFocused] = useState(false);

	const otpInputRef = useRef<HTMLInputElement>(null);
	const rollNoToLink = localStorage.getItem("temp_linking_roll_no");

	const focusOtpInput = () => {
		otpInputRef.current?.focus();
	};

	const { data: sections, isLoading, isError } = useSections(year);

	const prefixes = useMemo(() => {
		if (!sections) return [];
		const unique = new Set<string>();
		for (const s of sections) {
			const match = /^[A-Z]+/i.exec(s.section_name);
			if (match) unique.add(match[0].toUpperCase());
		}
		return ["All", ...Array.from(unique).sort()];
	}, [sections]);

	const filtered = useMemo(() => {
		if (!sections) return [];
		const q = search.trim().toLowerCase();
		return sections
			.filter((s) => (q ? s.section_name.toLowerCase().includes(q) : true))
			.filter((s) => {
				if (selectedPrefix === "All") return true;
				const match = /^[A-Z]+/i.exec(s.section_name);
				return match?.[0].toUpperCase() === selectedPrefix;
			})
			.sort((a, b) =>
				a.section_name.localeCompare(b.section_name, undefined, {
					numeric: true,
				}),
			);
	}, [sections, search, selectedPrefix]);

	const selectedSections = useMemo(
		() => sections?.filter((s) => selectedIds.includes(s.id)) ?? [],
		[sections, selectedIds],
	);

	const MAX_SECTIONS = 5;
	const atCap = selectedIds.length >= MAX_SECTIONS;

	function toggleSection(id: number) {
		setSelectedIds((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= MAX_SECTIONS) return prev;
			return [...prev, id];
		});
	}

	const handleDoneClick = () => {
		if (rollNoToLink) {
			setIsConfirmLinkOpen(true);
		} else {
			saveSectionIds(selectedIds);
			navigate({
				to: "/timetable",
				search: { section_id: selectedIds },
			});
		}
	};

	const handleSendOtp = async () => {
		if (!rollNoToLink) return;
		setIsSendingOtp(true);
		setOtpError(null);
		try {
			await sendOtp(rollNoToLink, selectedIds);
			setIsConfirmLinkOpen(false);
			setIsOtpOpen(true);
		} catch (err: any) {
			const msg = err.message || "Failed to send OTP. Please try again.";
			setOtpError(msg);
			toast.error(msg);
		} finally {
			setIsSendingOtp(false);
		}
	};

	const handleVerifyOtp = async () => {
		if (!rollNoToLink || otp.length < 6) return;
		setIsVerifyingOtp(true);
		setOtpError(null);
		try {
			const data = await verifyOtp(rollNoToLink, otp);
			saveSectionIds(data.sections.map((s) => s.id));
			localStorage.setItem("kiit-time:active-roll-no", rollNoToLink);
			localStorage.setItem(
				"kiit-time:active-academic-year",
				String(data.academic_year),
			);
			localStorage.removeItem("temp_linking_roll_no");
			setIsOtpOpen(false);
			navigate({
				to: "/timetable",
				search: { section_id: data.sections.map((s) => s.id) },
			});
		} catch (err: any) {
			setOtpError(err.message || "Invalid OTP code.");
		} finally {
			setIsVerifyingOtp(false);
		}
	};

	const handleSkipLink = () => {
		localStorage.removeItem("temp_linking_roll_no");
		setIsConfirmLinkOpen(false);
		saveSectionIds(selectedIds);
		navigate({
			to: "/timetable",
			search: { section_id: selectedIds },
		});
	};

	return (
		<div className="min-h-screen bg-bg text-text flex flex-col p-4">
			<div className="flex items-center gap-3 mb-4">
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="text-2xl"
				>
					←
				</button>
				<h1 className="text-xl font-bold flex-1 text-center">
					Select Sections
				</h1>
				<button
					type="button"
					disabled={selectedIds.length === 0}
					onClick={handleDoneClick}
					className="text-brand font-semibold disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
				>
					Done
				</button>
			</div>

			<Input
				placeholder="Search sections…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="mb-4"
			/>

			{prefixes.length > 1 && (
				<Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
					<SelectTrigger className="mb-4 w-full bg-surface border-border text-text">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent className="bg-sheet border-border text-text">
						{prefixes.map((prefix) => (
							<SelectItem
								key={prefix}
								value={prefix}
								className="text-text cursor-pointer hover:bg-surface focus:bg-surface"
							>
								{prefix}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			{selectedSections.length > 0 && (
				<div className="mb-4">
					<p className="text-sm text-text-muted mb-2">
						Selected Sections ({selectedSections.length})
					</p>
					<div className="flex flex-wrap gap-2">
						{selectedSections.map((s) => (
							<Badge
								key={s.id}
								className="cursor-pointer"
								onClick={() => toggleSection(s.id)}
							>
								{s.section_name} ×
							</Badge>
						))}
					</div>
					{atCap && <p className="text-danger text-xs mt-2">Max 5 sections</p>}
				</div>
			)}

			<p className="text-sm text-text-muted mb-2">
				Available Sections (Year {year})
			</p>

			<div className="flex-1 overflow-y-auto flex flex-col gap-2">
				{isLoading && (
					<p className="text-text-muted text-sm">Loading sections…</p>
				)}
				{isError && (
					<p className="text-danger text-sm">Failed to load sections.</p>
				)}
				{!isLoading && !isError && (!sections || sections.length === 0) && (
					<div className="text-center text-text-muted py-8">
						<p>No sections available for Year {year} yet.</p>
						<a
							href={buildMailto({
								subject: `KIIT Time - No sections for Year ${year}`,
								body: `Hi, I noticed there are no sections listed yet for Year ${year}. Could you add them?`,
							})}
							className="text-brand underline"
						>
							Email me to request it
						</a>
					</div>
				)}
				{!isLoading &&
					!isError &&
					sections &&
					sections.length > 0 &&
					filtered.length === 0 && (
						<div className="text-center text-text-muted py-8">
							<p>No sections match "{search}".</p>
							<p className="text-sm">Try a different search term.</p>
						</div>
					)}
				{filtered.map((s) => {
					const isSelected = selectedIds.includes(s.id);
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => toggleSection(s.id)}
							className={`h-14 rounded-lg px-4 text-left font-medium transition-colors ${
								isSelected
									? "bg-brand text-white"
									: "bg-surface text-text border border-border"
							}`}
						>
							{s.section_name}
						</button>
					);
				})}
			</div>

			{/* Confirm Link Modal */}
			<Dialog open={isConfirmLinkOpen} onOpenChange={setIsConfirmLinkOpen}>
				<DialogContent className="bg-surface border-border text-text max-w-sm sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-white text-xl font-bold flex items-center gap-2">
							Link Roll Number?
						</DialogTitle>
						<DialogDescription className="text-text-muted text-sm mt-2 leading-relaxed">
							Would you like to link your roll number{" "}
							<strong className="text-white">{rollNoToLink}</strong> to these
							sections so you don't have to select them next time?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex flex-col gap-2 mt-4">
						<button
							type="button"
							disabled={isSendingOtp}
							onClick={handleSendOtp}
							className="w-full h-12 rounded-lg bg-brand hover:bg-brand-active text-white font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
						>
							{isSendingOtp ? (
								<>
									<Loader2 size={18} className="animate-spin text-white" />
									Sending OTP...
								</>
							) : (
								"Link via OTP"
							)}
						</button>
						<button
							type="button"
							onClick={handleSkipLink}
							className="w-full h-12 rounded-lg bg-transparent border border-border text-text hover:bg-surface/50 font-medium transition-colors cursor-pointer"
						>
							No, thanks (Just View)
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Enter OTP Modal */}
			<Dialog
				open={isOtpOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsOtpOpen(false);
						setOtp("");
						setOtpError(null);
					}
				}}
			>
				<DialogContent className="bg-surface border-border text-text max-w-sm sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-white text-xl font-bold">
							Verify Your Email
						</DialogTitle>
						<DialogDescription className="text-text-muted text-sm mt-2 leading-relaxed">
							We've sent a 6-digit verification code to{" "}
							<strong className="text-white">{rollNoToLink}@kiit.ac.in</strong>.
							Enter it below to link your roll number.
						</DialogDescription>
					</DialogHeader>

					<div
						className="relative flex justify-center gap-2 my-6"
						onClick={focusOtpInput}
					>
						{/* Hidden actual input */}
						<input
							ref={otpInputRef}
							type="text"
							pattern="[0-9]*"
							inputMode="numeric"
							maxLength={6}
							value={otp}
							onFocus={() => setIsOtpInputFocused(true)}
							onBlur={() => setIsOtpInputFocused(false)}
							onChange={(e) => {
								const val = e.target.value.replace(/[^0-9]/g, "");
								if (val.length <= 6) {
									setOtp(val);
									setOtpError(null);
								}
							}}
							disabled={isVerifyingOtp}
							className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:pointer-events-none"
						/>

						{/* Styled OTP character slots */}
						{Array.from({ length: 6 }).map((_, i) => {
							const char = otp[i] || "";
							const isFocused = isOtpInputFocused && i === otp.length;
							const isFilled = char !== "";
							return (
								<div
									key={i}
									className={`w-12 h-14 bg-bg rounded-lg border flex items-center justify-center text-xl font-bold text-white transition-all ${
										isFocused
											? "border-brand shadow-[0_0_8px_rgba(245,124,0,0.4)] scale-102"
											: isFilled
												? "border-border/80"
												: "border-border/30 text-text-muted/20"
									}`}
								>
									{char}
								</div>
							);
						})}
					</div>

					{otpError && (
						<p className="text-danger text-sm text-center mb-4">{otpError}</p>
					)}

					<DialogFooter className="flex flex-col gap-2 mt-2">
						<button
							type="button"
							disabled={isVerifyingOtp || otp.length < 6}
							onClick={handleVerifyOtp}
							className="w-full h-12 rounded-lg bg-brand hover:bg-brand-active text-white font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
						>
							{isVerifyingOtp ? (
								<>
									<Loader2 size={18} className="animate-spin text-white" />
									Verifying...
								</>
							) : (
								"Verify & Link"
							)}
						</button>
						<button
							type="button"
							onClick={handleSendOtp}
							disabled={isSendingOtp}
							className="w-full h-12 text-brand hover:text-brand-active font-semibold text-sm transition-colors text-center cursor-pointer disabled:opacity-50"
						>
							Resend Code
						</button>
						<button
							type="button"
							onClick={() => {
								setIsOtpOpen(false);
								setOtp("");
								setOtpError(null);
							}}
							className="w-full h-12 rounded-lg bg-transparent text-text-muted hover:text-white font-medium transition-colors cursor-pointer"
						>
							Cancel
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
