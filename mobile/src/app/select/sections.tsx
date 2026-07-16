import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, memo, useCallback } from 'react';
import { Linking, Pressable, FlatList, View } from 'react-native';
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
import { saveSectionIds } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function SectionSearch() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const parsedYear = Number(yearParam);
  const year = Number.isInteger(parsedYear) && parsedYear >= 1 && parsedYear <= 4 ? parsedYear : 1;
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState('All');

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
    await saveSectionIds(selectedIds);
    router.replace(timetableHref(selectedIds));
  }

  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-1 bg-bg px-4 pt-4">
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
                  <Text className="text-text-muted text-center">No sections match "{search}".</Text>
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
    </View>
  );
}
