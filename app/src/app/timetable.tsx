import {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetModal,
	BottomSheetModalProvider,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { LogOut, Settings, Share2 } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Share, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { TimetableSkeletonLoader } from "~/src/components/TimetableLoader";
import { Button } from "~/src/components/ui/button";
import { Fab, FabIcon } from "~/src/components/ui/fab";
import { HStack } from "~/src/components/ui/hstack";
import { VStack } from "~/src/components/ui/vstack";
import {
	useClearTimetable,
	useTimetableByRoll,
	useTimetableBySections,
} from "~/src/hooks/queries";
import { showToast } from "~/src/utils/helpers";
import Timetable from "../components/Timetable";
import { useAppStore } from "../store/appStore";
import {
	debugNotificationStatus,
	openAlarmPermissionSettings,
} from "../utils/notifications";

export default function TimetableScreen() {
	const [_testingNotification, setTestingNotification] = useState(false);

	const rollNumber = useAppStore((s) => s.rollNumber);
	const selectedSections = useAppStore((s) => s.selectedSections);
	const selectedYear = useAppStore((s) => s.selectedYear);

	const { isLoading: qRollLoading } = useTimetableByRoll(rollNumber);
	const { isLoading: qSecLoading } = useTimetableBySections(
		selectedSections,
		selectedYear,
	);

	const isLoading = qRollLoading || qSecLoading;

	const clearMutation = useClearTimetable();
	const notificationTime = useAppStore((state) => state.notificationTime);
	const setNotificationTime = useAppStore((state) => state.setNotificationTime);

	const bottomSheetModalRef = useRef<BottomSheetModal>(null);

	const handleNotificationTimeChange = async (value: number) => {
		try {
			await setNotificationTime(value);

			if (value === 0) {
				showToast(
					"sToast",
					"Notifications Disabled",
					"You will no longer receive class notifications.",
				);
			} else {
				showToast(
					"sToast",
					"Notifications Updated",
					`We will remind you ${value}m before your classes.`,
				);
			}
		} catch (error: unknown) {
			console.error("Failed to update notification settings:", error);

			// Handle Android 12+ exact alarm permission error
			if (
				error instanceof Error &&
				error.message?.includes("Exact alarm permission")
			) {
				await openAlarmPermissionSettings();
				showToast(
					"eToast",
					"Permission Required",
					"Please enable 'Alarms & Reminders' permission in settings for notifications to work properly.",
				);
			} else {
				showToast("eToast", "Error", "Failed to update notification settings");
			}
		}
	};

	const handleClear = async () => {
		try {
			await clearMutation.mutateAsync();
			router.replace("/roll-input");
		} catch (error) {
			console.error("Failed to clear timetable:", error);
			showToast("eToast", "Error", "Failed to clear timetable");
		}
	};

	const _handleTestNotification = async () => {
		try {
			setTestingNotification(true);
			// const _id = await scheduleTestNotification();
			// const notis = await getScheduledNotifications();
			const status = await debugNotificationStatus();
			showToast(
				"sToast",
				"Test Notification Scheduled",
				"You should receive a notification in about 90 seconds.",
			);
		} catch (error: unknown) {
			if (error instanceof Error) {
				showToast("eToast", "Error", error.message);
			} else {
				showToast("eToast", "Error", "An unknown error occurred");
			}
		} finally {
			setTestingNotification(false);
		}
	};

	const handlePresentModalPress = useCallback(() => {
		bottomSheetModalRef.current?.present();
	}, []);

	const snapPoints = useMemo(() => ["10%"], []);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				style={{
					// backgroundColor: "black",
					flex: 1,
				}}
				opacity={0.1}
				disappearsOnIndex={0}
				appearsOnIndex={1}
			/>
		),
		[],
	);

	const onShare = async () => {
		try {
			const _result = await Share.share({
				message:
					"Check out KIIT Time - The minimal timetable app for KIIT University students!\nhttps://play.google.com/store/apps/details?id=com.ashish.kiittime",
			});
		} catch (error: unknown) {
			if (error instanceof Error) {
				showToast("eToast", "Share Error", error.message);
			} else {
				showToast("eToast", "Share Error", "An unknown error occurred");
			}
		}
	};

	return (
		<SafeAreaView className="flex-1 bg-background-0">
			<GestureHandlerRootView style={{ flex: 1 }}>
				{/* <VStack className="flex-1 items-center w-full">
          {rollNumber && (
            <Box className="w-full h-min py-4 items-center justify-center">
              <Heading className="text-center w-full h-min">
                {rollNumber}
              </Heading>
            </Box>
          )}
          <View style={{ flex: 1 }}>
            {isLoading ? <TimetableSkeletonLoader /> : <TimetableComponent />}
          </View>
        </VStack> */}

				<View style={{ flex: 1 }}>
					{isLoading ? <TimetableSkeletonLoader /> : <Timetable />}
				</View>

				<BottomSheetModalProvider>
					<Fab
						size="lg"
						placement="bottom right"
						onPress={handlePresentModalPress}
						className="bg-background-0/40 border border-background-100 z-1 rounded-lg hover:bg-background-100 active:bg-background-100"
					>
						<FabIcon
							as={Settings}
							className="text-white"
						/>
					</Fab>
					<BottomSheetModal
						style={{
							zIndex: 20,
						}}
						ref={bottomSheetModalRef}
						backgroundStyle={{
							backgroundColor: "#181818",
						}}
						handleIndicatorStyle={{
							backgroundColor: "white",
						}}
						backdropComponent={renderBackdrop}
						snapPoints={snapPoints}
						index={1}
						enableDynamicSizing={true}
					>
						<BottomSheetView className="flex-1 z-20 items-center flex-col p-4">
							<Text className="text-white text-xl font-bold mb-4 w-full text-center">
								Settings
							</Text>

							<View className="flex flex-row gap-4 m-4">
								<Button
									onPress={onShare}
									className="flex-1 h-16 p-3 bg-background-0/30 border border-background-100 rounded-lg"
									action="secondary"
								>
									<HStack className="items-center gap-2">
										<Share2
											color="white"
											size={20}
										/>
										<Text className="text-white text-md">Share</Text>
									</HStack>
								</Button>
								<Button
									onPress={handleClear}
									className="flex-1 h-16 p-3 bg-[#E42A33]/90 rounded-lg"
									action="negative"
								>
									<HStack className="items-center gap-2">
										<LogOut
											color="white"
											size={20}
										/>
										<Text className="text-white text-md">Change Roll</Text>
									</HStack>
								</Button>
							</View>

							{/* <View className="w-full mb-4 px-4">
                <Button
                  onPress={_handleTestNotification}
                  className="w-full h-14 rounded-lg bg-green-600 items-center justify-center"
                  variant="solid"
                  disabled={_testingNotification}
                >
                  <Text className="text-white font-semibold text-center">
                    {_testingNotification ? "Scheduling..." : "Test Notification"}
                  </Text>
                </Button>
              </View> */}

							<View className="mb-4 w-full px-4">
								<Text className="text-white text-lg font-semibold mb-2 ml-1">
									Reminder Time Before Class
								</Text>
								<VStack
									space="md"
									className="w-full"
								>
									<HStack className=" flex-wrap w-full">
										{[10, 15, 20, 25, 30, 0].map((minutes, _idx) => (
											<View
												key={minutes}
												className="w-1/3 p-1"
												// gluestack: flex={1} minWidth={0}
											>
												<Button
													onPress={() => handleNotificationTimeChange(minutes)}
													action="secondary"
													className={`
                            w-full h-min py-3 rounded-lg items-center justify-center
                            bg-background-0/30 border
                            ${
															notificationTime === minutes
																? "border-orange-500"
																: "border-background-100"
														}
                          `}
													variant="solid"
												>
													<Text className="text-white font-semibold text-center">
														{minutes === 0 ? "Off" : `${minutes} min`}
													</Text>
												</Button>
											</View>
										))}
									</HStack>
								</VStack>
							</View>

							<View className="flex-grow" />

							<View className="flex items-center justify-center flex-row gap-2 mb-3">
								<Text className="text-white">Made with ❤️ by</Text>
								<Text
									className="text-primary-500 font-bold"
									onPress={() =>
										Linking.openURL("https://www.linkedin.com/in/ashish-pothal")
									}
								>
									Ashish Pothal
								</Text>
							</View>
							<View className="flex flex-row justify-center items-center gap-2 mb-5">
								<Text className="text-gray-400">Need Help?</Text>
								<Text
									className="underline text-gray-400"
									onPress={() =>
										Linking.openURL(
											"mailto:pothal.builds@gmail.com?subject=Query%20Regarding%20KIIT%20Time",
										)
									}
								>
									Contact Us
								</Text>
							</View>
						</BottomSheetView>
					</BottomSheetModal>
				</BottomSheetModalProvider>
			</GestureHandlerRootView>
		</SafeAreaView>
	);
}
