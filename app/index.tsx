import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { useTimetableStore } from "~/store/timetableStore";
import { getNotificationSettings } from "~/utils/notifications";

// Only allow the two possible redirect destinations
const TIMETABLE = "/timetable" as const;
const ROLLINPUT = "/rollinput" as const;
type RedirectPath = typeof TIMETABLE | typeof ROLLINPUT;

export default function IndexRedirect() {
  const [redirect, setRedirect] = useState<RedirectPath | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkSavedData = async () => {
      try {
        const timetable = await AsyncStorage.getItem("timetable");
        const notiTime = (await getNotificationSettings()).minutesBefore;
        
        if (timetable) {
          useTimetableStore.setState({ 
            timetable: JSON.parse(timetable), 
            notificationTime: notiTime 
          });
          setRedirect(TIMETABLE);
        } else {
          setRedirect(ROLLINPUT);
        }
      } catch (error) {
        console.error("Error checking saved data:", error);
        setRedirect(ROLLINPUT); // Fallback to roll input
      } finally {
        setIsReady(true);
        // Hide splash screen once we know where to redirect
        SplashScreen.hideAsync();
      }
    };
    checkSavedData();
  }, []);

  if (!redirect || !isReady) return null;
  return <Redirect href={redirect} />;
} 