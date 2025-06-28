import { Box } from "lucide-react-native";
import { View } from "react-native";
import { VStack } from "./ui/vstack";

export const TimetableSkeletonLoader = () => (
	<View className="flex-1 bg-background-500 p-4">
		<Box className="p-2 mx-4 bg-[#1e1e1e] rounded-lg h-12 mb-4" />
		<VStack space="md">
			{[...Array(5)].map((_, _i) => (
				<Box
					key={_}
					className="h-24 bg-[#1e1e1e] rounded-lg"
				/>
			))}
		</VStack>
	</View>
);
