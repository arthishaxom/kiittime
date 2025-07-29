import { router } from "expo-router";
import { ArrowLeftRight } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RollInputSection,
  type RollInputSectionHandle,
} from "@/components/RollInputSection";
import SectionSelector from "@/components/SectionSelector";
import { Box } from "~/components/ui/box";
import { HStack } from "~/components/ui/hstack";
import { Text } from "~/components/ui/text";
import { VStack } from "~/components/ui/vstack";
import { useTimetableStore } from "~/store/timetableStore";

export default function RollInputScreen() {
  const [inputType, setInputType] = useState<"roll" | "section">("roll");
  const {
    isLoading,
    fetchTimetable,
    setRollNumber: setStoreRollNumber,
    fetchTimetableBySections,
  } = useTimetableStore();

  const rollInputRef = useRef<RollInputSectionHandle>(null);

  const handleValidSubmitRoll = async (rollNumber: string) => {
    await setStoreRollNumber(rollNumber);
    await fetchTimetable(rollNumber);
    const currentError = useTimetableStore.getState().error;
    if (!currentError) {
      router.replace("/timetable");
    } else {
      router.push("/not-found");
    }
  };

  const handleValidSubmitSections = async (
    sections: string[],
    academic_year: string
  ) => {
    await fetchTimetableBySections(sections, academic_year);
    const currentError = useTimetableStore.getState().error;
    if (!currentError) {
      router.replace("/timetable");
    } else {
      router.push("/not-found");
    }
  };

  const handleTapOutside = () => {
    if (inputType === "roll") {
      rollInputRef.current?.blurInput();
    }
  };

  // Main content (shared between web and mobile)
  const MainContent = (
    <VStack className="flex-1">
      <Box
        className="flex-1 justify-center items-center"
        style={
          Platform.OS === "web"
            ? {
                height: 400,
              }
            : {}
        }
      >
        <Image
          source={require("@/assets/logo_fg.png")}
          className="w-4/5 h-[100px]"
          resizeMode="contain"
          style={
            Platform.OS === "web"
              ? {
                  maxWidth: "80%",
                  height: 100,
                  objectFit: "contain",
                }
              : {}
          }
        />
      </Box>

      <Box
        className="bg-background-0 rounded-[15px] p-8 mx-4"
        style={
          Platform.OS === "web"
            ? {
                maxWidth: 400,
                alignSelf: "center",
                width: "90%",
              }
            : {}
        }
      >
        {/* <Image
          source={require("@/assets/logo_wbg.png")}
          className="w-[60px] h-[60px] self-center mb-5 rounded-lg"
          resizeMode="contain"
          style={
            Platform.OS === "web"
              ? {
                  width: 60,
                  height: 60,
                  objectFit: "contain",
                  borderRadius: 8,
                }
              : {}
          }
        /> */}

        <HStack className="justify-between items-center mb-2">
          <Text className="text-neutral-100 font-semibold text-lg">
            {inputType === "roll" ? "Find by Roll Number" : "Find by Section"}
          </Text>
          <Pressable
            onPress={() =>
              setInputType(inputType === "roll" ? "section" : "roll")
            }
            className="p-1"
          >
            <ArrowLeftRight size={18} color="#F57C00" />
          </Pressable>
        </HStack>

        {inputType === "roll" ? (
          <RollInputSection
            ref={rollInputRef}
            isLoading={isLoading}
            onValidSubmit={handleValidSubmitRoll}
          />
        ) : (
          <SectionSelector
            onSubmit={handleValidSubmitSections}
            isLoading={isLoading}
          />
        )}
      </Box>
    </VStack>
  );

  if (Platform.OS === "web") {
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
      {inputType === "roll" ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={handleTapOutside}>
            <SafeAreaView className="flex-1">{MainContent}</SafeAreaView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      ) : (
        <TouchableWithoutFeedback onPress={handleTapOutside}>
          <SafeAreaView className="flex-1">{MainContent}</SafeAreaView>
        </TouchableWithoutFeedback>
      )}
    </ImageBackground>
  );
}
