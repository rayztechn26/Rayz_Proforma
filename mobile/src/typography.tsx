import React from "react";
import { Platform, Text as NativeText, TextInput as NativeInput, TextProps, TextInputProps } from "react-native";
import { useLocale } from "./locale";

const ethiopic = /[\u1200-\u137f\u2d80-\u2ddf\uab00-\uab2f]/;
function containsEthiopic(value: React.ReactNode): boolean {
  return typeof value === "string" ? ethiopic.test(value) : Array.isArray(value) ? value.some(containsEthiopic) : false;
}
export const Text = React.forwardRef<React.ElementRef<typeof NativeText>, TextProps>(({ style, children, ...props }, ref) => {
  const { language } = useLocale();
  return <NativeText ref={ref} {...props} style={[{ fontFamily: language === "am" || containsEthiopic(children) ? "AppEthiopic" : "AppSans" }, style]}>{children}</NativeText>;
});
export const TextInput = React.forwardRef<React.ElementRef<typeof NativeInput>, TextInputProps>(({ style, ...props }, ref) => {
  const { language } = useLocale();
  return <NativeInput ref={ref} {...props} style={[{ fontFamily: language === "am" || ethiopic.test(props.value || props.placeholder || "") ? "AppEthiopic" : "AppSans" }, style, props.secureTextEntry && { fontFamily: Platform.OS === "android" ? "sans-serif" : undefined }]} />;
});
