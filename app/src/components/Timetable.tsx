import type React from "react";
import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { TabBar, TabView } from "react-native-tab-view";
import {
	useTimetableByRoll,
	useTimetableBySections,
} from "~/src/hooks/queries";
import type { ScheduleSlot } from "~/src/store/appState";
import { useAppStore } from "~/src/store/appStore";
import { DAYS } from "../utils/constants";
import { getCurrentDay } from "../utils/helpers";
import { ClassCard } from "./ClassCard";
import { TimetableSkeletonLoader } from "./TimetableLoader";
import { Center } from "./ui/center";

const Timetable: React.FC = () => {
	const layout = useWindowDimensions();
	const { dayIndex } = getCurrentDay();
	// Update initial index to handle Sunday (index 6) by setting to Monday (index 0)
	const [index, setIndex] = useState(dayIndex === 6 ? 0 : dayIndex);
	const rollNumber = useAppStore((s) => s.rollNumber);
	const selectedSections = useAppStore((s) => s.selectedSections);
	const selectedYear = useAppStore((s) => s.selectedYear);
	const {
		data: ttBySections,
		isLoading: qSecLoading,
		error: qSecError,
	} = useTimetableBySections(selectedSections, selectedYear);
	const {
		data: ttByRoll,
		isLoading: qRollLoading,
		error: qRollError,
	} = useTimetableByRoll(rollNumber);

	// Get timetable from store
	const isLoading = qRollLoading || qSecLoading;
	const error = qRollError || qSecError;

	const timetable = (rollNumber ? ttByRoll : ttBySections) ?? {};

	if (isLoading) {
		return <TimetableSkeletonLoader />;
	}
	if (error) {
		return (
			<Center className="flex-1 h-full flex-row justify-center items-center p-5">
				<Text className="text-gray-400 text-base">
					Failed to load timetable
				</Text>
			</Center>
		);
	}

	const renderScene = ({ route }: { route: { key: string } }) => (
		<View className="flex-1 mt-2 px-4 pb-16 bg-background">
			{(() => {
				const daySchedule = timetable[route.key];

				// Check if the day exists in timetable
				if (!daySchedule) {
					return (
						<Center className="flex-1 h-full flex-row justify-center items-center p-5">
							<Text className="text-gray-400 text-base">No Classes Today</Text>
						</Center>
					);
				}

				// Check if the day schedule is an array and has items
				if (!Array.isArray(daySchedule) || daySchedule.length === 0) {
					return (
						<Center className="flex-1 h-full flex-row justify-center items-center p-5">
							<Text className="text-gray-400 text-base">No Classes Today</Text>
						</Center>
					);
				}

				// Sort and render the classes
				try {
					const sortedSchedule = daySchedule.sort(
						(a: ScheduleSlot, b: ScheduleSlot) => a.Time_Sort - b.Time_Sort,
					);
					return (
						<ScrollView
							className="flex-1"
							showsVerticalScrollIndicator={false}
						>
							{sortedSchedule.map((classroom: ScheduleSlot, _index: number) => (
								<ClassCard
									key={
										classroom.Subject.slice(0, 4) +
										classroom.Time_Sort +
										classroom.Day +
										classroom.Section
									}
									subject={classroom.Subject}
									room={classroom.Room}
									time={classroom.Time}
								/>
							))}
							{/* Extra spacer to prevent FAB obstruction */}
							<View style={{ height: 80, width: "100%" }} />
						</ScrollView>
					);
				} catch (error) {
					console.error("Error sorting or rendering schedule:", error);
					return (
						<View className="flex-1 h-full flex-row justify-center items-center p-5">
							<Text className="text-gray-400 text-base">
								Error loading classes
							</Text>
						</View>
					);
				}
			})()}
		</View>
	);

	// if (!timetable || Object.keys(timetable).length === 0) {
	//   return (
	//     <View className="flex-1 h-full flex-row justify-center items-center p-5">
	//       <Text className="text-gray-400 text-base">
	//         No timetable data available
	//       </Text>
	//     </View>
	//   );
	// }

	const routes = DAYS.filter((day) => day !== "SUN").map((day) => ({
		key: day,
		title: day,
	}));

	return (
		<TabView
			navigationState={{ index, routes }}
			renderScene={renderScene}
			onIndexChange={setIndex}
			initialLayout={{ width: layout.width }}
			renderTabBar={(props) => (
				<View className="p-2 mx-4 bg-[#1e1e1e] rounded-lg">
					<TabBar
						{...props}
						style={{
							backgroundColor: "#1e1e1e",
							elevation: 0,
							shadowOpacity: 0,
							borderRadius: 8,
						}}
						indicatorStyle={{
							height: "100%",
							borderRadius: 8,
							backgroundColor: "#161616",
						}}
						tabStyle={{
							padding: 0,
						}}
						contentContainerStyle={{
							marginVertical: 0,
						}}
						activeColor="#ff8000"
						inactiveColor="#888"
					/>
				</View>
			)}
		/>
	);
};

export default Timetable;
