import * as Linking from "expo-linking";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Center } from "~/components/ui/center";
import { HStack } from "~/components/ui/hstack";
import { Text } from "~/components/ui/text";
import { useTimetableStore } from "~/store/timetableStore";

const NotFoundPage = () => {
	return (
		<SafeAreaView className="flex-1 bg-background-0">
			<Center className="flex-1 p-8 flex-col gap-3">
				<Text className="text-white font-bold text-3xl">404 Not Found</Text>
				<Text className="text-white text-lg">
					It looks like either your roll number doesn't exist or we don't have
					your timetable in our system yet.
					{"\n\n"}
					This could happen if:
					{"\n"}• You entered an incorrect roll number
					{"\n"}• Your timetable hasn't been added to our database
					{"\n"}• There's a temporary issue with our servers
					{"\n\n"}
					Please check your roll number and try again, or share your timetable
					with us if you believe your roll number is correct.
				</Text>
				<HStack className="gap-3">
					<Button
						onPress={async () => {
							const url =
								"mailto:pothal.builds@gmail.com?subject=Query%20Regarding%20KIIT%20Time";
							try {
								await Linking.openURL(url);
							} catch (err) {
								console.error("Could not open email client:", err);
							}
						}}
						className="h-min flex-1 bg-background-100/30 border border-background-100 p-3 rounded-lg mt-4"
						action="secondary"
					>
						<Text className="font-semibold text-white">Send Email</Text>
					</Button>
					<Button
						onPress={() => {
							useTimetableStore.setState({ error: null });
							router.back();
						}}
						className="flex-1 h-min bg-[#E42A33]/90 p-3 rounded-lg mt-4"
						action="negative"
					>
						<Text className="text-white font-semibold">Retry</Text>
					</Button>
				</HStack>
			</Center>
		</SafeAreaView>
	);
};

export default NotFoundPage;
