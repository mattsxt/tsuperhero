import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

import { toUserMessage } from "@/api/v1/errors";
import { isOnline, subscribeToOnline } from "@/hooks/use-online";

let client: SupabaseClient | undefined;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  const { supabaseUrl, supabasePublishableKey } =
    Constants.expoConfig?.extra ?? {};

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  if (Platform.OS !== "web") {
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
  }

  subscribeToOnline(() => {
    if (!isOnline()) return;
    supabase.auth.startAutoRefresh();
    void supabase.auth.getSession().catch(() => null);
  });

  client = supabase;
  return client;
}

let refreshing: Promise<boolean> | null = null;

export function refreshExpiredSession(): Promise<boolean> {
  refreshing ??= getSupabaseClient()
    .auth.refreshSession()
    .then(({ data, error }) => !error && !!data.session)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function getErrorMessage(error: unknown) {
  return toUserMessage(error);
}
