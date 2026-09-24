import { Image, StyleSheet, Text, View } from "react-native";

type Variant = "badge" | "hero" | "splash";

export function BrandHeader({ variant }: { variant: Variant }) {
  const logo = (
    <Image
      source={require("@/assets/images/tsuperhero_icon.png")}
      style={logoStyles[variant]}
      resizeMode="contain"
    />
  );

  return (
    <View style={styles.container}>
      {variant === "badge" ? <View style={styles.badge}>{logo}</View> : logo}
      <Text style={[styles.wordmark, wordmarkStyles[variant]]}>TsuperHero</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  badge: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1034A6",
    borderRadius: 24,
  },
  wordmark: { fontFamily: "WDXLLubrifontSC" },
});

const logoStyles = StyleSheet.create({
  badge: { width: 78, height: 78 },
  hero: { width: 80, height: 80 },
  splash: { width: 54, height: 54, marginBottom: 30 },
});

const wordmarkStyles = StyleSheet.create({
  badge: { color: "#193caf", fontSize: 43, lineHeight: 49, marginTop: 14 },
  hero: { color: "#ffffff", fontSize: 60, lineHeight: 68, marginTop: 18 },
  splash: { color: "#ffffff", fontSize: 43, lineHeight: 52 },
});
