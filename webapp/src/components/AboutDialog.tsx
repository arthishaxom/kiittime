import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

interface AboutDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-sheet border-border">
				<DialogHeader>
					<DialogTitle className="text-white text-center text-xl">
						About KIIT Time
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col items-center gap-4 text-center">
					<p className="text-text font-medium">v{__APP_VERSION__}</p>

					<div className="flex flex-col gap-2">
						<p className="text-text">
							Made by{" "}
							<a
								href="https://www.linkedin.com/in/ashish-pothal/"
								target="_blank"
								rel="noreferrer"
								className="text-brand underline"
							>
								Ashish Pothal
							</a>
						</p>
						<a
							href="https://github.com/arthishaxom/kiittime"
							target="_blank"
							rel="noreferrer"
							className="text-brand underline"
						>
							GitHub
						</a>
					</div>

					<p className="text-text-muted text-sm">MIT License</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
