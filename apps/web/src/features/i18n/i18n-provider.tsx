// English-only stand-in for the removed internationalization feature.
export type Language = "en" | "am"

const english = {
  language: "en" as Language,
  setLanguage: (_language: Language) => {},
  t: (text: string) => text,
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return children
}

export function useI18n() {
  return english
}
