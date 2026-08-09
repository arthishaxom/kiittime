import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	Bell,
	Database,
	Eye,
	Mail,
	Shield,
	Sparkles,
	Trash2,
} from "lucide-react";

export function PrivacyPolicy() {
	const lastUpdated = "August 9, 2026";

	return (
		<div className="min-h-dvh text-text flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
			<div className="w-full max-w-3xl flex flex-col gap-6">
				{/* Top Navigation */}
				<div className="flex items-center justify-between">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors bg-surface border border-border/40 px-3.5 py-2 rounded-lg cursor-pointer"
					>
						<ArrowLeft size={16} />
						<span>Back to App</span>
					</Link>
					<span className="text-xs text-text-muted/70">
						Effective Date: {lastUpdated}
					</span>
				</div>

				{/* Header Banner */}
				<header className="bg-surface rounded-2xl p-6 sm:p-8 border border-border/40 shadow-xl relative overflow-hidden">
					<div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
						<Shield size={160} />
					</div>
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-semibold uppercase tracking-wider mb-4">
						<Shield size={14} />
						<span>Privacy & Transparency</span>
					</div>
					<h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
						Privacy Policy for KIIT Time
					</h1>
					<p className="text-text-muted text-sm sm:text-base mt-2 leading-relaxed">
						KIIT Time is designed to be privacy-first, transparent, and
						respectful of your data. This policy details how information is
						collected, handled, stored, and protected across the mobile
						application and web app.
					</p>
				</header>

				{/* Non-Affiliation Notice */}
				<section className="bg-sheet border-l-4 border-l-brand border border-border/50 rounded-xl p-4 sm:p-5 text-sm">
					<h2 className="text-white font-semibold text-base mb-1">
						Notice of Non-Affiliation
					</h2>
					<p className="text-text-muted leading-relaxed">
						<strong>KIIT Time</strong> is an independent open-source student
						project developed and maintained by <strong>Ashish Pothal</strong>.
						It is <strong>not</strong> officially affiliated with, authorized,
						maintained, sponsored, or endorsed by{" "}
						<em>
							Kalinga Institute of Industrial Technology (KIIT Deemed to be
							University)
						</em>{" "}
						or any of its affiliates.
					</p>
				</section>

				{/* Main Content Sections */}
				<div className="flex flex-col gap-6 text-sm leading-relaxed">
					{/* 1. Information We Collect */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Database size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								1. Information We Collect
							</h2>
						</div>

						<div className="space-y-4 text-text-muted">
							<div>
								<h3 className="text-white font-semibold mb-1">
									A. University Roll Number & Section Preferences
								</h3>
								<p>
									When using automatic schedule lookup, you may optionally
									provide your university roll number (e.g.{" "}
									<code className="text-brand font-mono text-xs bg-bg px-1.5 py-0.5 rounded border border-border/30">
										22053062
									</code>
									). We use this identifier to map your student section(s) so
									your timetable schedule displays automatically without manual
									selection.
								</p>
							</div>

							<div>
								<h3 className="text-white font-semibold mb-1">
									B. Email Verification (One-Time Passcode)
								</h3>
								<p>
									If your roll number is unlinked, you can choose to verify
									ownership via a 6-digit One-Time Passcode (OTP) sent to your
									university institutional email address (
									<code className="text-brand font-mono text-xs bg-bg px-1.5 py-0.5 rounded border border-border/30">
										&lt;roll_no&gt;@kiit.ac.in
									</code>
									). We only send transactional verification emails required to
									confirm your timetable link. We never send spam, promotions,
									or marketing emails.
								</p>
							</div>

							<div>
								<h3 className="text-white font-semibold mb-1">
									C. Local Device Storage
								</h3>
								<p>
									Your selected section IDs, cached timetables, and UI
									preferences are stored locally on your device (using{" "}
									<code className="text-text font-mono text-xs bg-bg px-1 py-0.5 rounded">
										AsyncStorage
									</code>{" "}
									on mobile or{" "}
									<code className="text-text font-mono text-xs bg-bg px-1 py-0.5 rounded">
										localStorage
									</code>{" "}
									on the web). This enables fast loading and offline viewing of
									your schedules.
								</p>
							</div>

							<div>
								<h3 className="text-white font-semibold mb-1">
									D. Aggregated Telemetry & Technical Logs
								</h3>
								<p>
									To monitor performance, identify bugs, and improve
									reliability, we collect anonymous usage telemetry:
								</p>
								<ul className="list-disc list-inside mt-2 space-y-1 pl-2">
									<li>
										Application events (such as app open, timetable views count,
										search query length).
									</li>
									<li>
										Device platform and operating system type (e.g. Android
										version, Web).
									</li>
									<li>
										Standard API access logs (endpoint visited, response status
										code, and latency).
									</li>
								</ul>
							</div>
						</div>
					</section>

					{/* 2. How Information is Used */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Eye size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								2. How We Use Your Information
							</h2>
						</div>
						<ul className="list-disc list-inside space-y-2 text-text-muted">
							<li>
								<strong className="text-white">Timetable Resolution:</strong>{" "}
								Fetching and presenting class schedules for your enrolled
								section(s).
							</li>
							<li>
								<strong className="text-white">
									Authentication & Verification:
								</strong>{" "}
								Delivering temporary OTPs to prevent unauthorized modifications
								to roll number mappings.
							</li>
							<li>
								<strong className="text-white">Service Diagnostics:</strong>{" "}
								Identifying app crashes, server errors, and optimizing API
								response times.
							</li>
							<li>
								<strong className="text-white">
									No Selling or Monetization:
								</strong>{" "}
								We do <span className="text-white font-medium">NOT</span> sell,
								rent, or trade your personal data, roll numbers, or emails to
								advertisers or third-party data brokers.
							</li>
						</ul>
					</section>

					{/* 3. Third-Party Services */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Sparkles size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								3. Third-Party Service Providers
							</h2>
						</div>
						<p className="text-text-muted mb-3">
							We utilize trusted third-party services for essential
							infrastructure and telemetry:
						</p>
						<div className="space-y-3">
							<div className="p-3.5 rounded-xl bg-bg border border-border/40">
								<p className="text-white font-medium">PostHog</p>
								<p className="text-text-muted text-xs mt-1">
									Used for anonymous product analytics and error tracking to
									help understand feature usage and app health.
								</p>
							</div>
							<div className="p-3.5 rounded-xl bg-bg border border-border/40">
								<p className="text-white font-medium">Resend</p>
								<p className="text-text-muted text-xs mt-1">
									Used exclusively to deliver automated transactional
									verification OTP emails to{" "}
									<code className="text-text">@kiit.ac.in</code> addresses.
								</p>
							</div>
							<div className="p-3.5 rounded-xl bg-bg border border-border/40">
								<p className="text-white font-medium">
									Cloud Infrastructure Providers
								</p>
								<p className="text-text-muted text-xs mt-1">
									Used to host the API backend and web client securely over
									encrypted HTTPS connections.
								</p>
							</div>
						</div>
					</section>

					{/* 4. Data Retention & Security */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Shield size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								4. Data Retention & Security
							</h2>
						</div>
						<div className="space-y-3 text-text-muted">
							<p>
								We implement industry-standard safeguards to protect your
								information:
							</p>
							<ul className="list-disc list-inside space-y-1 pl-2">
								<li>
									<strong className="text-white">OTP Code Expiry:</strong>{" "}
									Verification OTPs are cryptographically hashed and
									automatically deleted within 5 minutes.
								</li>
								<li>
									<strong className="text-white">Encryption in Transit:</strong>{" "}
									All communications between the app and our backend use secure
									HTTPS / TLS encryption.
								</li>
								<li>
									<strong className="text-white">
										Rate Limiting & Lockouts:
									</strong>{" "}
									Robust rate-limiting and temporary account lockout protections
									prevent brute-force attacks.
								</li>
							</ul>
						</div>
					</section>

					{/* 5. User Rights & Data Deletion */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Trash2 size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								5. Your Data Rights & Deletion Request
							</h2>
						</div>
						<div className="space-y-3 text-text-muted">
							<p>You have full control over your data:</p>
							<div className="p-4 rounded-xl bg-bg border border-border/40 space-y-2">
								<p className="text-white font-semibold">
									1. Clear On-Device Data Instantly
								</p>
								<p className="text-xs">
									Tap the <strong className="text-white">Reset</strong> button
									inside the app Settings sheet at any time. This wipes all
									locally cached sections, timetable data, and stored roll
									number identifiers from your device immediately.
								</p>
							</div>
							<div className="p-4 rounded-xl bg-bg border border-border/40 space-y-2">
								<p className="text-white font-semibold">
									2. Request Backend Mapping Deletion
								</p>
								<p className="text-xs">
									If you linked your roll number and would like your mapping
									removed from the backend database, send an email to{" "}
									<a
										href="mailto:pothal.builds@gmail.com?subject=KIIT%20Time%20-%20Data%20Deletion%20Request"
										className="text-brand font-medium underline"
									>
										pothal.builds@gmail.com
									</a>{" "}
									with the subject line <em>"Data Deletion Request"</em> along
									with your roll number. Requests are processed within 30 days.
								</p>
							</div>
						</div>
					</section>

					{/* 6. Children's Privacy */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Bell size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								6. Children's Privacy
							</h2>
						</div>
						<p className="text-text-muted">
							KIIT Time is designed for university and college students
							(typically ages 17 and older). We do not knowingly solicit or
							collect personal information from children under the age of 13. If
							you believe a child has provided us with personal information,
							please contact us so we can promptly delete it.
						</p>
					</section>

					{/* 7. Contact Us */}
					<section className="bg-surface rounded-2xl p-6 sm:p-7 border border-border/40">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-brand/10 text-brand">
								<Mail size={20} />
							</div>
							<h2 className="text-lg font-bold text-white">
								7. Contact Information & Updates
							</h2>
						</div>
						<p className="text-text-muted mb-4">
							We may update this Privacy Policy from time to time to reflect
							improvements or regulatory requirements. If you have any
							questions, feedback, or privacy-related requests, please reach out
							directly:
						</p>
						<div className="flex flex-col sm:flex-row gap-3">
							<a
								href="mailto:pothal.builds@gmail.com"
								className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-brand hover:bg-brand-active text-white font-medium transition-colors cursor-pointer"
							>
								<Mail size={16} />
								<span>Contact: pothal.builds@gmail.com</span>
							</a>
							<a
								href="https://github.com/arthishaxom/kiittime"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sheet hover:bg-surface border border-border text-white font-medium transition-colors cursor-pointer"
							>
								<span>View GitHub Repository</span>
							</a>
						</div>
					</section>
				</div>

				{/* Footer */}
				<footer className="text-center py-6 text-xs text-text-muted/60">
					© {new Date().getFullYear()} KIIT Time • Developed by Ashish Pothal
				</footer>
			</div>
		</div>
	);
}
