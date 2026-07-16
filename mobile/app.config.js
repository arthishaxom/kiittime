const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

// versionCode/buildNumber are intentionally NOT set here.
// EAS manages these remotely (cli.appVersionSource: "remote" + autoIncrement
// in eas.json) so they can never collide with what's already live on
// the Play Store / App Store. Seed the remote counter once via:
//   eas build:version:set
// (enter your last-published Play Store versionCode when prompted)
// before your first build from this rebuilt project.

function getUniqueIdentifier() {
  if (IS_DEV) return "com.justashish.kiittime.dev";
  if (IS_PREVIEW) return "com.justashish.kiittime.preview";
  return "com.ashish.kiittime";
}

function getAppName() {
  if (IS_DEV) return "KIIT Time (Dev)";
  if (IS_PREVIEW) return "KIIT Time (Preview)";
  return "KIIT Time";
}

module.exports = ({ config }) => ({
  ...config,
  name: getAppName(),
  slug: "kiittime",
  version: process.env.APP_VERSION || "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "kiittime",
  userInterfaceStyle: "automatic",

  ios: {
    ...config.ios,
    supportsTablet: true,
    icon: "./assets/images/icon.png",
    bundleIdentifier: getUniqueIdentifier(),
  },

  android: {
    ...config.android,
    package: getUniqueIdentifier(),
    predictiveBackGestureEnabled: true,
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: "#181818",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },

  web: {
    ...config.web,
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
        backgroundColor: "#181818",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification_icon.png",
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

  updates: {
    url: "https://u.expo.dev/f7de0f76-8159-46db-8f52-d6a77ffeebdf",
  },

  runtimeVersion: {
    policy: "appVersion",
  },
});