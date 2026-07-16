import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
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
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SettingsSheet } from '@/components/settings-sheet';
import { useTimetable } from '@/hooks/useTimetable';
import { formatTime } from '@/lib/api';
import { parseSectionIds } from '@/lib/search-params';
import { DAYS, groupSessionsByDay, todayIndex } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ELASTIC_FACTOR = 0.15;
const SNAP_THRESHOLD_RATIO = 0.2;
const SPRING_CONFIG = { damping: 40, stiffness: 400 };

export default function TimetablePage() {
  const { section_id } = useLocalSearchParams<{ section_id?: string | string[] }>();
  const sectionIds = useMemo(() => parseSectionIds(section_id), [section_id]);
  const { data, isLoading, isError } = useTimetable(sectionIds);

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

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg p-4">
        <Text className="text-text">Loading timetable…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg p-4">
        <Text className="text-danger">Failed to load timetable.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="p-4 pb-2">
        <Text className="text-text text-lg font-bold">{data?.sections_requested.join(', ')}</Text>
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
      </Pressable>

      <SettingsSheet
        ref={settingsSheetRef}
        sectionIds={sectionIds}
        onAboutPress={() => setAboutOpen(true)}
      />

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </View>
  );
}
