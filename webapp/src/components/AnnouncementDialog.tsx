import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import type { Announcement } from "#/lib/api";

interface AnnouncementDialogProps {
	announcement: Announcement;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMarkAsRead: () => void;
	unseen: boolean;
}

export function AnnouncementDialog({
	announcement,
	open,
	onOpenChange,
	onMarkAsRead,
	unseen,
}: AnnouncementDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-sheet border-border">
				<DialogHeader>
					<DialogTitle className="text-white text-center text-xl">
						{announcement.title}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col items-center gap-4 text-center">
					<p className="text-text whitespace-pre-wrap">{announcement.body}</p>

					{announcement.link_url && (
						<a
							href={announcement.link_url}
							target="_blank"
							rel="noreferrer"
							className="text-brand underline"
						>
							{announcement.link_label || announcement.link_url}
						</a>
					)}

					{unseen && (
						<button
							type="button"
							onClick={onMarkAsRead}
							className="h-10 w-full rounded-lg bg-surface border border-border text-text-muted font-medium"
						>
							Mark as read
						</button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
