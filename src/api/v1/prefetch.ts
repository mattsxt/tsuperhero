<<<<<<< HEAD
=======
import { saveOfflineMap } from "@/api/v1/offline-map";
>>>>>>> origin/mapbox
import {
  loadMyTrips,
  loadOperatorAssignment,
} from "@/api/v1/operator/controllers";
import {
  loadActivePickup,
  loadBookings,
  loadTripHistory,
} from "@/api/v1/pickups/controllers";
import {
  loadHomeRoute,
  loadProfileSummary,
} from "@/api/v1/profile/controllers";
import { loadMyRatings } from "@/api/v1/ratings/controllers";
import {
  loadMyRentals,
  loadRentalRequests,
} from "@/api/v1/rentals/controllers";
import {
  findRoute,
  loadAlternativeGeometry,
  loadRouteGeometry,
  reloadTransitRoutes,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
import { loadWaitingAreas } from "@/api/v1/waiting-areas/controllers";
import { Routes } from "@/constants/routes";

async function saveRouteShapes(routes: TransitRoute[]) {
  for (const route of routes) {
    await loadRouteGeometry(route).catch(() => null);
    await loadAlternativeGeometry(route).catch(() => null);
  }
}

const refreshEveryMs = 10 * 60_000;
let preparing: Promise<void> | null = null;
let preparedAt = 0;

export function prepareOffline(): Promise<void> {
  if (preparing) return preparing;
  if (Date.now() - preparedAt < refreshEveryMs) return Promise.resolve();
  preparing = prepare()
    .then(() => {
      preparedAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      preparing = null;
    });
  return preparing;
}

export function resetOfflinePreparation() {
  preparedAt = 0;
}

async function prepare() {
  const home = await loadHomeRoute();
  if ("redirect" in home) return;

  const [routes] = await Promise.all([
    reloadTransitRoutes(),
    loadWaitingAreas(),
    loadProfileSummary(),
  ]);
<<<<<<< HEAD
=======
  if (routes.ok) saveOfflineMap(routes.data).catch(() => {});
>>>>>>> origin/mapbox

  if (home.homeRoute === Routes.commuterHome) {
    await Promise.allSettled([
      loadActivePickup(),
      loadBookings(),
      loadTripHistory(),
      loadMyRentals(),
    ]);
    if (routes.ok) await saveRouteShapes(routes.data);
    return;
  }

  const [assignment] = await Promise.all([
    loadOperatorAssignment(),
    loadMyTrips(),
    loadRentalRequests(),
    loadMyRatings(),
  ]);
  const route = findRoute(assignment?.routeId);
  if (route) await saveRouteShapes([route]);
}
