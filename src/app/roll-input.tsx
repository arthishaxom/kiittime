import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { ArrowLeftRight } from "lucide-react-native";
import { useRef, useState } from "react";
import {
	Image,
	ImageBackground,
	Platform,
	Pressable,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { RollInput, type RollInputHandle } from "~/src/components/RollInput";
import SectionSelector from "~/src/components/SectionSelector";
import { Box } from "~/src/components/ui/box";
import { HStack } from "~/src/components/ui/hstack";
import { Text } from "~/src/components/ui/text";
import { VStack } from "~/src/components/ui/vstack";
import {
	usePrefetchTimetableByRoll,
	usePrefetchTimetableBySections,
} from "~/src/hooks/queries";
import { useAppStore } from "~/src/store/appStore";

export default function RollInputScreen() {
	const [inputType, setInputType] = useState<"roll" | "section">("roll");
	const { setRollNumber: setStoreRollNumber } = useAppStore();

	const rollInputRef = useRef<RollInputHandle>(null);

	const { mutateAsync: prefetchByRoll, isPending: isFetchingRoll } =
		usePrefetchTimetableByRoll();
	const { mutateAsync: prefetchBySections, isPending: isFetchingSections } =
		usePrefetchTimetableBySections();

	const isLoading = isFetchingRoll || isFetchingSections;

	const handleValidSubmitRoll = async (rollNumber: string) => {
		try {
			await setStoreRollNumber(rollNumber);
			await prefetchByRoll(rollNumber); // primes cache or throws
			router.replace("/timetable");
		} catch (_error) {
			console.error("Failed to fetch timetable by roll:", _error);
			router.push("/not-found");
		}
	};

	const handleValidSubmitSections = async (
		sections: string[],
		academic_year: string,
	) => {
		try {
			await prefetchBySections({ sections, year: academic_year });
			router.replace("/timetable");
		} catch (_error) {
			console.error("Failed to fetch timetable by sections:", _error);
			router.push("/not-found");
		}
	};

	const handleTapOutside = () => {
		if (inputType === "roll") {
			rollInputRef.current?.blurInput();
		}
	};

	// Main content (shared between web and mobile)
	const MainContent = (
		<VStack className="flex-1">
			<Box
				className="flex-1 justify-center items-center"
				style={
					Platform.OS === "web"
						? {
								height: 400,
							}
						: {}
				}
			>
				<Image
					source={require("@/assets/logo_fg.png")}
					className="w-4/5 h-[100px]"
					resizeMode="contain"
					style={
						Platform.OS === "web"
							? {
									maxWidth: "80%",
									height: 100,
									objectFit: "contain",
								}
							: {}
					}
				/>
			</Box>

			<Box
				className="bg-background-0 rounded-[15px] p-8 mx-4"
				style={
					Platform.OS === "web"
						? {
								maxWidth: 400,
								alignSelf: "center",
								width: "90%",
							}
						: {}
				}
			>
				{/* <Image
          source={require("@/assets/logo_wbg.png")}
          className="w-[60px] h-[60px] self-center mb-5 rounded-lg"
          resizeMode="contain"
          style={
            Platform.OS === "web"
              ? {
                  width: 60,
                  height: 60,
                  objectFit: "contain",
                  borderRadius: 8,
                }
              : {}
          }
        /> */}

				<HStack className="justify-between items-center mb-2">
					<Text className="text-neutral-100 font-semibold text-lg">
						{inputType === "roll" ? "Find by Roll Number" : "Find by Section"}
					</Text>
					<Pressable
						onPress={() =>
							setInputType(inputType === "roll" ? "section" : "roll")
						}
						className="p-1"
					>
						<ArrowLeftRight
							size={18}
							color="#F57C00"
						/>
					</Pressable>
				</HStack>

				{inputType === "roll" ? (
					<RollInput
						ref={rollInputRef}
						isLoading={isLoading}
						onValidSubmit={handleValidSubmitRoll}
					/>
				) : (
					<SectionSelector
						onSubmit={handleValidSubmitSections}
						isLoading={isLoading}
					/>
				)}
			</Box>
		</VStack>
	);

	if (Platform.OS === "web") {
		// Web: No ImageBackground, KeyboardAvoidingView, or TouchableWithoutFeedback
		return (
			<View
				className="flex-1 bg-black"
				// style={{ minHeight: '100vh' as any }}
			>
				<SafeAreaView
					className="flex-1"
					style={{ minHeight: 1 }}
				>
					<GestureHandlerRootView style={{ flex: 1 }}>
						<BottomSheetModalProvider>{MainContent}</BottomSheetModalProvider>
					</GestureHandlerRootView>
				</SafeAreaView>
			</View>
		);
	}

	// Mobile: Original behavior
	return (
		<ImageBackground
			source={require("@/assets/background.png")}
			className="flex-1 bg-black"
			resizeMode="cover"
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<BottomSheetModalProvider>
					{inputType === "roll" ? (
						<KeyboardAvoidingView
							behavior={Platform.OS === "ios" ? "padding" : "height"}
							style={{ flex: 1 }}
						>
							<TouchableWithoutFeedback onPress={handleTapOutside}>
								<SafeAreaView className="flex-1">{MainContent}</SafeAreaView>
							</TouchableWithoutFeedback>
						</KeyboardAvoidingView>
					) : (
						<TouchableWithoutFeedback onPress={handleTapOutside}>
							<SafeAreaView className="flex-1">{MainContent}</SafeAreaView>
						</TouchableWithoutFeedback>
					)}
				</BottomSheetModalProvider>
			</GestureHandlerRootView>
		</ImageBackground>
	);
}
