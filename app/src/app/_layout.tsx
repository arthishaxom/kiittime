import { GluestackUIProvider } from "~/src/components/ui/gluestack-ui-provider";
import "../../global.css";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Analytics } from "@vercel/analytics/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Check, CircleAlert, CircleCheck, CircleX } from "lucide-react-native";
import type { JSX } from "react";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast, {
	BaseToast,
	type BaseToastProps,
} from "react-native-toast-message";
import { NotificationProvider } from "~/src/components/NotificationProvider";
import { Box } from "~/src/components/ui/box";
import { HStack } from "~/src/components/ui/hstack";
import { Text } from "~/src/components/ui/text";
import { VStack } from "~/src/components/ui/vstack";
import { asyncStoragePersister, queryClient } from "~/src/lib/queryClient";
import { useAppStore } from "~/src/store/appStore";
import useFonts from "../hooks/useFonts";

// Focus bridge (mobile/web)
function onAppStateChange(status: string) {
	focusManager.setFocused(status === "active");
}
AppState.addEventListener("change", onAppStateChange);

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
			useAppStore.persist.rehydrate();
		}
	}, []);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GluestackUIProvider mode="dark">
			<PersistQueryClientProvider
				client={queryClient}
				persistOptions={{
					persister: asyncStoragePersister,
					maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
				}}
			>
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
										name="roll-input"
										options={{ headerShown: false }}
									/>
									<Stack.Screen
										name="timetable"
										options={{ headerShown: false }}
									/>
									<Stack.Screen
										name="section-selection"
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
								{Platform.OS === "web" && <Analytics />}
							</NotificationProvider>
						</KeyboardProvider>
					</SafeAreaProvider>
				</GestureHandlerRootView>
			</PersistQueryClientProvider>
		</GluestackUIProvider>
	);
}
