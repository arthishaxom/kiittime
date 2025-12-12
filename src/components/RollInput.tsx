import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
	ActivityIndicator,
	type NativeSyntheticEvent,
	Platform,
} from "react-native";
import { Button } from "~/src/components/ui/button";
import { Input, InputField } from "~/src/components/ui/input";
import { Text } from "~/src/components/ui/text";
import { VStack } from "~/src/components/ui/vstack";

interface RollInputProps {
	isLoading: boolean;
	onValidSubmit: (rollNumber: string) => void;
}

export interface RollInputHandle {
	blurInput: () => void;
}

export const RollInput = forwardRef<RollInputHandle, RollInputProps>(
	({ isLoading, onValidSubmit }, ref) => {
		const [rollNumber, setRollNumber] = useState("");
		// biome-ignore lint/suspicious/noExplicitAny: No Other Option, GLuestack InputField ref doesn't accept TextInput
		const inputRef = useRef<any>(null);

		useImperativeHandle(ref, () => ({
			blurInput: () => {
				inputRef.current?.blur();
			},
		}));

		const handleChange = (text: string) => {
			setRollNumber(text);
		};

		const handleSubmit = () => {
			if (rollNumber.length > 6) {
				onValidSubmit(rollNumber);
			}
		};

		// biome-ignore lint/suspicious/noExplicitAny: Event
		const handleKeyPress = (event: NativeSyntheticEvent<any>) => {
			if (Platform.OS === "web" && event.nativeEvent.key === "Enter") {
				handleSubmit();
			}
		};

		return (
			<VStack className="w-full">
				<Input
					variant="outline"
					size="md"
					isDisabled={isLoading}
					isInvalid={rollNumber.length > 0 && rollNumber.length < 7}
					isReadOnly={false}
					className="mb-4 mt-2 rounded-lg h-16 border-background-50"
				>
					<InputField
						placeholder="Enter your roll"
						value={rollNumber}
						onChangeText={handleChange}
						onKeyPress={handleKeyPress}
						maxLength={10}
						textAlign="center"
						caretHidden={Platform.OS !== "web"}
						keyboardType={Platform.OS === "web" ? "default" : "numeric"}
						inputMode={Platform.OS === "web" ? "numeric" : undefined}
						className="text-xl"
						editable={!isLoading}
						ref={inputRef}
						style={
							Platform.OS === "web"
								? {
										outline: "none",
										fontSize: 20,
										textAlign: "center",
									}
								: {}
						}
					/>
				</Input>
				<Button
					size="lg"
					onPress={handleSubmit}
					disabled={rollNumber.length < 7 || isLoading}
					variant="solid"
					className={`h-16 rounded-lg bg-orange-500 ${
						isLoading || rollNumber.length < 7 ? "opacity-50" : ""
					} mt-2`}
				>
					{isLoading ? (
						<ActivityIndicator
							size="small"
							color="#ffffff"
						/>
					) : (
						<Text className="text-white text-base">Submit</Text>
					)}
				</Button>
			</VStack>
		);
	},
);
