# Pickup Drop-off and Ride Journey: Design

Date: 2026-11-11
Status: Approved in chat, pending written-spec review

## Goal

When a commuter requests a pickup, they also choose where they want to be dropped off (point B). Both the pickup point (A) and B must be on a registered route. The commuter moves to the route; drivers never detour. Boarding no longer ends the commuter's trip. While riding, the commuter sees a minimal map of their trip from A to B with their live progress, similar to Grab's in-trip view. The ride ends when they reach B, either detected automatically or confirmed by the commuter.

Everything else in the existing Pickup module stays as it is.

## Decisions

| Topic | Decision |
|---|---|
| How the ride ends | Automatically when the position is within 50 m of B for 2 consecutive readings. The commuter can also tap "I've been dropped off" at any time. |
| Route binding | Detected from A and B: any registered route that passes within 500 m of both. If exactly one matches, it is selected. If several match, the commuter chooses. The request stores `route_id`. |
| Route direction | Routes are treated as two-way. A and B only need to be near the route; their order along it is not checked. |
| Snapping | A and B are moved to the nearest point on the matched route's path. Pins more than 500 m from every route are rejected. |
| Driver matching | A driver can see and accept a request only if their active `trip.route_id` equals `pickup.route_id`. Legacy requests with no `route_id` keep radius-only matching. |
| Shared rides | Companions share the requester's B and see the same ride screen. |
| Data model | Extend the existing `request` and `pickup` tables with a new `riding` status. No new trip table. |

## Lifecycle

```
draft → pending → (arrived_at set) → accepted → riding → completed
                                                   ↑         ↑
                                         board_pickup   complete_my_ride
                                                        (auto at B / manual)
                                                        or end_my_trip (driver)
```

## 1. Backend (Supabase)

### Schema migration

- `ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'riding';`
- Add these columns to `pickup` (all nullable, for legacy rows):
  - `route_id` (FK → `route.route_id`)
  - `pickup_lat`, `pickup_lng` (double precision): A after snapping to the route. The commuter's raw GPS position stays in `request.device_latitude` / `request.device_longitude`.
  - `dropoff_name` (text), `dropoff_lat`, `dropoff_lng` (double precision): B after snapping.
  - `boarded_at`, `dropped_at` (timestamptz)

### RPCs

- **`save_pickup_draft` / `publish_pickup_draft`**: accept `route_id`, the snapped A, and B (name, lat, lng). On publish, the server checks that A and B are each within 25 m of a segment of the route's `path` or one of its `alternative_paths`. If not, publish fails with a clear error. A plpgsql helper `point_to_path_meters(lat, lng, path jsonb)` does this check using the same flat-earth projection as `geo.ts`. Remember that `path` stores `[lat, lng]` pairs.
- **`get_my_nearby_pickups` / `accept_pickup_request`**: add the condition `(p.route_id IS NULL OR p.route_id = driver's active trip.route_id)`.
- **`board_pickup`**: set `request_status = 'riding'` and `pickup.boarded_at = now()` instead of `completed`. The `trip_history` insert and the `current_capacity` increment stay.
- **New `complete_my_ride(p_request_id)`**: security definer. Allowed only when the caller is the request's commuter and the status is `riding`. It sets `completed` and `dropped_at = now()`, and decrements the vehicle's `current_capacity` (floored at 0, recomputing `is_full`). Calling it on a request that is already completed returns success without changing anything, so a sync replayed from the offline queue is safe.
- **`end_my_trip` / `release_vehicle_pickups`**: also set every `riding` request on that vehicle to `completed` with `dropped_at = now()`.
- **New `get_my_ride_progress()`**: for the caller's `riding` request (as owner or companion), returns the request id, A, B, `dropoff_name`, `route_id` and route path, the driver's name and plate, and the vehicle's latest `location_records` position with its timestamp.
- **Notifications** (`notify_request_status`): `riding` sends "You're on board, heading to <B>". `completed` now fires at drop-off. `share_pickup_status` passes `riding` on to companions.

## 2. Commuter app

### Geometry utilities: `src/utils/geo.ts`

- `nearestPointOnPath(point, path)` returns `{ point, distanceMeters, segmentIndex, alongMeters }`.
- `pathLengthMeters(path)`, and `sliceAlong(path, fromAlong, toAlong)` for drawing the A→B section and the part already travelled.

### Route matching: `src/api/v1/transit-routes/controllers.ts`

