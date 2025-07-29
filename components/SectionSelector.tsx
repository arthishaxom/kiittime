import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type React from "react";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { Badge, BadgeIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { CloseIcon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { supabase } from "~/services/supabase";
import { useTimetableStore } from "~/store/timetableStore";

interface SectionSelectorProps {
  onSubmit: (sections: string[], year: string) => void;
  isLoading?: boolean;
}

const YEAR_OPTIONS = ["1", "2", "3", "4"];

const SectionSelector: React.FC<SectionSelectorProps> = ({
  onSubmit,
  isLoading,
}) => {
  const {
    selectedSections,
    selectedYear: year,
    setSelectedSections,
    setSelectedYear: setYear,
  } = useTimetableStore();

  const [fetchingSections, setFetchingSections] = useState(false);

  // Fetch sections when year changes
  useEffect(() => {
    const fetchSections = async () => {
      if (!year) return;
      setFetchingSections(true);
      await supabase.rpc("get_distinct_sections", {
        academic_year: year,
      });
      // We don't need to store sections anymore, just track loading state
      setFetchingSections(false);
    };
    fetchSections();
  }, [year]);

  const handleRemoveSection = (section: string) => {
    setSelectedSections(selectedSections.filter((s) => s !== section));
  };

  const handleNavigateToSectionSelection = () => {
    if (!year) return;
    router.push({
      pathname: "/section-selection",
      params: {
        year,
        selectedSections: selectedSections.join(","),
      },
    });
  };

  const handleSubmit = () => {
    if (selectedSections.length && year) {
      onSubmit(selectedSections, year);
    }
  };

  return (
    <VStack space="md">
      <Text className="mb-2 text-lg text-neutral-100">Year</Text>
      <HStack space="sm" className="mb-2">
        {YEAR_OPTIONS.map((y) => (
          <Button
            key={y}
            action="secondary"
            variant={year === y ? "solid" : "outline"}
            onPress={() => {
              setSelectedSections([]);
              setYear(y);
            }}
            disabled={isLoading}
            className="rounded-lg h-16 border-background-50 flex-1 border-2"
          >
            <Text className="text-xl">{y}</Text>
          </Button>
        ))}
      </HStack>
      <Button
        variant="outline"
        onPress={handleNavigateToSectionSelection}
        disabled={!year || fetchingSections || isLoading}
        className={`mb-2 rounded-lg justify-between h-16 border-background-50 ${
          isLoading || !year || fetchingSections ? "opacity-50" : ""
        }`}
      >
        <Text className="text-xl">
          {year
            ? fetchingSections
              ? "Loading sections..."
              : "Select sections"
            : "Select year first"}
        </Text>
        <ChevronRight size={20} color={"white"} />
      </Button>

      {/* Display selected sections */}
      {selectedSections.length > 0 && (
        <VStack space="sm" className="mb-2">
          <Text className="text-neutral-100 font-semibold">
            Selected Sections:
          </Text>
          <HStack space="xs" className="flex-wrap">
            {selectedSections.map((section) => (
              <Pressable
                onPress={() => handleRemoveSection(section)}
                key={section}
                className="mb-2"
              >
                <Badge className="bg-orange-50/5 border border-background-50/50 rounded-lg">
                  <Text className="text-white">{section}</Text>
                  <BadgeIcon as={CloseIcon} className="ml-2 text-white" />
                </Badge>
              </Pressable>
            ))}
          </HStack>
        </VStack>
      )}

      <Button
        size="lg"
        variant="solid"
        onPress={handleSubmit}
        disabled={!selectedSections.length || isLoading || !year}
        className={`h-16 rounded-lg bg-orange-500 ${
          isLoading || !year || !selectedSections.length ? "opacity-50" : ""
        }`}
      >
        <Text className="text-white">Submit</Text>
      </Button>
    </VStack>
  );
};

export default SectionSelector;
