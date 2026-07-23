import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Settings, WifiOff, ChevronDown } from 'lucide-react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AboutDialog } from '@/components/about-dialog';
import { AnnouncementDialog } from '@/components/announcement-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsSheet } from '@/components/settings-sheet';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useTimetable } from '@/hooks/useTimetable';
import { isAnnouncementUnseen } from '@kiittime/api/announcements';
import { formatTime } from '@kiittime/api/api';
import { parseSectionIds } from '@/lib/search-params';
import { getLastSeenAnnouncementId, setLastSeenAnnouncementId, getActiveRollNo, getActiveAcademicYear, saveTempLinkingRollNo, clearTempLinkingRollNo, clearSavedSectionIds, clearActiveRollNo, clearActiveAcademicYear } from '@kiittime/api/storage';
import { DAYS, groupSessionsByDay, todayIndex } from '@/lib/timetable';
import { cn } from '@kiittime/api/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function summarizeSections(sections?: string[]) {
  if (!sections || sections.length === 0) return '';
  if (sections.length === 1) return sections[0];
  return `${sections[0]} + ${sections.length - 1} other${sections.length - 1 > 1 ? 's' : ''}`;
}

const ELASTIC_FACTOR = 0.15;
const SNAP_THRESHOLD_RATIO = 0.2;
const SPRING_CONFIG = { damping: 40, stiffness: 400 };

