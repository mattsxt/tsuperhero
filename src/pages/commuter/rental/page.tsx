import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Award from "lucide-react-native/icons/award";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Flag from "lucide-react-native/icons/flag";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserRoundCheck from "lucide-react-native/icons/user-round-check";
import Users from "lucide-react-native/icons/users";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Place } from "@/api/v1/places/controllers";
import {
  cancelRental,
  combineDateTime,
  findRentalDrivers,
  loadMyRentals,
  requestRental,
  type CharterVehicle,
  type Rental,
  type RentalDriver,
  type RentalTrip,
  type TripType,
} from "@/api/v1/rentals/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { DateTimeField } from "@/components/date-time-field";
import { EmptyState } from "@/components/empty-state";
import {
  Chip,
  FieldLabel,
  ModuleButton,
  ModuleHeader,
  moduleColors,
  PassengerStepper,
  SectionTitle,
  SoftField,
  VehiclePicker,
  type VehicleOption,
} from "@/components/module-ui";
import { ConnectionRequired } from "@/components/connection-required";
import { PlaceSearchField } from "@/components/place-search-field";
import { RentalCard } from "@/components/rental-card";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { checkOnline, useOnline } from "@/hooks/use-online";
import { usePolling } from "@/hooks/use-polling";

const { brandBlue, softBlue, text, error } = moduleColors;

type Step = 1 | 2 | 3;

const stepTitles = ["Trip details", "Vehicle", "Driver"];

const charterVehicles: VehicleOption<CharterVehicle>[] = [
  { value: "van", label: "VAN", icon: require("@/assets/images/van.svg") },
  {
    value: "jeep",
    label: "JEEP",
    icon: require("@/assets/images/jeepney.svg"),
  },
  { value: "bus", label: "BUS", icon: require("@/assets/images/bus.svg") },
];

const vehicleCapacity: Record<CharterVehicle, number> = {
  van: 14,
  jeep: 20,
  bus: 50,
};

const vehicleNames: Record<CharterVehicle, string> = {
  van: "Van",
  jeep: "Jeepney",
  bus: "Bus",
};

const occasions = [
  "Family Trip",
  "Outing",
  "Field Trip",
  "Wedding",
  "Company Event",
  "Other",
];

