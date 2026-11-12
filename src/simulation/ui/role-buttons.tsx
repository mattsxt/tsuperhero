import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { login } from "@/api/v1/auth/controllers";
import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";
import { DEMO_PASSWORD } from "@/simulation/auth";

const roles = [
  { label: "Continue as Commuter", email: "juan@demo.tsuperhero" },
  { label: "Continue as Driver", email: "mario@demo.tsuperhero" },
];

export function RoleButtons() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async (email: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await login(email, DEMO_PASSWORD);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.replace(result.data as Parameters<typeof router.replace>[0]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>DEMO: PICK WHO YOU ARE</Text>
      {roles.map((role) => (
        <Pressable
          key={role.email}
          accessibilityRole="button"
          accessibilityLabel={role.label}
          disabled={busy}
          onPress={() => void choose(role.email)}
          style={({ pressed }) => [
            styles.button,
            (pressed || busy) && styles.dim,
          ]}
        >
          <Text style={styles.buttonText}>{role.label.toUpperCase()}</Text>
        </Pressable>
      ))}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 320, gap: 10, marginTop: 16 },
  heading: {
    color: moduleColors.mutedText,
    fontFamily: "SoraBold",
    fontSize: 11,
    textAlign: "center",
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.brand,
    borderRadius: 12,
  },
  dim: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 13 },
  error: {
    color: palette.danger,
    fontFamily: "Sora",
    fontSize: 11,
    textAlign: "center",
  },
});