export default function TimetablePage() {
  const { section_id } = useLocalSearchParams<{ section_id?: string | string[] }>();
  const sectionIds = useMemo(() => parseSectionIds(section_id), [section_id]);
  const { data, isLoading, isError, refetch } = useTimetable(sectionIds);
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;
  const [offlineAlertOpen, setOfflineAlertOpen] = useState(false);
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false);

  const router = useRouter();
  const [activeRollNo, setActiveRollNo] = useState<string | null>(null);
  const [activeAcademicYear, setActiveAcademicYear] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await getActiveRollNo();
      const y = await getActiveAcademicYear();
      setActiveRollNo(r);
      setActiveAcademicYear(y);
    })();
  }, []);

  async function handleEditSection() {
    if (activeRollNo) {
      await saveTempLinkingRollNo(activeRollNo);
      router.push({
        pathname: '/select/sections',
        params: { year: String(activeAcademicYear || 1) },
      });
    }
  }

  async function handleLinkRollNo() {
    await clearSavedSectionIds();
    await clearActiveRollNo();
    await clearActiveAcademicYear();
    await clearTempLinkingRollNo();
    router.replace('/');
  }

  const byDay = useMemo(() => groupSessionsByDay(data?.sessions ?? []), [data]);

  const initialIndex = todayIndex();
  const [index, setIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = useSharedValue(initialIndex);
  const containerWidthShared = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(DAYS.length - 1, nextIndex));
    activeIndex.value = clamped;
    setIndex(clamped);
    translateX.value = withSpring(-clamped * containerWidthShared.value, SPRING_CONFIG);
  }

  function onContainerLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(w);
    containerWidthShared.value = w;
    translateX.value = -activeIndex.value * w;
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      dragStartX.value = translateX.value;
    })
    .onUpdate((e) => {
      const w = containerWidthShared.value;
      if (w === 0) return;
      const min = -(DAYS.length - 1) * w;
      const max = 0;
      let next = dragStartX.value + e.translationX;
      if (next > max) {
        next = max + (next - max) * ELASTIC_FACTOR;
      } else if (next < min) {
        next = min + (next - min) * ELASTIC_FACTOR;
      }
      translateX.value = next;
    })
    .onEnd((e) => {
      const w = containerWidthShared.value;
      if (w === 0) return;
      const threshold = w * SNAP_THRESHOLD_RATIO;
      let nextIndex = activeIndex.value;
      if (e.translationX < -threshold) {
        nextIndex = activeIndex.value + 1;
      } else if (e.translationX > threshold) {
        nextIndex = activeIndex.value - 1;
      }
      runOnJS(goTo)(nextIndex);
    });

  const panelsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const settingsSheetRef = useRef<BottomSheetModal>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const { data: announcement } = useAnnouncement();
  const [lastSeenAnnouncementId, setLastSeenAnnouncementIdState] = useState<number | null>(null);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [autoOpenedForId, setAutoOpenedForId] = useState<number | undefined>(undefined);

  useEffect(() => {
    getLastSeenAnnouncementId().then((id) => {
      setLastSeenAnnouncementIdState(id);
      setLastSeenLoaded(true);
    });
  }, []);

  // Gated on lastSeenLoaded: AsyncStorage is async, so on the very first
  // render(s) lastSeenAnnouncementId is still its initial null — treating
  // that as "nothing seen yet" would flash a false-unseen state (and could
  // wrongly auto-open the dialog below) before the real persisted value has
  // loaded.
  const announcementUnseen =
    lastSeenLoaded && isAnnouncementUnseen(announcement?.id ?? null, lastSeenAnnouncementId);

  // Adjust state during render rather than in an effect (React's recommended
  // pattern for "state that depends on a changed prop"): reacts to
  // announcement?.id changing without re-triggering on every
  // lastSeenAnnouncementId update, which would otherwise reopen the dialog
  // right after dismissal marks it seen.
  if (lastSeenLoaded && announcement && announcement.id !== autoOpenedForId) {
    setAutoOpenedForId(announcement.id);
    if (isAnnouncementUnseen(announcement.id, lastSeenAnnouncementId)) {
      setAnnouncementOpen(true);
    }
  }

  function handleMarkAnnouncementRead() {
    setAnnouncementOpen(false);
    if (announcement) {
      setLastSeenAnnouncementId(announcement.id);
      setLastSeenAnnouncementIdState(announcement.id);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-transparent" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="p-4 pb-2 flex-row items-center justify-center">
          <Skeleton className="h-7 w-32" />
        </View>

        <View className="flex-row gap-1 mx-4 mb-2 p-1 bg-surface rounded-lg">
          {DAYS.map((day, i) => (
            <View
              key={day}
              className={cn(
                'flex-1 h-9 rounded-md items-center justify-center',
                i === initialIndex && 'bg-pill',
              )}>
              <Text
                className={cn(
                  'text-sm font-medium',
                  i === initialIndex ? 'text-brand-active' : 'text-text-muted',
                )}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-1 px-4 pb-4">
          <ScrollView contentContainerClassName="gap-2 pb-4 pt-2" className="flex-1" scrollEnabled={false}>
            {[1, 2, 3, 4].map((n) => (
              <View
                key={n}
                className="bg-surface rounded-lg p-4 flex-row justify-between items-center">
                <View className="gap-2">
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-5 w-16" />
                </View>
                <Skeleton className="h-7 w-20" />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  if (isError && !data) {
    if (isOffline) {
      return (
        <View className="flex-1 bg-transparent items-center justify-center p-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <Icon as={WifiOff} size={48} className="text-text-muted mb-4" />
          <Text className="text-text text-xl font-bold text-center mb-2">You{"'"}re offline</Text>
          <Text className="text-text-muted text-center mb-6">
            Please connect to the internet to load your timetable for the first time.
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="px-6 py-3 bg-brand rounded-lg active:opacity-90">
            <Text className="text-brand-active font-semibold">Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-transparent items-center justify-center p-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Text className="text-danger text-lg font-semibold text-center mb-4">Failed to load timetable.</Text>
        <Pressable
          onPress={() => refetch()}
          className="px-6 py-3 bg-brand rounded-lg active:opacity-90">
          <Text className="text-brand-active font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="p-4 pb-2 flex-row items-center justify-center gap-2">
        <Pressable
          onPress={() => setSectionsModalOpen(true)}
          className="flex-row items-center gap-1 active:opacity-85 max-w-full">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-text text-lg font-bold shrink">
            {summarizeSections(data?.sections_requested)}
          </Text>
          <Icon as={ChevronDown} size={18} className="text-text-muted shrink-0" />
        </Pressable>
        {isOffline && (
          <Pressable
            onPress={() => setOfflineAlertOpen(true)}
            hitSlop={12}
            className="p-1 rounded-full active:bg-surface-hover">
            <Icon as={WifiOff} size={16} className="text-text-muted" />
          </Pressable>
        )}
      </View>

      <View className="flex-row gap-1 mx-4 mb-2 p-1 bg-surface rounded-lg">
        {DAYS.map((day, i) => (
          <Pressable
            key={day}
            onPress={() => goTo(i)}
            className={cn(
              'flex-1 h-9 rounded-md items-center justify-center',
              i === index && 'bg-pill',
            )}>
            <Text
              className={cn(
                'text-sm font-medium',
                i === index ? 'text-brand-active' : 'text-text-muted',
              )}>
              {day}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-1 overflow-hidden" onLayout={onContainerLayout}>
        <GestureDetector gesture={pan}>
          <Animated.View
            className="h-full flex-row"
            style={[{ width: containerWidth * DAYS.length }, panelsStyle]}>
            {DAYS.map((day) => {
              const sessions = byDay.get(day) ?? [];
              return (
                <View key={day} className="h-full px-4 pb-4" style={{ width: containerWidth }}>
                  <ScrollView contentContainerClassName="gap-2 pb-4 pt-2" className="flex-1">
                    {sessions.length === 0 ? (
                      <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-text-muted">No Classes Today</Text>
                      </View>
                    ) : (
                      sessions.map((s, i) => (
                        <View
                          key={i}
                          className="bg-surface rounded-lg p-4 flex-row justify-between items-center">
                          <View>
                            <Text className="text-brand text-2xl font-bold">{s.course_code}</Text>
                            <Text className="text-text text-lg">{s.room_number}</Text>
                          </View>
                          <Text className="text-text text-xl font-medium">
                            {formatTime(s.start_time)}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </Animated.View>
        </GestureDetector>
      </View>

      <Pressable
        onPress={() => settingsSheetRef.current?.present()}
        className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-surface border border-border items-center justify-center shadow-lg">
        <Icon as={Settings} size={22} className="text-text" />
        {announcementUnseen && (
          <View className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-brand" />
        )}
      </Pressable>

      <SettingsSheet
        ref={settingsSheetRef}
        sectionIds={sectionIds}
        onAboutPress={() => setAboutOpen(true)}
        onAnnouncementPress={
          announcement
            ? () => {
                setAnnouncementOpen(true);
              }
            : undefined
        }
        announcementUnseen={announcementUnseen}
      />

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <Dialog open={offlineAlertOpen} onOpenChange={setOfflineAlertOpen}>
        <DialogContent className="bg-sheet border-border">
          <DialogHeader>
            <DialogTitle className="text-text text-center text-xl">Offline Mode</DialogTitle>
          </DialogHeader>
          <View className="items-center gap-4 py-2">
            <Icon as={WifiOff} size={36} className="text-text-muted" />
            <Text className="text-text text-center font-medium">
              You are offline. Showing cached data.
            </Text>
            <Text className="text-text-muted text-sm text-center">
              Please reconnect to the internet to fetch the latest timetable updates.
            </Text>
          </View>
        </DialogContent>
      </Dialog>
      <Dialog open={sectionsModalOpen} onOpenChange={setSectionsModalOpen}>
        <DialogContent className="bg-sheet border-border">
          <DialogHeader>
            <DialogTitle className="text-text text-center text-xl">Manage Sections</DialogTitle>
          </DialogHeader>
          <View className="gap-4 py-2">
            <View className="gap-1">
              <Text className="text-text-muted text-sm font-medium">Selected Sections</Text>
              <View className="flex-row flex-wrap gap-2 mt-1">
                {data?.sections_requested.map((sec) => (
                  <View key={sec} className="bg-surface border border-border px-3 py-1.5 rounded-full">
                    <Text className="text-text font-medium text-sm">{sec}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-text-muted text-sm font-medium">Linked Roll Number</Text>
              <Text className="text-text text-lg font-bold mt-0.5">
                {activeRollNo ?? 'Not linked'}
              </Text>
            </View>

            <Pressable
              onPress={async () => {
                setSectionsModalOpen(false);
                if (activeRollNo) {
                  await handleEditSection();
                } else {
                  await handleLinkRollNo();
                }
              }}
              className="mt-2 w-full bg-brand h-12 rounded-lg items-center justify-center active:opacity-90">
              <Text className="text-white font-semibold">
                {activeRollNo ? 'Relink Roll Number' : 'Link Roll Number'}
              </Text>
            </Pressable>
          </View>
        </DialogContent>
      </Dialog>
      {announcement && (
        <AnnouncementDialog
          announcement={announcement}
          open={announcementOpen}
          onOpenChange={setAnnouncementOpen}
          onMarkAsRead={handleMarkAnnouncementRead}
          unseen={announcementUnseen}
        />
      )}
    </View>
  );
}