const maxPassengers = 50;
const rentalPollMs = 10_000;

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

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export default function RentalScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [step, setStep] = useState<Step>(1);
  const [problem, setProblem] = useState("");

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
  const [vehicle, setVehicle] = useState<CharterVehicle>("van");
  const [drivers, setDrivers] = useState<RentalDriver[] | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const online = useOnline();

  const refreshRentals = useCallback(async () => {
    const result = await loadMyRentals();
    if (result.ok) setRentals(result.data);
  }, []);

  usePolling(refreshRentals, rentalPollMs);

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

  const searchDrivers = async () => {
    const trip = buildTrip();
    if (!trip) return;
    setDrivers(null);
    setDriverId(null);
    const result = await findRentalDrivers(vehicle, trip);
    if (!result.ok) {
      setDrivers([]);
      setProblem(result.error);
      return;
    }
    setDrivers(result.data);
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
    setVehicle("van");
    setDrivers(null);
    setDriverId(null);
  };

  const sendRequest = async () => {
    const trip = buildTrip();
    const driver = drivers?.find((item) => item.driverId === driverId);
    if (!trip || !driver || sending) return;
    setSending(true);
    setProblem("");
    if (!(await checkOnline())) {
      setSending(false);
      return setProblem(
        "You're offline. Connect to the internet to send your request.",
      );
    }
    const result = await requestRental(driver, trip);
    setSending(false);
    if (!result.ok) {
      setProblem(result.error);
      searchDrivers();
      return;
    }
    resetForm();
    setNotice(
      `Request sent to ${driver.name}. We'll notify you when they respond.`,
    );
    goToStep(1);
    refreshRentals();
  };

  const confirmCancel = (rental: Rental) => {
    Alert.alert(
      "Cancel this rental?",
      `Your rental to ${rental.destination} will be cancelled and the driver will be notified.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel rental",
          style: "destructive",
          onPress: async () => {
            setCancellingId(rental.id);
            const result = await cancelRental(rental.id);
            setCancellingId(null);
            if (!result.ok) {
              Alert.alert("Couldn't cancel", result.error);
              return;
            }
            setRentals((current) =>
              current.filter((item) => item.id !== rental.id),
            );
          },
        },
      ],
    );
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

  const getTripProblem = () => {
    if (!pickup) return "Choose your pickup location from the suggestions.";
    if (!destination) return "Choose your destination from the suggestions.";
    if (pickup.id === destination.id) {
      return "Your pickup location and destination can't be the same.";
    }
    if (!tripDate) return "Select the date of your trip.";
    if (!pickupTime) return "Select your pickup time.";
    if (tripType === "round_trip") {
      if (!returnDate) return "Select your return date.";
      if (!sameOrAfter(returnDate, tripDate)) {
        return "The return date can't be before the trip date.";
      }
      if (!returnTime) return "Select your return pickup time.";
      if (
        sameDay(returnDate, tripDate) &&
        minutesOfDay(returnTime) <= minutesOfDay(pickupTime)
      ) {
        return "The return pickup time must be after your pickup time.";
      }
    }
    if (!occasion) return "Select the occasion of your trip.";
    return null;
  };

  const getVehicleProblem = () =>
    passengers > vehicleCapacity[vehicle]
      ? `A ${vehicleNames[vehicle].toLowerCase()} fits up to ${vehicleCapacity[vehicle]} passengers. Choose a bigger vehicle.`
      : null;

  const stepProblems: Record<Step, () => string | null> = {
    1: getTripProblem,
    2: getVehicleProblem,
    3: () => (driverId ? null : "Choose a driver to send your request to."),
  };

  const canGoForward = step < 3 && !stepProblems[step]();
  const canGoBackward = step > 1;

  const advance = () => {
    const problem = stepProblems[step]();
    if (problem) return setProblem(problem);
    const trip = buildTrip();
    if (step === 1 && trip && trip.pickupTime.getTime() <= Date.now()) {
      return setProblem("Choose a pickup time later than now.");
    }
    setNotice("");
    if (step === 2) searchDrivers();
    goToStep((step + 1) as Step);
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
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {step === 1 && (
            <>
              {!!notice && (
                <View style={[styles.infoCard, styles.successCard]}>
                  <CircleCheck color="#15803d" size={18} strokeWidth={2} />
                  <Text style={[styles.infoText, styles.successText]}>
                    {notice}
                  </Text>
                </View>
              )}
              {rentals.length > 0 && (
                <>
                  <SectionTitle
                    icon={
                      <BusFront color="#ffffff" size={18} strokeWidth={2} />
                    }
                    title="Your rental requests"
                  />
                  <View style={styles.rentalList}>
                    {rentals.map((rental) => (
                      <RentalCard
                        key={rental.id}
                        rental={rental}
                        viewer="commuter"
                        disabled={!!cancellingId}
                        actions={
                          (rental.status === "pending" && !rental.expired) ||
                          rental.status === "accepted"
                            ? [
                                {
                                  label: "CANCEL RENTAL",
                                  tone: "danger",
                                  busy: cancellingId === rental.id,
                                  onPress: () => confirmCancel(rental),
                                },
                              ]
                            : []
                        }
                      />
                    ))}
                  </View>
                </>
              )}
              <SectionTitle
                icon={<MapPin color="#ffffff" size={18} strokeWidth={2} />}
                title="Where are we going?"
              />
              <FieldLabel>PREFERRED PICKUP LOCATION</FieldLabel>
              <PlaceSearchField
                value={pickup}
                onChange={(place) => {
                  setProblem("");
                  setPickup(place);
                }}
                onProblem={setProblem}
                placeholder="Search pickup location..."
                icon={<MapPin color={brandBlue} size={18} strokeWidth={2} />}
                allowCurrentLocation
              />
              <View style={styles.gap} />
              <FieldLabel>DESTINATION</FieldLabel>
              <PlaceSearchField
                value={destination}
                onChange={(place) => {
                  setProblem("");
                  setDestination(place);
                }}
                onProblem={setProblem}
                placeholder="Search destination..."
                icon={<Flag color={brandBlue} size={18} strokeWidth={2} />}
              />

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
                  <FieldLabel>TRIP DATE</FieldLabel>
                  <DateTimeField
                    mode="date"
                    value={tripDate}
                    onChange={setTripDate}
                    placeholder="Select date"
                    minimumDate={startOfToday()}
                  />
                </View>
                <View style={styles.flex}>
                  <FieldLabel>PICKUP TIME</FieldLabel>
                  <DateTimeField
                    mode="time"
                    value={pickupTime}
                    onChange={setPickupTime}
                    placeholder="Select time"
                  />
                </View>
              </View>

              {tripType === "round_trip" && (
                <View style={[styles.row, styles.gapTop]}>
                  <View style={styles.flex}>
                    <FieldLabel>RETURN DATE</FieldLabel>
                    <DateTimeField
                      mode="date"
                      value={returnDate}
                      onChange={setReturnDate}
                      placeholder="Select date"
                      minimumDate={tripDate ?? startOfToday()}
                    />
                  </View>
                  <View style={styles.flex}>
                    <FieldLabel>RETURN PICKUP TIME</FieldLabel>
                    <DateTimeField
                      mode="time"
                      value={returnTime}
                      onChange={setReturnTime}
                      placeholder="Select time"
                    />
                  </View>
                </View>
              )}

              <View style={styles.gapTop}>
                <FieldLabel>OCCASION</FieldLabel>
                <View style={[styles.chipRow, styles.chipWrap]}>
                  {occasions.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={occasion === option}
                      onPress={() => setOccasion(option)}
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

              <Problem message={problem} />
              <ModuleButton label="CHOOSE VEHICLE" onPress={advance} />
            </>
          )}

          {step === 2 && (
            <>
              <SectionTitle
                icon={<BusFront color="#ffffff" size={18} strokeWidth={2} />}
                title="Choose a vehicle to rent"
              />
              <VehiclePicker
                value={vehicle}
                onChange={(next) => {
                  setProblem("");
                  setVehicle(next);
                }}
                options={charterVehicles}
              />
              <View style={styles.infoCard}>
                <Users color={brandBlue} size={18} strokeWidth={2} />
                <Text style={styles.infoText}>
                  A {vehicleNames[vehicle].toLowerCase()} seats up to{" "}
                  <Text style={styles.bold}>{vehicleCapacity[vehicle]}</Text>{" "}
                  passengers. You have{" "}
                  <Text style={styles.bold}>{passengers}</Text>.
                </Text>
              </View>
              {passengers > vehicleCapacity[vehicle] && (
                <View style={[styles.infoCard, styles.warningCard]}>
                  <TriangleAlert color={error} size={18} strokeWidth={2} />
                  <Text style={[styles.infoText, styles.warningText]}>
                    Too many passengers for this vehicle. Choose a bigger one.
                  </Text>
                </View>
              )}

              <Problem message={problem} />
              <ModuleButton label="FIND DRIVERS" onPress={advance} />
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle
                icon={
                  <UserRoundCheck color="#ffffff" size={18} strokeWidth={2} />
                }
                title="Available drivers"
              />
              {drivers === null ? (
                <LoadingLogo style={styles.loading} label="Finding drivers" />
              ) : drivers.length === 0 ? (
                <EmptyState
                  icon={
                    <UserRoundCheck
                      color={brandBlue}
                      size={32}
                      strokeWidth={1.8}
                    />
                  }
                  title="No drivers available"
                  message={`No ${vehicleNames[vehicle].toLowerCase()} driver is free for ${passengers} ${passengers === 1 ? "passenger" : "passengers"} on that date. Try another date or vehicle.`}
                />
              ) : (
                <>
                  <Text style={styles.driverHint}>
                    {drivers.length}{" "}
                    {drivers.length === 1 ? "driver is" : "drivers are"} free
                    for your trip. Choose one to send your request.
                  </Text>
                  <View style={styles.driverList}>
                    {drivers.map((driver) => (
                      <DriverOption
                        key={driver.driverId}
                        driver={driver}
                        selected={driver.driverId === driverId}
                        onPress={() => {
                          setProblem("");
                          setDriverId(driver.driverId);
                        }}
                      />
                    ))}
                  </View>
                  {!online && <ConnectionRequired action="A rental request" />}
                  {online && <Problem message={problem} />}
                  <ModuleButton
                    label={
                      sending
                        ? "SENDING..."
                        : online
                          ? "SEND REQUEST"
                          : "OFFLINE"
                    }
                    disabled={!driverId || sending || !online}
                    onPress={sendRequest}
                  />
                </>
              )}
              {drivers?.length === 0 && <Problem message={problem} />}
            </>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Rental"
          subtitle="Charter a private vehicle for your trips, outings and special occasions."
          icon={<BusFront color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goHome}
          collapsed={chrome.collapsed}
        >
          <StepProgress
            step={step}
            collapsed={chrome.collapsed}
            canGoBack={canGoBackward}
            canGoForward={canGoForward}
            onBack={retreat}
            onForward={advance}
          />
        </ModuleHeader>
      </StickyHeader>
    </View>
  );
}

function StepProgress({
  step,
  collapsed,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  step: Step;
  collapsed: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <View style={[styles.progress, collapsed && styles.progressCollapsed]}>
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

function DriverOption({
  driver,
  selected,
  onPress,
}: {
  driver: RentalDriver;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${driver.name}, ${driver.vehicleType} ${driver.plateNumber}, seats ${driver.maxCapacity}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.driver,
        selected && styles.driverSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.driverAvatar}>
        <Text style={styles.driverInitial}>
          {driver.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.driverName} numberOfLines={1}>
          {driver.name}
        </Text>
        <Text style={styles.driverMeta} numberOfLines={1}>
          {driver.plateNumber} · {driver.isModern ? "Modern " : ""}
          {driver.vehicleType} · {driver.maxCapacity} seats
        </Text>
        <View style={styles.driverTags}>
          {driver.yearsOfExperience !== null && (
            <View style={styles.driverTag}>
              <Award color={brandBlue} size={11} strokeWidth={2.2} />
              <Text style={styles.driverTagText}>
                {driver.yearsOfExperience}{" "}
                {driver.yearsOfExperience === 1 ? "yr" : "yrs"} driving
              </Text>
            </View>
          )}
          {!!driver.cooperative && (
            <View style={styles.driverTag}>
              <Text style={styles.driverTagText} numberOfLines={1}>
                {driver.cooperative}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

function Problem({ message }: { message: string }) {
  if (!message) return null;
  return <Text style={styles.problem}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 4 },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 12 },
  gap: { height: 14 },
  gapTop: { marginTop: 16 },
  bold: { fontFamily: "SoraBold" },
  progress: { marginTop: 18 },
  progressCollapsed: { marginTop: 10 },
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
  warningCard: { marginTop: 10, backgroundColor: "#fde8e6" },
  infoText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  warningText: { color: error },
  successCard: { marginTop: 14, backgroundColor: "#dcfce7" },
  successText: { color: "#166534" },
  rentalList: { gap: 10 },
  loading: { marginTop: 48 },
  pressed: { opacity: 0.8 },
  driverHint: {
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  driverList: { gap: 10, marginTop: 12 },
  driver: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#d9e2f3",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  driverSelected: { borderColor: brandBlue, backgroundColor: softBlue },
  driverAvatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: brandBlue,
  },
  driverInitial: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 16 },
  driverName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  driverMeta: { color: text, fontFamily: "Sora", fontSize: 10, marginTop: 2 },
  driverTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  driverTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2f3",
  },
  driverTagText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 8 },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#b9c6e4",
  },
  radioSelected: { borderColor: brandBlue },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: brandBlue,
  },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 16,
    textAlign: "center",
  },
});
