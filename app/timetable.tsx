import { Box } from "@/components/ui/box";
import { Fab, FabIcon } from "@/components/ui/fab";
import { VStack } from "@/components/ui/vstack";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { LogOut, Settings, Share2 } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { HStack } from "~/components/ui/hstack";
import { showToast } from "~/utils/helpers";
import TimetableComponent from "../components/TimetableComponent";
import { useTimetableStore } from "../store/timetableStore";
import {
  cancelAllNotifications,
  debugNotificationStatus,
  openAlarmPermissionSettings,
  scheduleTestNotification
} from "../utils/notifications";

export default function TimetableScreen() {
  const [testingNotification, setTestingNotification] = useState(false);

  const timetable = useTimetableStore((state) => state.timetable);
  const isLoading = useTimetableStore((state) => state.isLoading);
  const error = useTimetableStore((state) => state.error);
  const clearTimetable = useTimetableStore((state) => state.clearTimetable);
  const notificationTime = useTimetableStore((state) => state.notificationTime);
  const setNotificationTime = useTimetableStore((state) => state.setNotificationTime);

  const handleNotificationTimeChange = async (value: number) => {
    try {
      await setNotificationTime(value);

      if (value === 0) {
        showToast(
          "sToast",
          "Notifications Disabled",
          "You will no longer receive class notifications."
        );
      } else {
        showToast(
          "sToast",
          "Notifications Updated",
          `We will remind you ${value}m before your classes.`,
        );
      }
    } catch (error: any) {
      console.error('Failed to update notification settings:', error);

      // Handle Android 12+ exact alarm permission error
      if (error.message?.includes('Exact alarm permission')) {
        await openAlarmPermissionSettings()
        showToast(
          "eToast",
          "Permission Required",
          "Please enable 'Alarms & Reminders' permission in settings for notifications to work properly."
        );
      } else {
        showToast("eToast", "Error", "Failed to update notification settings");
      }
    }
  };

  const handleClear = () => {
    // Cancel all notifications
    cancelAllNotifications().catch((err) =>
      console.error("Failed to cancel notifications:", err),
    );

    router.replace("/rollinput");
    setTimeout(() => {
      clearTimetable();
    }, 100);
  };

  const handleTestNotification = async () => {
    try {
      setTestingNotification(true);
      const id = await scheduleTestNotification();
      // const notis = await getScheduledNotifications();
      const status = await debugNotificationStatus();
      console.log(status);
      showToast(
        "sToast",
        "Test Notification Scheduled",
        "You should receive a notification in about 90 seconds.",
      );
    } catch (error: any) {
      showToast("eToast", "Error", error.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const snapPoints = useMemo(() => ["44%", "45%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        style={{
          // backgroundColor: "black",
          flex: 1,
        }}
        opacity={.1}
        disappearsOnIndex={0}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const onShare = async () => {
    try {
      const result = await Share.share({
        message:
          "Check out KIIT Time - The best timetable app for KIIT University students!",
      });
    } catch (error: any) {
      showToast("eToast", "Share Error", error.message);
    }
  };

  const TimetableSkeletonLoader = () => (
    <View className="flex-1 bg-background-500 p-4">
      <Box className="p-2 mx-4 bg-[#1e1e1e] rounded-lg h-12 mb-4" />
      <VStack space="md">
        {[...Array(5)].map((_, i) => (
          <Box
            key={i}
            className="h-24 bg-[#1e1e1e] rounded-lg"
          />
        ))}
      </VStack>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView className="bg-background-500 flex-1">
        <View style={styles.centerContainer} className="flex-col gap-4">
          <Pressable
            onPress={async () => {
              const url =
                "mailto:pothal.builds@gmail.com?subject=Query%20Regarding%20KIIT%20Time";
              try {
                await Linking.openURL(url);
              } catch (err) {
                console.error("Could not open email client:", err);
              }
            }}
          >
            <Text style={[styles.errorText, { textAlign: "center" }]}>
              It looks like either your roll no. doesn't exist or we don't have
              your Timetable. If you believe your roll no. is correct, you can
              share your timetable with me by mailing it to - {"\n"}
            </Text>
            <Text className="text-primary-500 font-bold text-lg mt-2 text-center">
              pothal.builds@gmail.com
            </Text>
          </Pressable>
          <TouchableOpacity
            onPress={() => router.replace("/rollinput")}
            className="bg-red-500/20 border border-red-500/30 p-3 rounded-lg mt-4"
          >
            <Text className="text-red-400 font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <TimetableSkeletonLoader />
          ) : (
            <TimetableComponent />
          )}
        </View>

        <BottomSheetModalProvider>
          <Fab
            size="lg"
            placement="bottom right"
            onPress={handlePresentModalPress}
            className="bg-background-0/40 border border-background-100 z-1 rounded-lg hover:bg-background-100 active:bg-background-100"
          >
            <FabIcon as={Settings} className="text-white" />
          </Fab>
          <BottomSheetModal
            style={{
              zIndex: 20
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
          >
            <BottomSheetView className="flex-1 z-20 items-center flex-col p-4">
              <Text className="text-white text-xl font-bold mb-4">Settings</Text>

              <View className="flex flex-row gap-4 m-4">
                <Button
                  onPress={onShare}
                  className="flex-1 h-16 p-3 bg-background-0/30 border border-background-100 rounded-lg"
                  action="secondary"
                >
                  <HStack className="items-center gap-2">

                    <Share2 color="white" size={20} />
                    <Text className="text-white text-md">Share</Text>
                  </HStack>
                </Button>
                <Button
                  onPress={handleClear}
                  className="flex-1 h-16 p-3 bg-[#E42A33]/90 rounded-lg"
                  action="negative"
                >
                  <HStack className="items-center gap-2">

                    <LogOut color="white" size={20} />
                    <Text className="text-white text-md">Change Roll</Text>
                  </HStack>
                </Button>
              </View>

              {/* <View className="w-full mb-4 px-4">
                <Button
                  onPress={handleTestNotification}
                  className="w-full h-14 rounded-lg bg-green-600 items-center justify-center"
                  variant="solid"
                  disabled={testingNotification}
                >
                  <Text className="text-white font-semibold text-center">
                    {testingNotification ? "Scheduling..." : "Test Notification"}
                  </Text>
                </Button>
              </View> */}

              <View className="mb-4 w-full px-4">
                <Text className="text-white text-lg font-semibold mb-2 ml-1">
                  Notification Time
                </Text>
                <VStack space="md" className="w-full">
                  <HStack className=" flex-wrap w-full">
                    {[10, 15, 20, 25, 30, 0].map((minutes, idx) => (
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
                            ${notificationTime === minutes ? "border-orange-500" : "border-background-100"}
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

              <View className="flex flex-row gap-2 mb-3">
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
              <View className="flex flex-row gap-2 mb-5">
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

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
}); 