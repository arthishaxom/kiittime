import { ChevronRight, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AboutDialog } from '@/components/about-dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { timetableHref } from '@/lib/search-params';
import { getSavedSectionIds } from '@/lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

const YEARS = [1, 2, 3, 4];

export default function Index() {
  const router = useRouter();
  const [year, setYear] = useState<number | undefined>(undefined);
  const [checkingSaved, setCheckingSaved] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

  if (checkingSaved) {
    return <View className="flex-1 bg-bg" />;
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

      <View className="bg-surface rounded-2xl p-8">
        <Text className="text-text text-lg font-semibold mb-1">Find by Section</Text>

        <Text className="text-text-muted text-sm mb-2 mt-4">Year</Text>
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
