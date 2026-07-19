import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Info, Mail, Megaphone, RotateCcw, Share2 } from 'lucide-react-native';
import { forwardRef, useCallback } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { buildMailto } from '@/lib/mailto';
import { shareTimetable } from '@/lib/share';
import { clearSavedSectionIds, clearActiveRollNo, clearActiveAcademicYear } from '@/lib/storage';
import { THEME } from '@/lib/theme';

type SettingsSheetProps = {
  sectionIds: number[];
  onAboutPress?: () => void;
  onAnnouncementPress?: () => void;
  announcementUnseen?: boolean;
};

export const SettingsSheet = forwardRef<BottomSheetModal, SettingsSheetProps>(
  function SettingsSheet({ sectionIds, onAboutPress, onAnnouncementPress, announcementUnseen }, ref) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      ),
      [],
    );

    async function handleReset() {
      await clearSavedSectionIds();
      await clearActiveRollNo();
      await clearActiveAcademicYear();
      queryClient.clear();
      router.replace('/');
    }

    function handleContact() {
      Linking.openURL(buildMailto({ subject: 'KIIT Time - Contact', body: '' }));
    }

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: THEME.sheet }}
        handleIndicatorStyle={{ backgroundColor: THEME.textMuted }}>
        <BottomSheetView>
          <View className="px-4 pt-2 pb-8 gap-3">
            <Text className="text-text text-center text-lg font-semibold mb-1">Settings</Text>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => shareTimetable(sectionIds)}
                className="flex-1 h-14 rounded-lg bg-surface border border-border flex-row items-center justify-center gap-3 px-4">
                <Icon as={Share2} size={20} className="text-text" />
                <Text className="text-text font-medium">Share</Text>
              </Pressable>

              <Pressable
                onPress={handleReset}
                className="flex-1 h-14 rounded-lg bg-danger/90 flex-row items-center justify-center gap-3 px-4">
                <Icon as={RotateCcw} size={20} className="text-white" />
                <Text className="text-white font-medium">Reset</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleContact}
              className="h-14 rounded-lg bg-surface border border-border flex-row items-center gap-3 px-4">
              <Icon as={Mail} size={20} className="text-text" />
              <Text className="text-text font-medium">Contact / Report an Issue</Text>
            </Pressable>

            {onAnnouncementPress && (
              <Pressable
                onPress={onAnnouncementPress}
                className="h-14 rounded-lg bg-surface border border-border flex-row items-center gap-3 px-4">
                <Icon as={Megaphone} size={20} className="text-text" />
                <Text className="text-text font-medium">Announcement</Text>
                {announcementUnseen && (
                  <View className="h-2 w-2 rounded-full bg-brand ml-auto" />
                )}
              </Pressable>
            )}

            <Pressable
              onPress={onAboutPress}
              className="h-14 rounded-lg bg-surface border border-border flex-row items-center gap-3 px-4">
              <Icon as={Info} size={20} className="text-text" />
              <Text className="text-text font-medium">About</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
