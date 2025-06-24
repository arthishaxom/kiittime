/// <reference types="node" />

import { ConfigContext, ExpoConfig } from "@expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "com.justashish.kiittime.dev";
  }
  if (IS_PREVIEW) {
    return "com.justashish.kiittime.preview";
  }
  return "com.justashish.kiittime";
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
  version: "1.0.0",
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
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-build-properties",
      {
        "android": {
          "extraMavenRepos": [
            "../../node_modules/@notifee/react-native/android/libs"
          ]
        },
        "ios": {}
      }
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