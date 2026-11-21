import { Text, TextInput } from "./typography";
import React, { useState } from "react";
import { Modal, View, Pressable, ScrollView } from "react-native";
import { useLocale } from "./locale";
import { commonUnits } from "./units";

export function UnitSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const select = (unit: string) => { onChange(unit); setOpen(false); setSearch(""); };
  return <View style={{ marginBottom: 15 }}>
    <Text style={{ fontWeight: "700", color: "#173e4a", marginBottom: 8 }}>{t("Unit (optional)")}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t("Choose unit")} onPress={() => setOpen(true)} style={{ borderWidth: 1, borderColor: "#bdced1", borderRadius: 12, padding: 10, minHeight: 44 }}>
      <Text style={{ color: "#173e4a" }}>{value || t("Choose unit")} ▾</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "#0008", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, maxHeight: "85%" }}>
          <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 12 }}>{t("Choose unit")}</Text>
          <TextInput accessibilityLabel={t("Search units")} placeholder={t("Search units")} value={search} onChangeText={setSearch} style={{ borderWidth: 1, borderColor: "#bdced1", padding: 12, borderRadius: 10, marginBottom: 8 }} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => select("")} style={{ paddingVertical: 11, minHeight: 44 }}><Text>{t("No unit")}</Text></Pressable>
            {!!value && !commonUnits.some(([code]) => code === value) && <Pressable onPress={() => select(value)} style={{ paddingVertical: 11, minHeight: 44 }}><Text>{value}</Text></Pressable>}
            {commonUnits.filter(([code, name]) => `${code} ${name} ${t(name)}`.toLowerCase().includes(search.toLowerCase())).map(([code, name]) => <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: value === code }} onPress={() => select(code)} style={{ paddingVertical: 11, minHeight: 44, borderBottomWidth: 1, borderBottomColor: "#e9f1ee" }}><Text style={{ color: "#173e4a" }}>{code} — {t(name)}</Text></Pressable>)}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ paddingTop: 18 }}><Text style={{ color: "#117568", fontWeight: "700" }}>{t("Cancel")}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
