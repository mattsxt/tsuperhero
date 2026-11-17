import { useEffect, useState } from "react";

import VehiclesPage from "@/pages/profile/vehicles/page";
import { isSimulation } from "@/simulation/flag";

export default function VehiclesRoute() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!isSimulation()) return;
    const { subscribeDemoRefresh } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/simulation/refresh") as typeof import("@/simulation/refresh");
    return subscribeDemoRefresh(() => setGeneration((value) => value + 1));
  }, []);
  return <VehiclesPage key={generation} />;
}
