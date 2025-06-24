import { Text } from "@/components/ui/text";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, Platform, TouchableWithoutFeedback, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Input, InputField } from "~/components/ui/input";
import { useTimetableStore } from "~/store/timetableStore";
import { Box } from "./ui/box";
import { VStack } from "./ui/vstack";

export default function RollInputPage() {
  const [rollNumber, setRollNumber] = useState("");
  const { isLoading, error, fetchTimetable, setRollNumber: setStoreRollNumber } = useTimetableStore();
  const inputRef = useRef<any>(null);

  const handleChange = (text: string) => {
    setRollNumber(text);
  };

  const handleSubmit = async () => {
    if (rollNumber.length > 6) {
      await setStoreRollNumber(rollNumber);
      await fetchTimetable(rollNumber);
      if (!error) {
        router.replace("/timetable");
      }
    }
  };

  const handleTapOutside = () => {
    if (Platform.OS === 'web') {
      inputRef.current?.blur();
    } else {
      inputRef.current?.blur();
    }
  };

  // Web-specific keyboard handling
  const handleKeyPress = (event: any) => {
    if (Platform.OS === 'web' && event.nativeEvent.key === 'Enter') {
      handleSubmit();
    }
  };

  // Main content (shared between web and mobile)
  const MainContent = (
    <VStack className="flex-1">
      <Box className="flex-1 justify-center items-center"
        style={Platform.OS === 'web' ? {
          height: 400,
        } : {}}
      >
        <Image
          source={require("@/assets/logo_fg.png")}
          className="w-4/5 h-[100px]"
          resizeMode="contain"
          style={Platform.OS === 'web' ? {
            maxWidth: '80%',
            height: 100,
            objectFit: 'contain'
          } : {}}
        />
      </Box>

      <Box className="bg-background-0 rounded-[15px] p-8 mx-4" 
           style={Platform.OS === 'web' ? { 
             maxWidth: 400, 
             alignSelf: 'center',
             width: '90%'
           } : {}}>
        <Image
          source={require("@/assets/logo_wbg.png")}
          className="w-[60px] h-[60px] self-center mb-5 rounded-lg"
          resizeMode="contain"
          style={Platform.OS === 'web' ? {
            width: 60,
            height: 60,
            objectFit: 'contain',
            borderRadius: 8
          } : {}}
        />

        <VStack className="w-full">
          <Text className="mb-2 text-neutral-100">Enter Roll Number</Text>
          <Input
            variant="outline"
            size="md"
            isDisabled={isLoading}
            isInvalid={rollNumber.length > 0 && rollNumber.length < 7}
            isReadOnly={false}
            className="mb-4 rounded-lg h-16 border-background-50"
          >
            <InputField
              placeholder="Enter your roll"
              value={rollNumber}
              onChangeText={handleChange}
              onKeyPress={handleKeyPress}
              maxLength={8}
              textAlign="center"
              caretHidden={false}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
              inputMode={Platform.OS === 'web' ? 'numeric' : undefined}
              className="text-xl"
              editable={!isLoading}
              ref={inputRef}
              style={Platform.OS === 'web' ? {
                outline: 'none',
                fontSize: 20,
                textAlign: 'center'
              } : {}}
            />
          </Input>
          <Button
            size="lg"
            onPress={handleSubmit}
            disabled={rollNumber.length < 7 || isLoading}
            variant="solid"
            className={`h-16 rounded-lg bg-orange-500 ${isLoading || rollNumber.length < 7 ? "opacity-50" : ""} mt-2`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white text-base">Submit</Text>
            )}
          </Button>

          {error && (
            <Text className="text-red-500 mt-2 text-center">
              {error.message || "An error occurred while fetching your timetable"}
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  );

  if (Platform.OS === 'web') {
    // Web: No ImageBackground, KeyboardAvoidingView, or TouchableWithoutFeedback
    return (
      <View
        className="flex-1 bg-black"
        // style={{ minHeight: '100vh' as any }}
      >
        <SafeAreaView className="flex-1" style={{ minHeight: 1 }}>
          {MainContent}
        </SafeAreaView>
      </View>
    );
  }

  // Mobile: Original behavior
  return (
    <ImageBackground
      source={require("@/assets/background.png")}
      className="flex-1 bg-black"
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={handleTapOutside}>
          <SafeAreaView className="flex-1">
            {MainContent}
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}