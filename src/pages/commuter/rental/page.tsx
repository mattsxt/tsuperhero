import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flag from "lucide-react-native/icons/flag";
import Megaphone from "lucide-react-native/icons/megaphone";
import PersonStanding from "lucide-react-native/icons/person-standing";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Users from "lucide-react-native/icons/users";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniToast, type MiniToastMessage } from "@/components/mini-toast";
import { useStatusBarTop } from "@/hooks/use-status-bar-top";

import type { Place } from "@/api/v1/places/controllers";
import {
  loadActivePickup,
  loadMySharedRide,
} from "@/api/v1/pickups/controllers";
import {
  activeRentalOf,
  cancelRental,
  combineDateTime,
  completeRental,
  removeRentalDriver,
  formatRentalTime,
  loadMyRentals,
  postRental,
  fleetSize,
  type Fleet,
  type Rental,
  type RentalTrip,
  type TripType,
} from "@/api/v1/rentals/controllers";
import { DateTimeField } from "@/components/date-time-field";
import {
  Chip,
  FieldLabel,
  ModuleButton,
  ModuleHeader,
  moduleColors,
  PassengerStepper,
  SectionTitle,
  SoftField,
} from "@/components/module-ui";
import { ConnectionRequired } from "@/components/connection-required";
import { ErrorAlert, ErrorOutline } from "@/components/error-alert";
import { PlaceSearchField } from "@/components/place-search-field";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { checkOnline, useOnline } from "@/hooks/use-online";
import { usePolling } from "@/hooks/use-polling";
import {
  getNotifications,
  subscribeToNotifications,
} from "@/api/v1/notifications/controllers";
import { SkeletonCards } from "@/components/skeleton";
import { palette } from "@/constants/colors";

import { RateDriversModal } from "@/components/rate-drivers-modal";

import { ActiveRental } from "./active-rental";
import { FleetPicker, fleetLabel, fleetSeats, maxFleet } from "./fleet-picker";

const { brandBlue, softBlue, text, error } = moduleColors;

type Step = 1 | 2;

const stepTitles = ["Trip details", "Vehicle & post"];

const emptyFleet: Fleet = { van: 0, jeep: 0, bus: 0, tricy: 0 };
const startingFleet: Fleet = { ...emptyFleet };

const occasions = [
  "Family Trip",
  "Outing",
  "Field Trip",
  "Wedding",
  "Company Event",
  "Other",
];

