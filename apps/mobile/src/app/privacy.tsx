import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, View } from 'react-native';

export default function PrivacyRoute() {
  const router = useRouter();

  useEffect(() => {
    WebBrowser.openBrowserAsync('https://kiittime.apothal.dev/privacy').finally(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    });
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#f57c00" size="large" />
    </View>
  );
}
