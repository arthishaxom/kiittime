import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, memo, useCallback, useEffect, useRef } from 'react';
import { Linking, Pressable, FlatList, View, ActivityIndicator, Modal, TextInput } from 'react-native';
import { toast } from 'sonner-native';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { useSections } from '@/hooks/useSections';
import { buildMailto } from '@/lib/mailto';
import { extractPrefixes, filterSections } from '@/lib/sections';
import { timetableHref } from '@/lib/search-params';
import { saveSectionIds, getTempLinkingRollNo, clearTempLinkingRollNo, setActiveRollNo, setActiveAcademicYear } from '@kiittime/api/storage';
import { cn } from '@kiittime/api/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendOtp, verifyOtp } from '@kiittime/api/api';


const MAX_SECTIONS = 5;

const SectionRow = memo(({
  item,
  isSelected,
  disabled,
  onToggle,
}: {
  item: { id: number; section_name: string };
  isSelected: boolean;
  disabled: boolean;
  onToggle: (id: number) => void;
}) => {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onToggle(item.id)}
      className={cn(
        'h-14 rounded-lg px-4 justify-center',
        isSelected ? 'bg-brand' : 'bg-surface border border-border',
        disabled && 'opacity-40',
      )}>
      <Text className="font-medium text-text">{item.section_name}</Text>
    </Pressable>
  );
});
SectionRow.displayName = 'SectionRow';


