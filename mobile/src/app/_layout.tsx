import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';
import { QueryProvider } from '@/lib/query-client';
import { NAV_THEME } from '@/lib/theme';
import '../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <KeyboardProvider>
        <ThemeProvider value={NAV_THEME}>
          <QueryProvider>
            <SafeAreaProvider className="flex-1">
              <BottomSheetModalProvider>
                <Stack screenOptions={{ headerShown: false }} />
                <PortalHost />
                <Toaster theme="dark" />
              </BottomSheetModalProvider>
            </SafeAreaProvider>
          </QueryProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

