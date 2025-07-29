import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDebouncedCallback } from "use-debounce";
import { Badge, BadgeIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { CloseIcon, Icon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { supabase } from "~/services/supabase";
import { useTimetableStore } from "~/store/timetableStore";

export default function SectionSelectionScreen() {
  const params = useLocalSearchParams<{
    year: string;
    selectedSections?: string;
  }>();
  const year = params.year;

  const { selectedSections, setSelectedSections } = useTimetableStore();

  const [sections, setSections] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filteredSections, setFilteredSections] = useState<string[]>([]);
  const [fetchingSections, setFetchingSections] = useState(false);

  // Fetch sections when component loads
  useEffect(() => {
    const fetchSections = async () => {
      if (!year) return;
      setFetchingSections(true);
      const { data } = await supabase.rpc("get_distinct_sections", {
        academic_year: year,
      });
      setSections(data || []);
      setFilteredSections(data || []);
      setFetchingSections(false);
    };
    fetchSections();
  }, [year]);

  const debounced = useDebouncedCallback((text: string) => {
    const filtered = sections.filter((s: string) =>
      s.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredSections(filtered);
  }, 300);

  const handleSelectSection = (section: string) => {
    if (!selectedSections.includes(section)) {
      setSelectedSections([...selectedSections, section]);
    }
  };

  const handleRemoveSection = (section: string) => {
    setSelectedSections(selectedSections.filter((s) => s !== section));
  };

  const handleDone = () => {
    router.back();
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background-0">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={12}
        style={{ flex: 1 }}
      >
        <VStack space="md" className="flex-1 p-4">
          {/* Header */}
          <HStack className="items-center justify-between mb-6">
            <Pressable onPress={handleGoBack} className="p-2">
              <Icon as={ArrowLeft} size="lg" className="text-white" />
            </Pressable>
            <Text className="text-white text-xl font-bold flex-1 text-center">
              Select Sections
            </Text>
            <Button
              onPress={handleDone}
              className="bg-orange-500 rounded-lg h-10 px-4"
              variant="solid"
            >
              <Text className="text-white font-semibold">Done</Text>
            </Button>
          </HStack>

          {/* Search Input */}
          <Input className="rounded-lg h-16 border-background-100 mb-4 bg-background-0/30">
            <InputField
              autoFocus
              onChangeText={(s) => {
                setSearch(s);
                debounced(s);
              }}
              value={search}
              placeholder="Search sections..."
              className="text-xl text-white"
              placeholderTextColor="#A1A1AA"
            />
          </Input>

          {/* Selected Sections */}
          {selectedSections.length > 0 && (
            <VStack
              space="sm"
              className="mb-4 p-4 bg-background-0/30 border border-background-100 rounded-lg"
            >
              <Text className="text-white font-semibold text-lg">
                Selected Sections ({selectedSections.length}):
              </Text>
              <HStack space="xs" className="flex-wrap">
                {selectedSections.map((section) => (
                  <Pressable
                    onPress={() => handleRemoveSection(section)}
                    key={section}
                    className="mb-2"
                  >
                    <Badge className="bg-orange-50/5 border border-background-50/50 rounded-lg">
                      <Text className="text-white font-semibold">
                        {section}
                      </Text>
                      <BadgeIcon as={CloseIcon} className="ml-2 text-white" />
                    </Badge>
                  </Pressable>
                ))}
              </HStack>
            </VStack>
          )}

          {/* Sections List */}
          <VStack space="xs" className="flex-1">
            <Text className="text-white font-semibold text-lg mb-2">
              Available Sections (Year {year}):
            </Text>
            {fetchingSections ? (
              <VStack className="flex-1 items-center justify-center">
                <Text className="text-neutral-400 text-center text-lg">
                  Loading sections...
                </Text>
              </VStack>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                keyboardShouldPersistTaps="handled"
              >
                <VStack space="xs" className="flex-1 pb-4">
                  {filteredSections.map((section) => (
                    <Button
                      key={section}
                      variant="solid"
                      action="secondary"
                      onPress={() => handleSelectSection(section)}
                      className={`mb-2 rounded-lg h-16 border ${
                        selectedSections.includes(section)
                          ? "bg-background-0/30 border-orange-400/50"
                          : "bg-background-0/30 border-background-100"
                      }`}
                    >
                      <Text
                        className={`text-xl font-semibold ${
                          selectedSections.includes(section)
                            ? "text-white"
                            : "text-white"
                        }`}
                      >
                        {section}
                      </Text>
                    </Button>
                  ))}
                  {!filteredSections.length && !fetchingSections && (
                    <VStack className="flex-1 items-center justify-center py-12">
                      <Text className="text-neutral-400 text-center text-lg">
                        No sections found
                      </Text>
                      <Text className="text-neutral-500 text-center text-sm mt-2">
                        Try adjusting your search
                      </Text>
                    </VStack>
                  )}
                </VStack>
              </ScrollView>
            )}
          </VStack>
        </VStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