export default function SectionSearch() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const parsedYear = Number(yearParam);
  const year = Number.isInteger(parsedYear) && parsedYear >= 1 && parsedYear <= 4 ? parsedYear : 1;
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState('All');

  // OTP flow states
  const [rollNoToLink, setRollNoToLink] = useState<string | null>(null);
  const [isConfirmLinkOpen, setIsConfirmLinkOpen] = useState(false);
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpInputFocused, setIsOtpInputFocused] = useState(false);

  const otpInputRef = useRef<TextInput>(null);

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    (async () => {
      const val = await getTempLinkingRollNo();
      setRollNoToLink(val);
    })();
  }, []);

  const { data: sections, isLoading, isError } = useSections(year);

  const prefixes = useMemo(() => extractPrefixes(sections ?? []), [sections]);

  const filtered = useMemo(
    () => filterSections(sections ?? [], { search, prefix: selectedPrefix }),
    [sections, search, selectedPrefix],
  );

  const selectedSections = useMemo(
    () => sections?.filter((s) => selectedIds.includes(s.id)) ?? [],
    [sections, selectedIds],
  );

  const atCap = selectedIds.length >= MAX_SECTIONS;

  const toggleSection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SECTIONS) return prev;
      return [...prev, id];
    });
  }, []);

  async function handleDone() {
    if (rollNoToLink) {
      setIsConfirmLinkOpen(true);
    } else {
      await saveSectionIds(selectedIds);
      router.replace(timetableHref(selectedIds));
    }
  }

  const handleSendOtp = async () => {
    if (!rollNoToLink) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      await sendOtp(rollNoToLink, selectedIds);
      setIsConfirmLinkOpen(false);
      setIsOtpOpen(true);
      setResendCooldown(60);
    } catch (err: any) {
      const msg = err.message || 'Failed to send OTP. Please try again.';
      setOtpError(msg);
      toast.error(msg);
      if (err.status === 429) {
        const match = msg.match(/Please wait (\d+) seconds/i);
        if (match) {
          setResendCooldown(parseInt(match[1], 10));
        } else {
          setResendCooldown(60);
        }
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!rollNoToLink || otp.length < 6) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const data = await verifyOtp(rollNoToLink, otp);
      const sectionIds = data.sections.map((s) => s.id);
      await saveSectionIds(sectionIds);
      await setActiveRollNo(rollNoToLink);
      await setActiveAcademicYear(data.academic_year);
      await clearTempLinkingRollNo();
      setIsOtpOpen(false);
      router.replace(timetableHref(sectionIds));
    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP code.');
      if (err.status === 429) {
        toast.error(err.message || 'Too many failed attempts. Account locked.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSkipLink = async () => {
    await clearTempLinkingRollNo();
    setIsConfirmLinkOpen(false);
    await saveSectionIds(selectedIds);
    router.replace(timetableHref(selectedIds));
  };

  const focusOtpInput = () => {
    otpInputRef.current?.focus();
  };


  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-transparent" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-1 px-4 pt-4">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-2xl text-text">←</Text>
          </Pressable>
          <Text className="flex-1 text-center text-xl font-bold text-text">Select Sections</Text>
          <Pressable disabled={selectedIds.length === 0} onPress={handleDone} hitSlop={12}>
            <Text
              className={cn(
                'font-semibold text-brand',
                selectedIds.length === 0 && 'opacity-40',
              )}>
              Done
            </Text>
          </Pressable>
        </View>

        <Input
          placeholder="Search sections…"
          value={search}
          onChangeText={setSearch}
          className="mb-4"
        />

        {prefixes.length > 1 && (
          <Select
            value={{ value: selectedPrefix, label: selectedPrefix }}
            onValueChange={(option) => option && setSelectedPrefix(option.value)}>
            <SelectTrigger className="mb-4">
              <SelectValue placeholder="All" className="text-text" />
            </SelectTrigger>
            <SelectContent>
              {prefixes.map((prefix) => (
                <SelectItem key={prefix} value={prefix} label={prefix} />
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedSections.length > 0 && (
          <View className="mb-2">
            <Text className="text-text-muted text-sm mb-2">
              Selected Sections ({selectedSections.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {selectedSections.map((s) => (
                <Pressable key={s.id} onPress={() => toggleSection(s.id)}>
                  <Badge>
                    <Text>{s.section_name} ×</Text>
                  </Badge>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {atCap && <Text className="text-danger text-xs mb-2">Max 5 sections</Text>}

        <Text className="text-text-muted text-sm mb-2">Available Sections (Year {year})</Text>

        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          className="flex-1"
          contentContainerClassName="gap-2 pb-4"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {isLoading && <Text className="text-text-muted text-sm">Loading sections…</Text>}
              {isError && <Text className="text-danger text-sm">Failed to load sections.</Text>}

              {!isLoading && !isError && (!sections || sections.length === 0) && (
                <View className="items-center py-8">
                  <Text className="text-text-muted text-center mb-1">
                    No sections available for Year {year} yet.
                  </Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        buildMailto({
                          subject: `KIIT Time - No sections for Year ${year}`,
                          body: `Hi, I noticed there are no sections listed yet for Year ${year}. Could you add them?`,
                        }),
                      )
                    }>
                    <Text className="text-brand underline">Email me to request it</Text>
                  </Pressable>
                </View>
              )}

              {!isLoading && !isError && sections && sections.length > 0 && filtered.length === 0 && (
                <View className="items-center py-8">
                  <Text className="text-text-muted text-center">No sections match &quot;{search}&quot;.</Text>
                  <Text className="text-text-muted text-sm">Try a different search term.</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item: s }) => {
            const isSelected = selectedIds.includes(s.id);
            const disabled = !isSelected && atCap;
            return (
              <SectionRow
                item={s}
                isSelected={isSelected}
                disabled={disabled}
                onToggle={toggleSection}
              />
            );
          }}
        />
      </View>

      {/* Confirm Link Modal */}
      <Modal
        visible={isConfirmLinkOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsConfirmLinkOpen(false)}>
        <Pressable
          onPress={() => setIsConfirmLinkOpen(false)}
          className="flex-1 bg-black/60 justify-center p-6">
          <Pressable className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-white text-lg font-bold mb-2">Link Roll Number?</Text>
            <Text className="text-text-muted text-sm leading-relaxed mb-6">
              Would you like to link your roll number <Text className="text-white font-bold">{rollNoToLink}</Text> to these sections so you don&apos;t have to select them next time?
            </Text>
            <View className="gap-2">
              <Pressable
                disabled={isSendingOtp}
                onPress={handleSendOtp}
                className="w-full h-12 bg-brand rounded-lg items-center justify-center flex-row gap-2">
                {isSendingOtp ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold">Link via OTP</Text>
                )}
              </Pressable>
              <Pressable
                onPress={handleSkipLink}
                className="w-full h-12 bg-transparent border border-border rounded-lg items-center justify-center">
                <Text className="text-text font-medium">No, thanks (Just View)</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* OTP Input Modal */}
      <Modal
        visible={isOtpOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsOtpOpen(false);
          setOtp('');
          setOtpError(null);
        }}>
        <Pressable
          onPress={() => {
            setIsOtpOpen(false);
            setOtp('');
            setOtpError(null);
          }}
          className="flex-1 bg-black/60 justify-center p-6">
          <Pressable className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-white text-lg font-bold mb-2">Verify Your Email</Text>
            <Text className="text-text-muted text-sm leading-relaxed mb-4">
              We&apos;ve sent a 6-digit verification code to <Text className="text-white font-bold">{rollNoToLink}@kiit.ac.in</Text>. Enter it below to link your roll number.
            </Text>

            <View className="relative flex-row justify-between gap-1 sm:gap-2 my-6" style={{ minHeight: 56 }}>
              {/* Hidden actual TextInput */}
              <TextInput
                ref={otpInputRef}
                value={otp}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '');
                  if (cleaned.length <= 6) {
                    setOtp(cleaned);
                    setOtpError(null);
                  }
                }}
                onFocus={() => setIsOtpInputFocused(true)}
                onBlur={() => setIsOtpInputFocused(false)}
                disabled={isVerifyingOtp}
                keyboardType="number-pad"
                maxLength={6}
                className="absolute inset-0 w-full h-full opacity-0 z-10"
                style={{ color: 'transparent' }}
              />

              {/* Styled OTP character slots */}
              {Array.from({ length: 6 }).map((_, i) => {
                const char = otp[i] || '';
                const isFocused = isOtpInputFocused && i === otp.length;
                const isFilled = char !== '';
                return (
                  <Pressable
                    key={i}
                    onPress={focusOtpInput}
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

            {otpError && (
              <Text className="text-danger text-sm text-center mb-4">{otpError}</Text>
            )}

            <View className="gap-2">
              <Pressable
                disabled={isVerifyingOtp || otp.length < 6}
                onPress={handleVerifyOtp}
                className={
                  'w-full h-12 bg-brand rounded-lg items-center justify-center flex-row gap-2 ' +
                  (isVerifyingOtp || otp.length < 6 ? 'opacity-40' : '')
                }>
                {isVerifyingOtp ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold">Verify & Link</Text>
                )}
              </Pressable>
              
              <Pressable
                disabled={isSendingOtp || resendCooldown > 0}
                onPress={handleSendOtp}
                className="w-full h-12 items-center justify-center">
                <Text className="text-brand font-semibold text-sm">
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsOtpOpen(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="w-full h-12 items-center justify-center">
                <Text className="text-text-muted font-medium">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
