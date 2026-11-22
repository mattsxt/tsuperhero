import Constants from "expo-constants";

export function isSimulation(): boolean {
  return Constants.expoConfig?.extra?.simulation === true;
}
