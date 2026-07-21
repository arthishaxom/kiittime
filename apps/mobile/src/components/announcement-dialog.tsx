import { Linking, Pressable, View } from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import type { Announcement } from '@kiittime/api/api';

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
  const linkUrl = announcement.link_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-sheet border-border">
        <DialogHeader>
          <DialogTitle className="text-text text-center text-xl">{announcement.title}</DialogTitle>
        </DialogHeader>

        <View className="items-center gap-4">
          <Text className="text-text text-center">{announcement.body}</Text>

          {linkUrl && (
            <Pressable onPress={() => Linking.openURL(linkUrl)}>
              <Text className="text-brand underline">{announcement.link_label || linkUrl}</Text>
            </Pressable>
          )}

          {unseen && (
            <Pressable
              onPress={onMarkAsRead}
              className="h-10 w-full rounded-lg bg-surface border border-border items-center justify-center">
              <Text className="text-text-muted font-medium">Mark as read</Text>
            </Pressable>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
