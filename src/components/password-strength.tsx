import CircleCheck from "lucide-react-native/icons/circle-check";
import { StyleSheet, Text, View } from "react-native";

import { passwordRules } from "@/api/v1/auth/validation";

const brandBlue = "#193caf";

export function PasswordStrength({ password }: { password: string }) {
  const passedRules = passwordRules.filter((rule) =>
    rule.test(password),
  ).length;
  const strength =
    password.length === 0
      ? { label: "", barColor: "#dedede", textColor: "#dedede" }
      : passedRules === passwordRules.length
        ? { label: "STRONG", barColor: "#9be89a", textColor: "#0E870E" }
        : passedRules >= 2
          ? { label: "MODERATE", barColor: "#fff0a6", textColor: "#FFC300" }
          : { label: "WEAK", barColor: "#ffc2c2", textColor: "#A61010" };

  return (
    <View>
      <View
        style={[styles.strengthBar, { backgroundColor: strength.barColor }]}
      />
      <Text style={[styles.strengthText, { color: strength.textColor }]}>
        {strength.label}
      </Text>
      <View style={styles.rules}>
        {passwordRules.map((rule) => {
          const passed = rule.test(password);
          return (
            <View key={rule.label} style={styles.ruleRow}>
              <CircleCheck
                color={passed ? "#ffffff" : "#b7b7b7"}
                size={12}
                fill={passed ? brandBlue : "transparent"}
              />
              <Text style={styles.ruleText}>{rule.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strengthBar: {
    height: 8,
    marginTop: 10,
    borderRadius: 2,
  },
  strengthText: {
    fontFamily: "Sora",
    fontSize: 7,
    fontWeight: "700",
    alignSelf: "flex-end",
    marginTop: 3,
  },
  rules: { gap: 4, marginTop: 10 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleText: { color: "#111111", fontFamily: "Sora", fontSize: 9 },
});
