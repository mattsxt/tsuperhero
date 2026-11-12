import { miscHandlers } from "@/simulation/rpc/misc";
import { operatorHandlers } from "@/simulation/rpc/operator";
import { pickupHandlers } from "@/simulation/rpc/pickups";
import { rentalHandlers } from "@/simulation/rpc/rentals";

export const handlers: Record<string, (args: any) => unknown> = {
  ...pickupHandlers,
  ...operatorHandlers,
  ...rentalHandlers,
  ...miscHandlers,
};
