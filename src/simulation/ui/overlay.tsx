import { expoDeviceSource } from "@/simulation/device-gps";
import { setRoadRouter } from "@/simulation/engine";
import { setDeviceLocationSource } from "@/simulation/gps";
import { mapboxRoadRouter } from "@/simulation/road-router";
import { DemoPanel } from "@/simulation/ui/demo-panel";
import { SimulationBanner } from "@/simulation/ui/simulation-banner";

setDeviceLocationSource(expoDeviceSource);
setRoadRouter(mapboxRoadRouter);

export function SimulationOverlay() {
  return (
    <>
      <SimulationBanner />
      <DemoPanel />
    </>
  );
}
