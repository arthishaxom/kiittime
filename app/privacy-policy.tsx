import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Link } from "expo-router";
import React from "react";
import { Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-white text-2xl font-bold mt-6 mb-3">{children}</Text>
);

const SectionText = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-neutral-300 text-base leading-relaxed">{children}</Text>
);

const InfoPoint = ({ title, content }: { title: string; content: string }) => (
    <SectionText>
        <Text className="font-bold text-neutral-200">{title}:</Text> {content}
    </SectionText>
);

export default function PrivacyPolicyPage() {
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
      className="flex-1"
        contentContainerStyle={isWeb ? { alignItems: 'center' } : { paddingHorizontal: 16, paddingVertical: 24 }}
      >
        <VStack className="px-8" style={isWeb ? { width: '100%', maxWidth: 800, paddingVertical: 100, margin: 80, paddingHorizontal: 20 } : {}}>
          <Text className="text-white text-4xl font-bold text-center mb-4">
            Privacy Policy for KIIT TIME
          </Text>
          <Text className="text-neutral-400 text-base text-center mb-8">
            Effective Date: January 14, 2025
          </Text>

          <SectionTitle>1. Introduction</SectionTitle>
          <SectionText>
            Welcome to KIIT TIME, a timetable application designed for KIIT students. We prioritize your privacy and are committed to safeguarding your personal information. This Privacy Policy outlines how we collect, use, and protect your data when you use our app.
          </SectionText>

          <SectionTitle>2. Information We Collect</SectionTitle>
          <InfoPoint title="Personal Information" content="We collect your roll number to retrieve and display your specific timetable." />
          <InfoPoint title="Usage Data" content="We collect information on how you interact with the app to improve our services." />

          <SectionTitle>3. Use of Information</SectionTitle>
          <InfoPoint title="Timetable Retrieval" content="Your roll number is used to fetch your timetable from our backend services." />
          <InfoPoint title="App Improvement" content="Usage data helps us enhance app performance and user experience." />

          <SectionTitle>4. Data Storage and Security</SectionTitle>
          <InfoPoint title="Local Storage" content="Your timetable is stored locally on your device to ensure access without an internet connection." />

          <SectionTitle>5. Third-Party Services</SectionTitle>
          <InfoPoint title="Supabase" content="We use Supabase for backend services, which may collect data as per their privacy policies." />

          <SectionTitle>6. User Rights</SectionTitle>
          <InfoPoint title="Access and Correction" content="You can access and update your personal information within the app." />
          <InfoPoint title="Data Deletion" content="You can request the deletion of your data by contacting us." />

          <SectionTitle>7. Changes to This Privacy Policy</SectionTitle>
          <SectionText>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
          </SectionText>

          <SectionTitle>8. Contact Us</SectionTitle>
          <SectionText>
            If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at{' '}
            <Link href="mailto:pothal.builds@gmail.com">
              <Text className="text-orange-500 underline">
                pothal.builds@gmail.com
              </Text>
            </Link>
            .
          </SectionText>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
} 