const maxPassengers = 50;
const rentalPollMs = 5_000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function sameOrAfter(a: Date, b: Date) {
  return (
    new Date(a.getFullYear(), a.getMonth(), a.getDate()) >=
    new Date(b.getFullYear(), b.getMonth(), b.getDate())
  );
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

type RentalField =
  | "pickup"
  | "destination"
  | "tripDate"
  | "pickupTime"
  | "returnDate"
  | "returnTime"
  | "occasion"
  | "vehicle";

type StepProblem = [field: RentalField, message: string] | null;

const rentalFieldTitles: Record<RentalField, string> = {
  pickup: "Pickup location",
  destination: "Destination",
  tripDate: "Trip date",
  pickupTime: "Pickup time",
  returnDate: "Return date",
  returnTime: "Return pickup time",
  occasion: "Occasion",
  vehicle: "Vehicle",
};

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export default function RentalScreen() {
  const insets = useSafeAreaInsets();
  const statusBarTop = useStatusBarTop();
  const [toast, setToast] = useState<MiniToastMessage | null>(null);
  const showToast = (text: string) => setToast({ id: Date.now(), text });
  const chrome = useScrollChrome();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const [step, setStep] = useState<Step>(1);
  const [problem, setProblemMessage] = useState("");
  const [problemField, setProblemField] = useState<RentalField | null>(null);
  const setProblem = (message: string, field: RentalField | null = null) => {
    setProblemMessage(message);
    setProblemField(message ? field : null);
  };
  const invalid = (field: RentalField) => problemField === field;

  const [pickup, setPickup] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [tripDate, setTripDate] = useState<Date | null>(null);
  const [pickupTime, setPickupTime] = useState<Date | null>(null);
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [returnTime, setReturnTime] = useState<Date | null>(null);
  const [occasion, setOccasion] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState("");
  const [fleet, setFleet] = useState<Fleet>(startingFleet);
  const [sending, setSending] = useState(false);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalsLoaded, setRentalsLoaded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<Rental | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [pickupInProgress, setPickupInProgress] = useState(false);
  const online = useOnline();

  const refreshRentals = useCallback(async () => {
    const [result, pickup, shared] = await Promise.all([
      loadMyRentals(),
      loadActivePickup(),
      loadMySharedRide(),
    ]);
    if (result.ok) setRentals(result.data);
    setRentalsLoaded(true);
    if (pickup.ok && shared.ok) {
      setPickupInProgress(!!pickup.data || !!shared.data);
    }
  }, []);

  usePolling(refreshRentals, rentalPollMs);

  useEffect(() => {
    let newestId = getNotifications()[0]?.id;
    return subscribeToNotifications(() => {
      const newest = getNotifications()[0];
      if (!newest || newest.id === newestId) return;
      newestId = newest.id;
      if (newest.type.startsWith("rental_")) void refreshRentals();
    });
  }, [refreshRentals]);

  const activeRental = activeRentalOf(rentals);
  const showForm = rentalsLoaded && !activeRental && !pickupInProgress;

  const buildTrip = (): RentalTrip | null => {
    if (!pickup || !destination || !tripDate || !pickupTime) return null;
    return {
      pickup,
      destination,
      pickupTime: combineDateTime(tripDate, pickupTime),
      tripType,
      returnTime:
        tripType === "round_trip" && returnDate && returnTime
          ? combineDateTime(returnDate, returnTime)
          : null,
      purpose: occasion,
      passengers,
      notes,
    };
  };

  const resetForm = () => {
    setPickup(null);
    setDestination(null);
    setTripDate(null);
    setPickupTime(null);
    setTripType("one_way");
    setReturnDate(null);
    setReturnTime(null);
    setOccasion("");
    setPassengers(1);
    setNotes("");
    setFleet(startingFleet);
  };

  const postRequest = async () => {
    const vehicleProblem = getVehicleProblem();
    if (vehicleProblem) return setProblem(vehicleProblem[1], vehicleProblem[0]);
    const trip = buildTrip();
    if (!trip || sending) return;
    setSending(true);
    setProblem("");
    if (!(await checkOnline())) {
      setSending(false);
      return setProblem(
        "You're offline. Connect to the internet to post your request.",
      );
    }
    const result = await postRental(fleet, trip);
    setSending(false);
    if (!result.ok) return setProblem(result.error);
    resetForm();
    goToStep(1);
    refreshRentals();
  };

  const completeActive = async () => {
    if (!activeRental || completing) return;
    setCompleting(true);
    setCancelError("");
    const finished = activeRental;
    const result = await completeRental(finished.id);
    setCompleting(false);
    if (!result.ok) return setCancelError(result.error);
    setRateTarget({ ...finished, status: "completed" });
    setRentals((current) =>
      current.filter((item) => item.id !== activeRental.id),
    );
    refreshRentals();
  };

  const removeDriver = async (unitId: string) => {
    if (removingId) return;
    setRemovingId(unitId);
    setCancelError("");
    const result = await removeRentalDriver(unitId);
    setRemovingId(null);
    if (!result.ok) return setCancelError(result.error);
    showToast("Driver removed. The vehicle is back on the job board.");
    refreshRentals();
  };

  const cancelActive = async () => {
    if (!activeRental || cancelling) return;
    setCancelling(true);
    setCancelError("");
    const result = await cancelRental(activeRental.id);
    setCancelling(false);
    if (!result.ok) return setCancelError(result.error);
    setRentals((current) =>
      current.filter((item) => item.id !== activeRental.id),
    );
    refreshRentals();
  };

  const clearProblemFor = (field: RentalField) => {
    if (problemField === field) setProblem("");
  };

  const goToStep = (next: Step) => {
    setProblem("");
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goHome = () => {
    if (!router.canGoBack()) router.replace(Routes.commuterHome);
    else router.back();
  };

  const getTripProblem = (): StepProblem => {
    if (!pickup)
      return ["pickup", "Choose your pickup location from the suggestions."];
    if (!destination)
      return ["destination", "Choose your destination from the suggestions."];
    if (pickup.id === destination.id) {
      return [
        "destination",
        "Your pickup location and destination can't be the same.",
      ];
    }
    if (!tripDate) return ["tripDate", "Select the date of your trip."];
    if (!pickupTime) return ["pickupTime", "Select your pickup time."];
    if (tripType === "round_trip") {
      if (!returnDate) return ["returnDate", "Select your return date."];
      if (!sameOrAfter(returnDate, tripDate)) {
        return ["returnDate", "The return date can't be before the trip date."];
      }
      if (!returnTime) return ["returnTime", "Select your return pickup time."];
      if (
        sameDay(returnDate, tripDate) &&
        minutesOfDay(returnTime) <= minutesOfDay(pickupTime)
      ) {
        return [
          "returnTime",
          "The return pickup time must be after your pickup time.",
        ];
      }
    }
    if (!occasion) return ["occasion", "Select the occasion of your trip."];
    return null;
  };

  const getVehicleProblem = (): StepProblem => {
    const count = fleetSize(fleet);
    if (count === 0) return ["vehicle", "Add at least one vehicle to rent."];
    if (count > maxFleet) {
      return ["vehicle", `You can rent up to ${maxFleet} vehicles at a time.`];
    }
    const seats = fleetSeats(fleet);
    if (passengers > seats) {
      return [
        "vehicle",
        `These vehicles seat up to ${seats} passengers. Add another vehicle or choose bigger ones.`,
      ];
    }
    return null;
  };

  const stepProblems: Record<Step, () => StepProblem> = {
    1: getTripProblem,
    2: getVehicleProblem,
  };

  const canGoForward = step < 2 && !stepProblems[step]();
  const canGoBackward = step > 1;

  const advance = () => {
    const problem = stepProblems[step]();
    if (problem) return setProblem(problem[1], problem[0]);
    const trip = buildTrip();
    if (step === 1 && trip && trip.pickupTime.getTime() <= Date.now()) {
      return setProblem("Choose a pickup time later than now.", "pickupTime");
    }
    goToStep(2);
  };

  const retreat = () => {
    if (canGoBackward) goToStep((step - 1) as Step);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 1) {
          setProblem("");
          setStep((current) => (current - 1) as Step);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [step]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={24}
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight + (showForm ? stepProgressHeight : 0),
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {!rentalsLoaded && (
            <SkeletonCards count={1} height={220} style={styles.loading} />
          )}
          {rentalsLoaded && activeRental && (
            <ActiveRental
              rental={activeRental}
              busy={cancelling}
              completing={completing}
              problem={cancelError}
              onCancel={cancelActive}
              onComplete={completeActive}
              removingId={removingId}
              onRemoveDriver={removeDriver}
            />
          )}
          {rentalsLoaded && !activeRental && pickupInProgress && (
            <View style={styles.blocked}>
              <View style={styles.blockedIcon}>
                <PersonStanding color={brandBlue} size={26} strokeWidth={2} />
              </View>
              <Text style={styles.blockedTitle}>
                You have a pickup in progress
              </Text>
              <Text style={styles.blockedText}>
                You can only have one request at a time. Finish or cancel your
                pickup, then come back to post a rental.
              </Text>
              <ModuleButton
                label="GO TO PICKUP"
                onPress={() => router.push(Routes.commuterPickup)}
                style={styles.blockedButton}
              />
            </View>
          )}
          {showForm && step === 1 && (
            <>
              <SectionTitle
                icon={<MapPin color="#ffffff" size={18} strokeWidth={2} />}
                title="Where are we going?"
              />
              <FieldLabel invalid={invalid("pickup")}>
                PREFERRED PICKUP LOCATION
              </FieldLabel>
              <ErrorOutline invalid={invalid("pickup")} color={error}>
                <PlaceSearchField
                  value={pickup}
                  onChange={(place) => {
                    setProblem("");
                    setPickup(place);
                  }}
                  onProblem={(message) => setProblem(message, "pickup")}
                  placeholder="Search pickup location..."
                  icon={<MapPin color={brandBlue} size={18} strokeWidth={2} />}
                  allowCurrentLocation
                />
              </ErrorOutline>
              <View style={styles.gap} />
              <FieldLabel invalid={invalid("destination")}>
                DESTINATION
              </FieldLabel>
              <ErrorOutline invalid={invalid("destination")} color={error}>
                <PlaceSearchField
                  value={destination}
                  onChange={(place) => {
                    setProblem("");
                    setDestination(place);
                  }}
                  onProblem={(message) => setProblem(message, "destination")}
                  placeholder="Search destination..."
                  icon={<Flag color={brandBlue} size={18} strokeWidth={2} />}
                />
              </ErrorOutline>

              <SectionTitle
                icon={
                  <CalendarDays color="#ffffff" size={18} strokeWidth={2} />
                }
                title="Trip details"
              />
              <FieldLabel>TRIP TYPE</FieldLabel>
              <View style={styles.chipRow}>
                <Chip
                  label="One-way"
                  selected={tripType === "one_way"}
                  onPress={() => setTripType("one_way")}
                  grow
                />
                <Chip
                  label="Round trip"
                  selected={tripType === "round_trip"}
                  onPress={() => setTripType("round_trip")}
                  grow
                />
              </View>

              <View style={[styles.row, styles.gapTop]}>
                <View style={styles.flex}>
                  <FieldLabel invalid={invalid("tripDate")}>
                    TRIP DATE
                  </FieldLabel>
                  <ErrorOutline invalid={invalid("tripDate")} color={error}>
                    <DateTimeField
                      mode="date"
                      value={tripDate}
                      onChange={(value) => {
                        clearProblemFor("tripDate");
                        setTripDate(value);
                      }}
                      placeholder="Select date"
                      minimumDate={startOfToday()}
                    />
                  </ErrorOutline>
                </View>
                <View style={styles.flex}>
                  <FieldLabel invalid={invalid("pickupTime")}>
                    PICKUP TIME
                  </FieldLabel>
                  <ErrorOutline invalid={invalid("pickupTime")} color={error}>
                    <DateTimeField
                      mode="time"
                      value={pickupTime}
                      onChange={(value) => {
                        clearProblemFor("pickupTime");
                        setPickupTime(value);
                      }}
                      placeholder="Select time"
                    />
                  </ErrorOutline>
                </View>
              </View>

              {tripType === "round_trip" && (
                <View style={[styles.row, styles.gapTop]}>
                  <View style={styles.flex}>
                    <FieldLabel invalid={invalid("returnDate")}>
                      RETURN DATE
                    </FieldLabel>
                    <ErrorOutline invalid={invalid("returnDate")} color={error}>
                      <DateTimeField
                        mode="date"
                        value={returnDate}
                        onChange={(value) => {
                          clearProblemFor("returnDate");
                          setReturnDate(value);
                        }}
                        placeholder="Select date"
                        minimumDate={tripDate ?? startOfToday()}
                      />
                    </ErrorOutline>
                  </View>
                  <View style={styles.flex}>
                    <FieldLabel invalid={invalid("returnTime")}>
                      RETURN PICKUP TIME
                    </FieldLabel>
                    <ErrorOutline invalid={invalid("returnTime")} color={error}>
                      <DateTimeField
                        mode="time"
                        value={returnTime}
                        onChange={(value) => {
                          clearProblemFor("returnTime");
                          setReturnTime(value);
                        }}
                        placeholder="Select time"
                      />
                    </ErrorOutline>
                  </View>
                </View>
              )}

              <View style={styles.gapTop}>
                <FieldLabel invalid={invalid("occasion")}>OCCASION</FieldLabel>
                <View style={[styles.chipRow, styles.chipWrap]}>
                  {occasions.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={occasion === option}
                      onPress={() => {
                        clearProblemFor("occasion");
                        setOccasion(option);
                      }}
                      style={styles.occasionChip}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.gapTop}>
                <FieldLabel>NUMBER OF PASSENGERS</FieldLabel>
                <PassengerStepper
                  value={passengers}
                  onChange={setPassengers}
                  min={1}
                  max={maxPassengers}
                />
                <Text style={styles.passengerHint}>Including you.</Text>
              </View>

              <View style={styles.gapTop}>
                <FieldLabel>NOTES FOR THE DRIVER (OPTIONAL)</FieldLabel>
                <SoftField
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Stops along the way, luggage, special requests..."
                  multiline
                  icon={
                    <NotebookPen color={brandBlue} size={18} strokeWidth={2} />
                  }
                />
              </View>

              <Problem message={problem} field={problemField} />
              <ModuleButton label="CHOOSE VEHICLE" onPress={advance} />
            </>
          )}

          {showForm && step === 2 && (
            <>
              <SectionTitle
                icon={<BusFront color="#ffffff" size={18} strokeWidth={2} />}
                title="Choose vehicles to rent"
              />
              <ErrorOutline invalid={invalid("vehicle")} color={error}>
                <FleetPicker
                  fleet={fleet}
                  onChange={(next) => {
                    clearProblemFor("vehicle");
                    setFleet(next);
                  }}
                />
              </ErrorOutline>
              <View style={styles.infoCard}>
                <Users color={brandBlue} size={18} strokeWidth={2} />
                <Text style={styles.infoText}>
                  You have <Text style={styles.bold}>{passengers}</Text>{" "}
                  {passengers === 1 ? "passenger" : "passengers"}. Mix any
                  vehicles you need, up to {maxFleet}. Each vehicle can be taken
                  by a different driver.
                </Text>
              </View>

              <SectionTitle
                icon={<Megaphone color="#ffffff" size={18} strokeWidth={2} />}
                title="Review and post"
              />
              <View style={styles.review}>
                <Text style={styles.reviewEyebrow}>YOUR RENTAL TO</Text>
                <Text style={styles.reviewTitle} numberOfLines={2}>
                  {destination?.name ?? "Your destination"}
                </Text>
                <Text style={styles.reviewLine} numberOfLines={2}>
                  From {pickup?.name ?? "your pickup location"}
                </Text>
                {tripDate && pickupTime && (
                  <Text style={styles.reviewLine}>
                    {formatRentalTime(combineDateTime(tripDate, pickupTime))}
                    {tripType === "round_trip" && returnDate && returnTime
                      ? ` · return ${formatRentalTime(combineDateTime(returnDate, returnTime))}`
                      : ""}
                  </Text>
                )}
                <Text style={styles.reviewLine}>
                  {passengers} {passengers === 1 ? "passenger" : "passengers"} ·{" "}
                  {fleetLabel(fleet) || "No vehicles yet"} · {occasion}
                </Text>
              </View>

              {!online && <ConnectionRequired action="A rental request" />}
              {online && <Problem message={problem} field={problemField} />}
              <ModuleButton
                label={
                  sending ? "POSTING..." : online ? "POST REQUEST" : "OFFLINE"
                }
                disabled={sending || !online}
                onPress={postRequest}
              />
              <Text style={styles.postHint}>
                Your request goes to every available driver of these vehicles.
                Each vehicle is booked by its own driver, and you&apos;ll be
                notified as each one accepts.
              </Text>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      {rateTarget && (
        <RateDriversModal
          key={rateTarget.id}
          rental={rateTarget}
          onClose={() => setRateTarget(null)}
        />
      )}

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Rental"
          subtitle="Charter a private vehicle for your trips, outings and special occasions."
          icon={<BusFront color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goHome}
          footerHeight={showForm ? stepProgressHeight : 0}
        >
          {showForm && (
            <StepProgress
              step={step}
              canGoBack={canGoBackward}
              canGoForward={canGoForward}
              onBack={retreat}
              onForward={advance}
            />
          )}
        </ModuleHeader>
      </StickyHeader>
      <MiniToast message={toast} top={statusBarTop + 12} />
    </View>
  );
}

const stepProgressHeight = 54;

function StepProgress({
  step,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  step: Step;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <View style={styles.progress}>
      <View style={styles.progressRow}>
        <StepArrow
          direction="back"
          label="Previous step"
          disabled={!canGoBack}
          onPress={onBack}
        />
        <Text style={styles.progressText} numberOfLines={1}>
          Step {step} of {stepTitles.length} · {stepTitles[step - 1]}
        </Text>
        <StepArrow
          direction="forward"
          label="Next step"
          disabled={!canGoForward}
          onPress={onForward}
        />
      </View>
      <View style={styles.progressBars}>
        {stepTitles.map((title, index) => (
          <View
            key={title}
            style={[styles.progressBar, index < step && styles.progressBarDone]}
          />
        ))}
      </View>
    </View>
  );
}

function StepArrow({
  direction,
  label,
  disabled,
  onPress,
}: {
  direction: "back" | "forward";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = direction === "back" ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepArrow,
        disabled && styles.stepArrowDisabled,
        pressed && styles.stepArrowPressed,
      ]}
    >
      <Icon color="#ffffff" size={16} strokeWidth={2.5} />
    </Pressable>
  );
}

function Problem({
  message,
  field,
}: {
  message: string;
  field: RentalField | null;
}) {
  if (!message) return null;
  return (
    <ErrorAlert
      title={field ? rentalFieldTitles[field] : "Rental request"}
      message={message}
      style={styles.problem}
    />
  );
}

const styles = StyleSheet.create({
  passengerHint: {
    marginTop: 6,
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 4 },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 12 },
  gap: { height: 14 },
  gapTop: { marginTop: 16 },
  bold: { fontFamily: "SoraBold" },
  progress: { marginTop: 14 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  progressText: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 10,
    textAlign: "center",
  },
  stepArrow: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  stepArrowDisabled: { opacity: 0.35 },
  stepArrowPressed: { backgroundColor: "rgba(255, 255, 255, 0.15)" },
  progressBars: { flexDirection: "row", gap: 6 },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressBarDone: { backgroundColor: "#ffffff" },
  chipRow: { flexDirection: "row", gap: 8 },
  chipWrap: { flexWrap: "wrap" },
  occasionChip: { flexBasis: "45%", flexGrow: 1 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  infoText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  loading: { marginTop: 48 },
  pressed: { opacity: 0.8 },
  problem: { marginTop: 16 },
  review: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: palette.navy,
  },
  reviewEyebrow: { color: palette.cyan, fontFamily: "SoraBold", fontSize: 10 },
  reviewTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 18,
    lineHeight: 24,
  },
  reviewLine: {
    color: "#d6e2f5",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 17,
  },
  postHint: {
    marginTop: 10,
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  blocked: {
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: softBlue,
  },
  blockedButton: { alignSelf: "stretch", marginTop: 8 },
  blockedIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#ffffff",
  },
  blockedTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 16,
    textAlign: "center",
  },
  blockedText: {
    color: text,
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
