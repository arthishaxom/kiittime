import React, { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import { ScheduleSlot } from "~/store/timetableState";
import { useTimetableStore } from "~/store/timetableStore";
import { DAYS } from "../utils/constants";
import { getCurrentDay } from "../utils/helpers";
import { ClassroomCard } from "./ClassroomCard";

const TimetableComponent: React.FC = () => {
  const layout = useWindowDimensions();
  const { day, dayIndex } = getCurrentDay();
  // Update initial index to handle Sunday (index 6) by setting to Monday (index 0)
  const [index, setIndex] = useState(dayIndex === 6 ? 0 : dayIndex);

  // Get timetable from store
  const timetable = useTimetableStore((state) => state.timetable);

  const renderScene = ({ route }: { route: { key: string } }) => (
    <View className="flex-1 mt-2 px-4 bg-background">
      {(() => {
        const daySchedule = timetable[route.key];
        
        // Check if the day exists in timetable
        if (!daySchedule) {
          return (
            <View className="flex-1 h-full flex-row justify-center items-center p-5">
              <Text className="text-gray-400 text-base">No Classes Today</Text>
            </View>
          );
        }
        
        // Check if the day schedule is an array and has items
        if (!Array.isArray(daySchedule) || daySchedule.length === 0) {
          return (
            <View className="flex-1 h-full flex-row justify-center items-center p-5">
              <Text className="text-gray-400 text-base">No Classes Today</Text>
            </View>
          );
        }
        
        // Sort and render the classes
        try {
          const sortedSchedule = daySchedule.sort((a: ScheduleSlot, b: ScheduleSlot) => a.Time_Sort - b.Time_Sort);
          return sortedSchedule.map((classroom: ScheduleSlot, index: number) => (
            <ClassroomCard
              key={index}
              subject={classroom.Subject}
              room={classroom.Room}
              time={classroom.Time}
            />
          ));
        } catch (error) {
          console.error('Error sorting or rendering schedule:', error);
          return (
            <View className="flex-1 h-full flex-row justify-center items-center p-5">
              <Text className="text-gray-400 text-base">Error loading classes</Text>
            </View>
          );
        }
      })()}
    </View>
  );

  if (!timetable || Object.keys(timetable).length === 0) {
    return (
      <View className="flex-1 h-full flex-row justify-center items-center p-5">
        <Text className="text-gray-400 text-base">
          No timetable data available
        </Text>
      </View>
    );
  }

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

export default TimetableComponent;
