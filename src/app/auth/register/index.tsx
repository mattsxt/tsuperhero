import { Redirect } from "expo-router";

import { Routes } from "@/constants/routes";
import { isSimulation } from "@/simulation/flag";
import RegisterPage from "@/pages/auth/register/page";

export default function RegisterRoute() {
  return isSimulation() ? <Redirect href={Routes.login} /> : <RegisterPage />;
}
