import { expoDeviceSource } from "@/simulation/device-gps";
import { setRoadRouter, setWalkRouter } from "@/simulation/engine";
import { setDeviceLocationSource } from "@/simulation/gps";
import { mapboxRoadRouter, mapboxWalkRouter } from "@/simulation/road-router";
import { DemoPanel } from "@/simulation/ui/demo-panel";

setDeviceLocationSource(expoDeviceSource);
setRoadRouter(mapboxRoadRouter);
setWalkRouter(mapboxWalkRouter);

export function SimulationOverlay() {
  return <DemoPanel />;
}
