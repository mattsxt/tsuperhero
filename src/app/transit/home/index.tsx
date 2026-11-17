import { useEffect, useState } from "react";

import TransitHome from "@/pages/transit/home/page";
import { isSimulation } from "@/simulation/flag";

export default function TransitHomeRoute() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!isSimulation()) return;
    const { subscribeDemoRefresh } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/simulation/refresh") as typeof import("@/simulation/refresh");
    return subscribeDemoRefresh(() => setGeneration((value) => value + 1));
  }, []);
  return <TransitHome key={generation} />;
}
