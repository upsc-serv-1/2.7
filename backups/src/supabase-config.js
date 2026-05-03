import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const STORAGE_PREFIX = "upsc-vault-test-v1:supabase";

function readConfigValue(globalKey, storageKey) {
    if (typeof window === "undefined") return "";
    const fromWindow = typeof window[globalKey] === "string" ? window[globalKey].trim() : "";
    if (fromWindow) return fromWindow;
    try {
        return localStorage.getItem(storageKey)?.trim() || "";
    } catch {
        return "";
    }
}

export const supabaseProjectConfig = {
    url: readConfigValue("__SUPABASE_URL__", `${STORAGE_PREFIX}:url`) || "https://somczqfsmrjnxuqhffip.supabase.co",
    anonKey: readConfigValue("__SUPABASE_ANON_KEY__", `${STORAGE_PREFIX}:anon-key`) || "sb_publishable_fDr27NELNgyZB4CoqjyJEg_4ZeRTr2F"
};

export const supabaseReady = Boolean(supabaseProjectConfig.url && supabaseProjectConfig.anonKey);

export const supabase = supabaseReady
    ? createClient(supabaseProjectConfig.url, supabaseProjectConfig.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })
    : null;

export const auth = supabase?.auth ?? null;

export function assertSupabaseReady() {
    if (supabase) return supabase;
    throw new Error("Supabase is not configured yet. Add your project URL and anon key first.");
}
