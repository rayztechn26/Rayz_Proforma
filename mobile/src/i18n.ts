import am from "./am.json";
import activationAm from "./activation-am.json";
export type Language = "en" | "am";
export function translate(value: string, language: Language): string {
  if (language === "en") return value.replace(/\\n/g, "\n");
  const leading = value.match(/^\s*/)?.[0] || "",
    trailing = value.match(/\s*$/)?.[0] || "";
  const key = value.trim();
  const translated =
    (activationAm as Record<string, string>)[key] ||
    (am as Record<string, string>)[key];
  return translated ? leading + translated + trailing : value;
}
