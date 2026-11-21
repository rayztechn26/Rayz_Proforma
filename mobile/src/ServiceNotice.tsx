import React, { useState, useEffect } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./typography";
import { useLocale } from "./locale";

export function ServiceNotice({ message }: { message: string }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [message]);
  const metadata = message.match(/\s\((?:GET|POST|PUT|PATCH|DELETE) \/api[^]*\)$/)?.[0] || "";
  const summary = metadata ? message.slice(0, -metadata.length) : message;
  return <View style={{ borderWidth: 1, borderColor: "#dfcdb5", backgroundColor: "#fff8eb", borderRadius: 10, padding: 12, gap: 4 }}>
    <Text accessibilityRole="alert" style={{ fontSize: 13, lineHeight: 21, color: "#6c4722" }}>{t(summary)}</Text>
    {!!metadata && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ color: "#117568", fontSize: 12, fontWeight: "600" }}>{t(expanded ? "Hide technical details" : "Show technical details")}</Text></Pressable>}
    {expanded && <Text selectable style={{ fontSize: 11, lineHeight: 18, color: "#52666a" }}>{metadata.trim()}</Text>}
  </View>;
}
