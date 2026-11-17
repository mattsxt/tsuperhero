import { useEffect, useState } from "react";

import PickupPage from "@/pages/commuter/pickup/page";
import { isSimulation } from "@/simulation/flag";

export default function PickupRoute() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!isSimulation()) return;
    const { subscribeDemoRides } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/simulation/engine") as typeof import("@/simulation/engine");
    return subscribeDemoRides(() => setGeneration((value) => value + 1));
  }, []);
  return <PickupPage key={generation} />;
}
