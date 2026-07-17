import Constants from 'expo-constants';
import { Image, Linking, Pressable, View } from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-sheet border-border">
        <DialogHeader>
          <DialogTitle className="text-text text-center text-xl">About KIIT Time</DialogTitle>
        </DialogHeader>

        <View className="items-center gap-4">
          <Image
            source={require('@/assets/images/logo_fg.png')}
            className="h-16 w-40"
            resizeMode="contain"
          />

          <Text className="text-text font-medium">v{Constants.expoConfig?.version}</Text>

          <View className="items-center gap-2">
            <View className="flex-row flex-wrap items-center justify-center gap-1">
              <Text className="text-text">Made by</Text>
              <Pressable onPress={() => Linking.openURL('https://www.linkedin.com/in/ashish-pothal/')}>
                <Text className="text-brand underline">Ashish Pothal</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => Linking.openURL('https://github.com/arthishaxom/kiittime')}>
              <Text className="text-brand underline">GitHub</Text>
            </Pressable>
          </View>

          <Text className="text-text-muted text-sm">MIT License</Text>
        </View>
      </DialogContent>
    </Dialog>
  );
}
