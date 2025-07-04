import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Check, CircleAlert, CircleCheck, CircleX } from "lucide-react-native";
import type { JSX } from "react";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast, {
	BaseToast,
	type BaseToastProps,
} from "react-native-toast-message";
import { NotificationProvider } from "~/components/NotificationProvider";
import { Box } from "~/components/ui/box";
import { HStack } from "~/components/ui/hstack";
import { Text } from "~/components/ui/text";
import { VStack } from "~/components/ui/vstack";
import { useTimetableStore } from "~/store/timetableStore";
import "../global.css";
import { Analytics } from "@vercel/analytics/react";
import { vexo } from "vexo-analytics";
import useFonts from "../hooks/useFonts";

if (Platform.OS !== "web") {
	// biome-ignore lint/style/noNonNullAssertion: API KEY
	vexo(process.env.EXPO_PUBLIC_VEXO_API!);
}

const toastConfig = {
	success: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
		<BaseToast
			{...props}
			style={{
				width: "95%",
				borderLeftWidth: 0,
				backgroundColor: "#262626",
				borderColor: "#000000",
			}}
			contentContainerStyle={{ paddingHorizontal: 15 }}
			text1Style={{
				fontSize: 15,
				color: "white",
				fontWeight: "600",
			}}
			text2Style={{
				fontSize: 13,
				color: "#A1A1AA",
			}}
			renderLeadingIcon={() => (
				<Check
					color={"green"}
					size={20}
				/>
			)}
		/>
	),

	sToast: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
		<Box className="bg-background-0 border border-background-50  rounded-lg p-3 w-[95%]">
			<HStack className="items-center gap-3">
				<CircleCheck
					color={"#42f548"}
					size={20}
				/>
				<VStack>
					<Box>
						<Text className="font-bold text-white text-lg">{props.text1}</Text>
					</Box>
					{props.text2 && (
						<Box>
							<Text className="font-semibold text-md text-white/70">
								{props.text2}
							</Text>
						</Box>
					)}
				</VStack>
			</HStack>
		</Box>
	),

	eToast: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
		<Box className="bg-background-0 border border-background-50 rounded-lg p-3 w-[95%]">
			<HStack className="items-center gap-3">
				<CircleX
					color={"#E42A33"}
					size={20}
				/>
				<VStack>
					<Box>
						<Text className="font-bold text-white text-lg">{props.text1}</Text>
					</Box>
					{props.text2 && (
						<Box>
							<Text className="font-semibold text-md text-white/70">
								{props.text2}
							</Text>
						</Box>
					)}
				</VStack>
			</HStack>
		</Box>
	),

	iToast: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
		<Box className="bg-background-0 border border-background-50  rounded-lg p-3 w-[95%]">
			<HStack className="items-center gap-3">
				<CircleAlert
					color={"#4287f5"}
					size={20}
				/>
				<VStack>
					<Box>
						<Text className="font-bold text-white text-lg">{props.text1}</Text>
					</Box>
					{props.text2 && (
						<Box>
							<Text className="font-semibold text-md text-white/70">
								{props.text2}
							</Text>
						</Box>
					)}
				</VStack>
			</HStack>
		</Box>
	),
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const fontsLoaded = useFonts();

	// Manually rehydrate on web since we're using skipHydration
	useEffect(() => {
		if (Platform.OS === "web") {
			useTimetableStore.persist.rehydrate();
		}
	}, []);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GluestackUIProvider mode="dark">
			<GestureHandlerRootView style={{ flex: 1 }}>
				<SafeAreaProvider>
					<KeyboardProvider>
						<NotificationProvider>
							<StatusBar style="auto" />
							<Stack>
								<Stack.Screen
									name="index"
									options={{ headerShown: false }}
								/>
								<Stack.Screen
									name="rollinput"
									options={{ headerShown: false }}
								/>
								<Stack.Screen
									name="timetable"
									options={{ headerShown: false }}
								/>
								<Stack.Screen
									name="privacy-policy"
									options={{ headerShown: false }}
								/>
								<Stack.Screen
									name="not-found"
									options={{ headerShown: false }}
								/>
							</Stack>
							<Toast config={toastConfig} />
							{Platform.OS === 'web' && <Analytics/>}
						</NotificationProvider>
					</KeyboardProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</GluestackUIProvider>
	);
}
