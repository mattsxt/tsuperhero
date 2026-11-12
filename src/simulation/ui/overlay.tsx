import { DemoPanel } from "@/simulation/ui/demo-panel";
import { SimulationBanner } from "@/simulation/ui/simulation-banner";

export function SimulationOverlay() {
  return (
    <>
      <SimulationBanner />
      <DemoPanel />
    </>
  );
}
