import { ChevronRight, Info, ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, View, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AboutDialog } from '@/components/about-dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { timetableHref } from '@/lib/search-params';
import { getSavedSectionIds, saveSectionIds } from '@/lib/storage';
import { fetchRollNumberMapping } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

const YEARS = [1, 2, 3, 4];

export default function Index() {
  const router = useRouter();
  const [checkingSaved, setCheckingSaved] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const [rollNo, setRollNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmptyDb, setIsEmptyDb] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getSavedSectionIds();
      if (cancelled) return;
      if (saved && saved.length > 0) {
        router.replace(timetableHref(saved));
      } else {
        setCheckingSaved(false);
      }
      await SplashScreen.hideAsync();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleRollSubmit = async () => {
    if (!rollNo.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRollNumberMapping(rollNo.trim());
      const sectionIds = data.sections.map((s) => s.id);
      await saveSectionIds(sectionIds);
      router.replace(timetableHref(sectionIds));
    } catch (err: any) {
      if (err.status === 404 && err.detail === 'No timetables uploaded yet') {
        setIsEmptyDb(true);
      } else {
        setError(err.message || 'Roll number not found');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSaved) {
    return <View className="flex-1 bg-bg" />;
  }

  if (isEmptyDb) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="flex-1 bg-bg px-6 py-6 justify-between">
          <View className="flex-1 justify-center items-center">
            <Image
              source={require('@/assets/images/logo_fg.png')}
              className="h-25 w-4/5 max-w-70 mb-8"
              resizeMode="contain"
            />
            <View className="bg-surface rounded-2xl p-8 items-center border border-border w-full">
              <View className="w-16 h-16 bg-brand/10 rounded-full items-center justify-center mb-4">
                <Icon as={Info} size={32} className="text-brand" />
              </View>
              <Text className="text-text font-bold text-xl mb-2 text-center">No timetables uploaded yet</Text>
              <Text className="text-text-muted text-sm text-center leading-relaxed mb-6">
                The database is currently empty. The administrator has not uploaded any timetable data for this semester yet.
              </Text>
              <Pressable
                onPress={() => setIsEmptyDb(false)}
                className="w-full h-14 rounded-lg bg-brand items-center justify-center">
                <Text className="text-white text-lg font-semibold">Try Again</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => setAboutOpen(true)}
            className="mt-4 flex-row items-center justify-center gap-2">
            <Icon as={Info} size={16} className="text-text-muted" />
            <Text className="text-text-muted text-sm">About</Text>
          </Pressable>

          <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-1 bg-bg px-6 py-6">
        <View className="flex-1 items-center justify-center">
          <Image
            source={require('@/assets/images/logo_fg.png')}
            className="h-25 w-4/5 max-w-70"
            resizeMode="contain"
          />
        </View>

        <View className="bg-surface rounded-2xl p-8 border border-border/20">
          {!showManual ? (
            <View>
              <Text className="text-text text-lg font-semibold mb-1">Find your Timetable</Text>
              <Text className="text-text-muted text-sm mb-4">Enter your roll number to automatically load your schedule.</Text>

              <View className="mb-4">
                <TextInput
                  placeholder="e.g. 2105123"
                  placeholderTextColor="#a3a3a3"
                  value={rollNo}
                  onChangeText={(val) => {
                    setRollNo(val);
                    setError(null);
                  }}
                  editable={!isLoading}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  className="w-full h-14 bg-bg rounded-lg px-4 border border-border text-text text-lg"
                  style={{ color: '#ffffff' }}
                />
                {error && <Text className="text-danger text-sm mt-2">{error}</Text>}
              </View>

              <Pressable
                disabled={isLoading || !rollNo.trim()}
                onPress={handleRollSubmit}
                className={
                  'w-full h-14 rounded-lg bg-brand flex-row items-center justify-center gap-2 ' +
                  (isLoading || !rollNo.trim() ? 'opacity-40' : '')
                }>
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white text-lg font-semibold">Find Timetable</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowManual(true)}
                className="w-full mt-4 items-center justify-center">
                <Text className="text-brand font-medium text-sm">Select sections manually</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable onPress={() => setShowManual(false)} className="p-1 -ml-1">
                  <Icon as={ArrowLeft} size={20} className="text-text-muted" />
                </Pressable>
                <Text className="text-text text-lg font-semibold">Find by Section</Text>
              </View>
              <Text className="text-text-muted text-sm mb-4">Select your academic year to pick sections.</Text>

              <Text className="text-text-muted text-sm mb-2 mt-4 font-medium">Year</Text>
              <View className="flex-row gap-2 mb-4">
                {YEARS.map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => setYear(y)}
                    className={
                      'flex-1 h-14 rounded-lg border-2 items-center justify-center ' +
                      (year === y ? 'bg-brand border-brand' : 'bg-transparent border-border')
                    }>
                    <Text className="text-lg font-medium text-text">
                      {y}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={!year}
                onPress={() =>
                  router.push({ pathname: '/select/sections', params: { year: String(year) } })
                }
                className={
                  'w-full h-14 rounded-lg border border-border flex-row items-center justify-between px-4' +
                  (!year ? ' opacity-40' : '')
                }>
                <Text className={'text-lg ' + (year ? 'text-text' : 'text-text-muted')}>
                  {year ? 'Select sections' : 'Select year first'}
                </Text>
                <Icon as={ChevronRight} size={20} className="text-text" />
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => setAboutOpen(true)}
          className="mt-4 flex-row items-center justify-center gap-2">
          <Icon as={Info} size={16} className="text-text-muted" />
          <Text className="text-text-muted text-sm">About</Text>
        </Pressable>

        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </View>
    </View>
  );
}
