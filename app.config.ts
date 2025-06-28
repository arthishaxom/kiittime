/// <reference types="node" />

import type { ConfigContext, ExpoConfig } from "@expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";
const versionCode = process.env.ANDROID_VERSION_CODE
	? parseInt(process.env.ANDROID_VERSION_CODE)
	: 14;

const getUniqueIdentifier = () => {
	if (IS_DEV) {
		return "com.justashish.kiittime.dev";
	}
	if (IS_PREVIEW) {
		return "com.justashish.kiittime.preview";
	}
	return "com.ashish.kiittime";
};

const getAppName = () => {
	if (IS_DEV) {
		return "KIIT Time (Dev)";
	}
	if (IS_PREVIEW) {
		return "KIIT Time (Preview)";
	}
	return "KIIT Time";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: getAppName(),
	slug: "kiittime",
	version: process.env.APP_VERSION || "1.1.3",
	orientation: "portrait",
	icon: "./assets/images/icon.png",
	scheme: "kiittime",
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	ios: {
		...config.ios,
		supportsTablet: true,
		bundleIdentifier: getUniqueIdentifier(),
	},
	android: {
		...config.android,
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#ffffff",
		},
		versionCode: versionCode,
		edgeToEdgeEnabled: true,
		package: getUniqueIdentifier(),
	},
	web: {
		bundler: "metro",
		output: "static",
		favicon: "./assets/images/favicon.png",
	},
	plugins: [
		"expo-router",
		[
			"expo-splash-screen",
			{
				image: "./assets/splash-icon.png",
				imageWidth: 200,
				resizeMode: "contain",
				backgroundColor: "#181818",
			},
		],
		[
			"expo-build-properties",
			{
				android: {
					extraMavenRepos: [
						"../../node_modules/@notifee/react-native/android/libs",
					],
				},
				ios: {},
			},
		],
		[
			"expo-notifications",
			{
				icon: "./assets/notification_icon.png",
				color: "#ffffff",
			},
		],
	],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		router: {},
		eas: {
			projectId: "f7de0f76-8159-46db-8f52-d6a77ffeebdf",
		},
	},
});
