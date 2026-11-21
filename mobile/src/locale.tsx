import React, { createContext, useCallback, useContext, useState } from "react";
import { Language, translate } from "./i18n";
type Locale = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (value: string) => string;
};
const Context = createContext<Locale>({
  language: "en",
  setLanguage: () => {},
  t: (v) => v,
});
export function LanguageProvider({
  children,
  initialLanguage = "en",
  onChange,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
  onChange?: (language: Language) => void;
}) {
  const [language, setValue] = useState(initialLanguage);
  const setLanguage = useCallback(
    (next: Language) => {
      setValue(next);
      onChange?.(next);
    },
    [onChange],
  );
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        t: (value) => translate(value, language),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLocale = () => useContext(Context);
