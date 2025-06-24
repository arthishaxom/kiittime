import { useFonts as useExpoFonts } from 'expo-font';

export default function useFonts() {
  const [fontsLoaded] = useExpoFonts({
    'SpaceMono': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  return fontsLoaded;
} 