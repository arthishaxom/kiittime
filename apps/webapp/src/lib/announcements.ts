export function isAnnouncementUnseen(
	currentId: number | null,
	lastSeenId: number | null,
): boolean {
	if (currentId === null) return false;
	return currentId !== lastSeenId;
}
