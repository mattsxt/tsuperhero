import { Redirect } from "expo-router";

import { Routes } from "@/constants/routes";

export default function HomeScreen() {
  return <Redirect href={Routes.landing} />;
}
