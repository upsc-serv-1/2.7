const STORAGE_KEY = "upsc_vault_test_theme_preset";
const LEGACY_STORAGE_KEY = "upsc_vault_test_theme";
const DEFAULT_PRESET = "classic";
const VALID_PRESETS = new Set(["classic", "nature-calm", "calm-modern", "serene-sand", "korean-cuteness", "medical-rounds", "gujarati-foodie"]);

export function applyThemePreference() {
    const html = document.documentElement;
    const savedPreset = localStorage.getItem(STORAGE_KEY);
    const legacyTheme = localStorage.getItem(LEGACY_STORAGE_KEY);
    const preset = VALID_PRESETS.has(savedPreset)
        ? savedPreset
        : legacyTheme === "dark"
            ? "calm-modern"
            : DEFAULT_PRESET;
    html.dataset.themePreset = preset;
    html.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, preset);
    return preset;
}

export function getThemePreset() {
    return document.documentElement.dataset.themePreset || DEFAULT_PRESET;
}

export function setThemePreset(preset) {
    const nextPreset = VALID_PRESETS.has(preset) ? preset : DEFAULT_PRESET;
    document.documentElement.dataset.themePreset = nextPreset;
    document.documentElement.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, nextPreset);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return nextPreset;
}
