import { Text } from "@/components/ui/text";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, TouchableWithoutFeedback } from "react-native";
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
    inputRef.current?.blur();
  };

  return (
    <ImageBackground
      source={require("@/assets/background.png")}
      className="flex-1 bg-black"
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={{flex:1}}
      >
      <TouchableWithoutFeedback onPress={handleTapOutside}>
        <SafeAreaView className="flex-1">
          <VStack className="flex-1">
            <Box className="flex-1 justify-center items-center">
              <Image
                source={require("@/assets/logo_fg.png")}
                className="w-4/5 h-[100px]"
                resizeMode="contain"
              />
            </Box>

            <Box className="bg-background-0 rounded-[15px] p-8 mx-4">
              <Image
                source={require("@/assets/logo_wbg.png")}
                className="w-[60px] h-[60px] self-center mb-5 rounded-lg"
                resizeMode="contain"
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
                    maxLength={8}
                    textAlign="center"
                    caretHidden={true}
                    keyboardType="numeric"
                    className="text-xl"
                    editable={!isLoading}
                    ref={inputRef}
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
        </SafeAreaView>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}