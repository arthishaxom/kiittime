import { Redirect, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { useTimetableStore } from "~/store/timetableStore";

// Only allow the two possible redirect destinations
const TIMETABLE = "/timetable" as const;
const ROLLINPUT = "/rollinput" as const;
type RedirectPath = typeof TIMETABLE | typeof ROLLINPUT;

export default function IndexRedirect() {
  const [redirect, setRedirect] = useState<RedirectPath | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const { timetable, rollNumber } = useTimetableStore();

  useEffect(() => {
    // Check if we have a valid timetable and roll number
    if (timetable && Object.keys(timetable).length > 0 && rollNumber) {
      setRedirect(TIMETABLE);
    } else {
      setRedirect(ROLLINPUT);
    }
    setIsReady(true);
    SplashScreen.hideAsync();
  }, [timetable, rollNumber]);

  if (!redirect || !isReady) return null;
  return <Redirect href={redirect} />;
} 