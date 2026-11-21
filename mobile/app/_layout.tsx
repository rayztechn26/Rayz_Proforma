import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../src/locale";
import { getRepo } from "../src/native";
export default function Layout() {
  let initialLanguage: "en" | "am" = "en";
  try {
    if (getRepo().setting("language") === "am") initialLanguage = "am";
  } catch {}
  return (
    <SafeAreaProvider>
      <LanguageProvider
        initialLanguage={initialLanguage}
        onChange={(language) => getRepo().setSetting("language", language)}
      >
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
