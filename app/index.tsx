import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTimetableStore } from "~/store/timetableStore";
import { getNotificationSettings } from "~/utils/notifications";

export default function SplashScreen() {
  const fetchTimetable = useTimetableStore((state) => state.fetchTimetable)
  useEffect(() => {
    const checkSavedData = async () => {
      const timetable = await AsyncStorage.getItem("timetable");
      const notiTime = (await getNotificationSettings()).minutesBefore
      if (timetable) {
        useTimetableStore.setState({ timetable: JSON.parse(timetable), notificationTime: notiTime })
        router.replace("/timetable");
      } else {
        router.replace("/rollinput");
      }
    };
    setTimeout(checkSavedData, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  logo: { width: "80%", height: 100 },
}); 