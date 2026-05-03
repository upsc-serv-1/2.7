import { auth, assertSupabaseReady } from "../supabase-config.js";

function mapUser(user) {
    return user ? { ...user, uid: user.id } : null;
}

export function onUserChanged(_auth, callback) {
    if (!auth) {
        callback(null);
        return () => {};
    }

    // Supabase emits the current session through onAuthStateChange as well.
    // Using getSession() here can race with a fresh sign-in and overwrite
    // the logged-in user with an older null session.
    const { data } = auth.onAuthStateChange((_event, session) => {
        callback(mapUser(session?.user || null));
    });

    return () => data.subscription.unsubscribe();
}

export async function signInWithEmailPassword(_auth, email, password) {
    const client = assertSupabaseReady();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: mapUser(data.user) };
}

export async function signUpWithEmailPassword(_auth, email, password) {
    const client = assertSupabaseReady();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return { user: mapUser(data.user) };
}

export async function sendPasswordReset(_auth, email) {
    const client = assertSupabaseReady();
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) throw error;
}

export async function updateCurrentUserPassword(_auth, password) {
    const client = assertSupabaseReady();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
}

export async function ensureSignedOut(_auth) {
    const client = assertSupabaseReady();
    const { error } = await client.auth.signOut();
    if (error) throw error;
}
