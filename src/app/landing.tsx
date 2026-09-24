import { useFonts } from "expo-font";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

const backgroundColor = "#1b3caf";

export default function LandingScreen() {
  const [fontsLoaded] = useFonts({
    WDXLLubrifontSC: require("../../assets/fonts/WDXLLubrifontSC.ttf"),
  });
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          router.replace("/login");
        }
      });
    }, 2500);

    return () => clearTimeout(fadeTimer);
  }, [fontsLoaded, opacity]);

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  return (
    <Animated.View style={[styles.screen, { opacity }]}>
      <Image
        source={require("../../assets/images/tsuperhero_icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.wordmark}>TsuperHero</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor,
  },
  logo: {
    width: 54,
    height: 54,
    marginBottom: 30,
  },
  wordmark: {
    color: "#ffffff",
    fontFamily: "WDXLLubrifontSC",
    fontSize: 43,
    lineHeight: 52,
  },
});