- `matchRoutes(a, b, maxMeters = 500)` checks every route's `path` and `alternative_paths`. It returns the routes where both A and B are within `maxMeters`, each with snapped A, snapped B, walking distance to A, and the riding distance A→B. Results are sorted by walking distance plus riding distance.

### Request form: `src/pages/commuter/pickup/page.tsx`

- The existing steps for choosing A are unchanged.
- **New drop-off step** after A, using `PlaceSearchField` and `PinLocationPicker`:
  - **No match:** show the inline error "No registered route connects these points" and let the commuter adjust the pin.
  - **One match:** select it automatically.
  - **Several matches:** show a compact list, for example "Route 12 · walk 80 m to pickup".
  - **Preview map:** shows the route line, the commuter's original pin, snapped A with a dashed walking line to it, and snapped B. Note text: "Your pickup point was moved to the route so drivers can reach you."
- Vehicle and passengers, share ride, and confirm are unchanged. The request payload now also carries `route_id`, A, and B. The draft (`savePickupDraft`) keeps B so a resumed draft restores it.

### Waiting screen: `active-pickup.tsx`

- The arrival-radius check (`markPickupArrived`) and the "away" check use snapped A (`pickup_lat`, `pickup_lng`) when present, and fall back to `device_*`.

### New `ride-in-progress.tsx`

Shown when the request status is `riding`. `PickupScreen` checks for it in its priority order before `ActivePickup`.

- **Map** (`TransitMap`): the A→B section of the route. The part already travelled is greyed out and the rest highlighted. It shows A, B, and vehicle markers, and the map is fitted to the A→B section.
- **Bottom card:**
  - drop-off name;
  - progress bar (along-route distance travelled ÷ total A→B distance);
  - "x.x km left";
  - ETA, from the distance left at an assumed average of 18 km/h;
  - driver's name and plate;
  - an "I've been dropped off" button with a confirmation dialog.
- **Position source:** `get_my_ride_progress`, polled every 5 s. If the vehicle's location is missing or older than 30 s, the commuter's own GPS is used instead.
- **Auto-complete:** when the position is within 50 m of B for 2 readings in a row, call `completeMyRide`.
- **On completion:** show `BoardedScreen` with the title "You've arrived". "Done" goes to Bookings, as today.

### Offline

- `completeMyRide` is queued in the cache when the device is offline (`queueRideCompletion`), following the pattern of `queuePickupCancellation`. The queue is flushed when the device reconnects or the auth state changes. The UI shows the arrived state right away.
- Remove the existing automatic cancellation-on-offline for requests that are `riding`. Only `pending` requests can be cancelled anyway.

### Other status consumers

- `RequestStatus` type: add `riding`.
- `active-pickup-banner.tsx` and `use-pickup-status.ts` treat `riding` as active and show "On the way to <B>".
- Page polling (`page.tsx` lines 439-460): `riding` keeps the ride screen showing. Only `completed` leads to the arrived screen.
- `shared-ride.tsx`: a companion whose ride is `riding` sees `RideInProgress`.

### Driver app

No UI changes. The backend changes only affect which requests a driver can see (same route only) and what happens to riders when the driver ends the trip.

## Error handling

- **Publish rejected because A or B is not on the route:** show "Pickup point must be on the route. Please re-select." and send the commuter back to the drop-off step.
- **`get_my_ride_progress` fails or returns no vehicle:** keep the last known state, use the commuter's GPS, and show "Live vehicle location unavailable".
- **`complete_my_ride` returns not-riding** (for example, the driver already ended the trip): treat it as completed.

## Testing

- Unit tests for `nearestPointOnPath`:
  - a point on a segment;
  - a point beyond the ends of the path;
  - `alongMeters` increasing along the path.
- Unit tests for `matchRoutes`:
  - no match;
  - a single match;
  - multiple matches, sorted;
  - the 500 m boundary;
  - a match on `alternative_paths`.
- SQL checks (run against the project with test accounts):
  - board → `riding`, with capacity incremented;
  - `complete_my_ride` → `completed`, with capacity decremented; calling it again changes nothing;
  - a driver ending the trip completes the riders;
  - drivers on a different route do not see the request.
- Manual test on a device with one driver account and one commuter account:
  - request with an off-route pin;
  - board;
  - watch progress;
  - automatic completion at B;
  - manual completion;
  - commuter offline mid-ride.

## Out of scope

- Turn-by-turn walking navigation to A. A straight dashed line and the distance are shown.
- Fares based on A→B distance.
- Driver-side passenger drop-off list.
- Checking direction on one-way routes.
