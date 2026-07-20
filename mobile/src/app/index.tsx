import { ChevronRight, Info, ArrowLeft } from 'lucide-react-native';
import { useEffect, useState, useRef } from 'react';
import { Image, Pressable, View, TextInput, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AboutDialog } from '@/components/about-dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { timetableHref } from '@/lib/search-params';
import { getSavedSectionIds, saveSectionIds, saveTempLinkingRollNo, clearTempLinkingRollNo, setActiveRollNo, setActiveAcademicYear } from '@/lib/storage';
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

  const [isNotFoundOpen, setIsNotFoundOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getSavedSectionIds();
      if (cancelled) return;
      if (saved && saved.length > 0) {
        router.replace(timetableHref(saved));
      } else {
        await clearTempLinkingRollNo();
        setCheckingSaved(false);
      }
      await SplashScreen.hideAsync();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleRollSubmit = async () => {
    if (rollNo.trim().length < 7) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRollNumberMapping(rollNo.trim());
      const sectionIds = data.sections.map((s) => s.id);
      await saveSectionIds(sectionIds);
      await setActiveRollNo(data.roll_no);
      await setActiveAcademicYear(data.academic_year);
      router.replace(timetableHref(sectionIds));
    } catch (err: any) {
      if (err.status === 404 && err.detail === 'No timetables uploaded yet') {
        setIsEmptyDb(true);
      } else if (err.status === 404 && err.detail === 'Roll number not found') {
        setIsNotFoundOpen(true);
        setError('Roll number not found');
      } else {
        setError(err.message || 'Roll number not found');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkSelection = async () => {
    await saveTempLinkingRollNo(rollNo.trim());
    setIsNotFoundOpen(false);
    setShowManual(true);
  };

  const handleManualSelection = async () => {
    await clearTempLinkingRollNo();
    setIsNotFoundOpen(false);
    setShowManual(true);
  };

  const focusInput = () => {
    inputRef.current?.focus();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-bg"
      style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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

                <View className="mb-6 relative">
                  {/* Hidden TextInput */}
                  <TextInput
                    ref={inputRef}
                    placeholder="e.g. 2105123"
                    placeholderTextColor="#a3a3a3"
                    value={rollNo}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, '');
                      if (cleaned.length <= 9) {
                        setRollNo(cleaned);
                        setError(null);
                      }
                    }}
                    editable={!isLoading}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    className="absolute inset-0 w-full h-full opacity-0 z-10"
                    style={{ color: 'transparent' }}
                  />

                  {/* Styled Character Boxes */}
                  <View className="flex-row justify-between gap-1 sm:gap-2" style={{ minHeight: 56 }}>
                    {Array.from({ length: rollNo.length >= 8 ? 9 : rollNo.length >= 7 ? 8 : 7 }).map((_, i) => {
                      const char = rollNo[i] || '';
                      const isFocused = isInputFocused && i === rollNo.length;
                      const isFilled = char !== '';
                      return (
                        <Pressable
                          key={i}
                          onPress={focusInput}
                          className={
                            'flex-1 h-14 bg-bg rounded-lg border items-center justify-center ' +
                            (isFocused
                              ? 'border-brand'
                              : isFilled
                              ? 'border-border'
                              : 'border-border/30')
                          }>
                          <Text className="text-white text-lg font-bold">
                            {char}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {error && <Text className="text-danger text-sm mt-3 text-center">{error}</Text>}
                </View>

                <Pressable
                  disabled={isLoading || rollNo.trim().length < 7}
                  onPress={handleRollSubmit}
                  className={
                    'w-full h-14 rounded-lg bg-brand flex-row items-center justify-center gap-2 ' +
                    (isLoading || rollNo.trim().length < 7 ? 'opacity-40' : '')
                  }>
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-lg font-semibold">Find Timetable</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={async () => {
                    await clearTempLinkingRollNo();
                    setShowManual(true);
                  }}
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

          <Modal
            visible={isNotFoundOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsNotFoundOpen(false)}>
            <Pressable
              onPress={() => setIsNotFoundOpen(false)}
              className="flex-1 bg-black/60 justify-center p-6">
              <Pressable className="bg-surface rounded-2xl p-6 border border-border">
                <Text className="text-white text-lg font-bold mb-2">⚠️ Roll Number Not Registered</Text>
                <Text className="text-text-muted text-sm leading-relaxed mb-6">
                  We couldn&apos;t find your roll number <Text className="text-white font-bold">{rollNo}</Text> in the system. Would you like to select your sections manually and link your roll number via email OTP?
                </Text>
                <View className="gap-2">
                  <Pressable
                    onPress={handleLinkSelection}
                    className="w-full h-12 bg-brand rounded-lg items-center justify-center">
                    <Text className="text-white font-semibold">Link Roll Number via OTP</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleManualSelection}
                    className="w-full h-12 bg-transparent border border-border rounded-lg items-center justify-center">
                    <Text className="text-text font-medium">Select Manually (No Linking)</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsNotFoundOpen(false)}
                    className="w-full h-12 items-center justify-center">
                    <Text className="text-text-muted font-medium">Cancel</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Pressable
            onPress={() => setAboutOpen(true)}
            className="mt-4 flex-row items-center justify-center gap-2">
            <Icon as={Info} size={16} className="text-text-muted" />
            <Text className="text-text-muted text-sm">About</Text>
          </Pressable>

          <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
