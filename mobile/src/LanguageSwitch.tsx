import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./typography";
import { useLocale } from "./locale";

export function LanguageSwitch() {
  const { language, setLanguage } = useLocale();
  return <View style={{ flexDirection: "row", backgroundColor: "#eaf0ee", borderRadius: 9, padding: 2 }}>
    {(["en", "am"] as const).map((code) => <Pressable key={code} accessibilityRole="button" accessibilityLabel={code === "en" ? "English" : "አማርኛ"} accessibilityState={{ selected: code === language }} onPress={() => setLanguage(code)} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 7, backgroundColor: code === language ? "#117568" : "transparent", paddingHorizontal: 7 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: code === language ? "white" : "#254c50" }}>{code === "en" ? "EN" : "አማ"}</Text>
    </Pressable>)}
  </View>;
}
