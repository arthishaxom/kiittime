import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Info, Loader2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { AboutDialog } from "#/components/AboutDialog";
import { fetchRollNumberMapping } from "#/lib/api";
import { saveSectionIds } from "#/lib/storage";

export function Landing() {
	const [rollNo, setRollNo] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isEmptyDb, setIsEmptyDb] = useState(false);
	const [showManual, setShowManual] = useState(false);

	const [year, setYear] = useState<number | undefined>(undefined);
	const [aboutOpen, setAboutOpen] = useState(false);
	const navigate = useNavigate();

	const handleRollSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!rollNo.trim()) return;

		setIsLoading(true);
		setError(null);
		try {
			const data = await fetchRollNumberMapping(rollNo.trim());
			saveSectionIds(data.sections.map((s) => s.id));
			navigate({
				to: "/timetable",
				search: { section_id: data.sections.map((s) => s.id) },
			});
		} catch (err: any) {
			if (err.status === 404 && err.detail === "No timetables uploaded yet") {
				setIsEmptyDb(true);
			} else {
				setError(err.message || "Roll number not found");
			}
		} finally {
			setIsLoading(false);
		}
	};

	if (isEmptyDb) {
		return (
			<div className="h-dvh bg-bg/50 text-text flex flex-col p-6">
				<div className="flex-1 flex items-center justify-center">
					<img
						src="/logo.png"
						alt="KIIT Time"
						className="w-4/5 max-w-70 h-25 object-contain"
					/>
				</div>

				<div className="bg-surface rounded-[15px] p-8 text-center border border-border/40">
					<div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
						<Info size={32} />
					</div>
					<h2 className="text-white font-bold text-xl mb-2">
						No timetables uploaded yet
					</h2>
					<p className="text-text-muted text-sm leading-relaxed mb-6">
						The database is currently empty. The administrator has not uploaded
						any timetable data for this semester yet.
					</p>
					<button
						type="button"
						onClick={() => setIsEmptyDb(false)}
						className="w-full h-14 rounded-lg bg-brand hover:bg-brand-active text-white text-lg font-medium transition-colors cursor-pointer"
					>
						Try Again
					</button>
				</div>

				<button
					type="button"
					onClick={() => setAboutOpen(true)}
					className="mt-4 flex items-center justify-center gap-2 text-text-muted text-sm cursor-pointer"
				>
					<Info size={16} />
					About
				</button>

				<AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
			</div>
		);
	}

	return (
		<div className="h-dvh bg-bg/50 text-text flex flex-col p-6">
			{/* Logo */}
			<div className="flex-1 flex items-center justify-center">
				<img
					src="/logo.png"
					alt="KIIT Time"
					className="w-4/5 max-w-70 h-25 object-contain"
				/>
			</div>

			{/* Card */}
			<div className="bg-surface rounded-[15px] p-8 border border-border/20">
				{!showManual ? (
					<form onSubmit={handleRollSubmit}>
						<p className="text-white font-semibold text-lg mb-1">
							Find your Timetable
						</p>
						<p className="text-text-muted text-sm mb-4">
							Enter your roll number to automatically load your schedule.
						</p>

						<div className="mb-4">
							<input
								type="text"
								placeholder="e.g. 2105123"
								value={rollNo}
								onChange={(e) => {
									setRollNo(e.target.value);
									setError(null);
								}}
								disabled={isLoading}
								className="w-full h-14 bg-bg rounded-lg px-4 border border-border text-white text-lg placeholder:text-text-muted/40 focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
							/>
							{error && <p className="text-danger text-sm mt-2">{error}</p>}
						</div>

						<button
							type="submit"
							disabled={isLoading || !rollNo.trim()}
							className="w-full h-14 rounded-lg bg-brand hover:bg-brand-active text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						>
							{isLoading ? (
								<>
									<Loader2 size={20} className="animate-spin text-white" />
									Finding Timetable...
								</>
							) : (
								"Find Timetable"
							)}
						</button>

						<button
							type="button"
							onClick={() => setShowManual(true)}
							className="w-full mt-4 text-brand hover:text-brand-active font-medium text-sm text-center block cursor-pointer"
						>
							Select sections manually
						</button>
					</form>
				) : (
					<div>
						<div className="flex items-center gap-2 mb-1">
							<button
								type="button"
								onClick={() => setShowManual(false)}
								className="text-text-muted hover:text-white cursor-pointer"
							>
								<ArrowLeft size={20} />
							</button>
							<p className="text-white font-semibold text-lg">
								Find by Section
							</p>
						</div>
						<p className="text-text-muted text-sm mb-4">
							Select your academic year to pick sections.
						</p>

						<p className="text-text-muted text-sm mb-2 mt-4 font-medium">
							Year
						</p>
						<div className="flex gap-2 mb-4">
							{[1, 2, 3, 4].map((y) => (
								<button
									type="button"
									key={y}
									onClick={() => setYear(y)}
									className={`flex-1 h-14 rounded-lg text-lg font-medium border-2 transition-colors cursor-pointer ${
										year === y
											? "bg-brand text-white border-brand"
											: "bg-transparent text-text border-border hover:border-text-muted"
									}`}
								>
									{y}
								</button>
							))}
						</div>

						<button
							type="button"
							onClick={() =>
								navigate({ to: "/select/sections", search: { year: year! } })
							}
							disabled={!year}
							className="w-full h-14 rounded-lg border border-border flex items-center justify-between px-4 text-lg disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						>
							<span className={year ? "text-white" : "text-text-muted"}>
								{year ? "Select sections" : "Select year first"}
							</span>
							<ChevronRight size={20} className="text-white" />
						</button>
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={() => setAboutOpen(true)}
				className="mt-4 flex items-center justify-center gap-2 text-text-muted text-sm cursor-pointer"
			>
				<Info size={16} />
				About
			</button>

			<AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
		</div>
	);
}
