import { Stack } from "expo-router";
import { View, Text } from "react-native";
import "../global.css"

export default function RootLayout() {
  return (
    <View className="flex-1">
      <Stack />
      <View className="bg-green-500 p-2">
        <Text className="text-red-500 text-center font-bold">
          ✅ uniwind is working
        </Text>
      </View>
    </View>
  );
}
