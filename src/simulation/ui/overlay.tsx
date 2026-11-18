import { expoDeviceSource } from "@/simulation/device-gps";
import { setRoadRouter } from "@/simulation/engine";
import { setDeviceLocationSource } from "@/simulation/gps";
import { mapboxRoadRouter } from "@/simulation/road-router";
import { DemoPanel } from "@/simulation/ui/demo-panel";

setDeviceLocationSource(expoDeviceSource);
setRoadRouter(mapboxRoadRouter);

export function SimulationOverlay() {
  return <DemoPanel />;
}
