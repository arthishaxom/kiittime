import { Text } from "react-native";
import { Box } from "./ui/box";
import { HStack } from "./ui/hstack";
import { VStack } from "./ui/vstack";

interface ClassCardProps {
	subject: string;
	room: string;
	time: string;
}

export const ClassCard: React.FC<ClassCardProps> = ({
	subject,
	room,
	time,
}) => (
	<Box className="bg-background-100/20 rounded-lg p-4 my-2">
		<HStack className="justify-between items-center">
			<VStack className="flex-1">
				<Text className="text-[#F57C00] text-3xl font-bold mb-1">
					{subject}
				</Text>
				<Text className="text-white text-xl">{room}</Text>
			</VStack>
			<Text className="text-white text-2xl font-medium">{time}</Text>
		</HStack>
	</Box>
);
