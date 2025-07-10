import type React from "react";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useDebouncedCallback } from "use-debounce";
import { Badge, BadgeIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { CloseIcon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { supabase } from "~/services/supabase";

interface SectionSelectorProps {
	onSubmit: (sections: string[], year: string) => void;
	isLoading?: boolean;
}

const YEAR_OPTIONS = ["2", "3", "4"];

const SectionSelector: React.FC<SectionSelectorProps> = ({
	onSubmit,
	isLoading,
}) => {
	const [year, setYear] = useState<string | null>(null);
	const [sections, setSections] = useState<string[]>([]); // all available
	const [selectedSections, setSelectedSections] = useState<string[]>([]);
	const [showModal, setshowModal] = useState(false);
	const [search, setSearch] = useState("");
	const [filteredSections, setFilteredSections] = useState<string[]>([]);
	const [fetchingSections, setFetchingSections] = useState(false);

	// Fetch sections when year changes
	useEffect(() => {
		const fetchSections = async () => {
			if (!year) return;
			setFetchingSections(true);
			const { data } = await supabase.rpc("get_distinct_sections", {
        academic_year: year,
			});
			console.log(data);
      setFetchingSections(false);
			// You may want to handle data and error here
		};
		fetchSections();
	}, [year]);

	const debounced = useDebouncedCallback((text: string) => {
		const filtered = sections.filter((s: string) =>
			s.toLowerCase().includes(text.toLowerCase()),
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
		setshowModal(false);
		setSearch("");
	};

	const handleSubmit = () => {
		if (selectedSections.length && year) {
			onSubmit(selectedSections, year);
		}
	};

	return (
		<VStack space="md">
			<Text className="mb-2 text-neutral-100">Year</Text>
			<HStack
				space="sm"
				className="mb-4"
			>
				{YEAR_OPTIONS.map((y) => (
					<Button
						key={y}
						variant={year === y ? "solid" : "outline"}
						onPress={() => setYear(y)}
						disabled={isLoading}
					>
						<Text>{y}</Text>
					</Button>
				))}
			</HStack>
			<Button
				variant="outline"
				onPress={() => setshowModal(true)}
				disabled={!year || fetchingSections || isLoading}
				className="mb-2"
			>
				<Text>
					{selectedSections.length
						? selectedSections.join(", ")
						: year
							? fetchingSections
								? "Loading sections..."
								: "Select sections"
							: "Select year first"}
				</Text>
			</Button>
			<Modal
				isOpen={showModal}
				onClose={handleDone}
			>
				<VStack
					space="md"
					className="p-4 bg-background-0 rounded-lg"
				>
					<Input>
						<InputField
							autoFocus
							onChangeText={(s) => {
								setSearch(s);
								debounced(s);
							}}
							value={search}
							placeholder="Search sections..."
						/>
					</Input>
					<VStack
						space="xs"
						className="max-h-48 overflow-scroll"
					>
						{filteredSections.map((section) => (
							<Button
								key={section}
								variant={
									selectedSections.includes(section) ? "solid" : "outline"
								}
								onPress={() => handleSelectSection(section)}
								className="mb-1"
							>
								<Text>{section}</Text>
							</Button>
						))}
						{!filteredSections.length && (
							<Text className="text-neutral-400">No sections found</Text>
						)}
					</VStack>
					<HStack
						space="xs"
						className="flex-wrap mb-2"
					>
						{selectedSections.map((section) => (
							<Pressable
								onPress={() => handleRemoveSection(section)}
								key={section}
							>
								<Badge>
									<Text>{section}</Text>
									<BadgeIcon
										as={CloseIcon}
										className="ml-2"
									/>
								</Badge>
							</Pressable>
						))}
					</HStack>
					<Button
						onPress={handleDone}
						variant="solid"
					>
						<Text>Done</Text>
					</Button>
				</VStack>
			</Modal>
			<Button
				variant="solid"
				onPress={handleSubmit}
				disabled={!selectedSections.length || isLoading}
			>
				<Text>Submit</Text>
			</Button>
		</VStack>
	);
};

export default SectionSelector;
