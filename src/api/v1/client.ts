import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

import { toUserMessage } from "@/api/v1/errors";

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

  client = supabase;
  return client;
}

export function getErrorMessage(error: unknown) {
  return toUserMessage(error);
}
