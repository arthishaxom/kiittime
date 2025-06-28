import { Redirect, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useTimetableStore } from "~/store/timetableStore";

// Only allow the two possible redirect destinations
const TIMETABLE = "/timetable" as const;
const ROLLINPUT = "/rollinput" as const;
type RedirectPath = typeof TIMETABLE | typeof ROLLINPUT;

export default function IndexRedirect() {
  const [redirect, setRedirect] = useState<RedirectPath | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Get the rehydration state from Zustand persist (only on mobile)
  const hasHydrated = Platform.OS !== "web" ? useTimetableStore.persist.hasHydrated() : true;
  const { timetable, rollNumber } = useTimetableStore();

  useEffect(() => {
    // On web, we manually rehydrate in the layout, so we can proceed immediately
    // On mobile, wait for Zustand to rehydrate from storage
    if (Platform.OS === "web" || hasHydrated) {
      // Check if we have a valid timetable and roll number
      if (timetable && Object.keys(timetable).length > 0 && rollNumber) {
        setRedirect(TIMETABLE);
      } else {
        setRedirect(ROLLINPUT);
      }
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [hasHydrated, timetable, rollNumber]);

  if (!redirect || !isReady) return null;
  return <Redirect href={redirect} />;
} 