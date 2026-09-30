import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Flag from "lucide-react-native/icons/flag";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import PartyPopper from "lucide-react-native/icons/party-popper";
import Star from "lucide-react-native/icons/star";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserRoundCheck from "lucide-react-native/icons/user-round-check";
import Users from "lucide-react-native/icons/users";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedRef,
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Place } from "@/api/v1/places/controllers";
import {
  DateTimeField,
  formatDate,
  formatTime,
} from "@/components/date-time-field";
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
  vehicleOptions,
  type Vehicle,
} from "@/components/module-ui";
import { PlaceSearchField } from "@/components/place-search-field";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;

type Step = 1 | 2 | 3 | 4 | 5;
type TripType = "one_way" | "round_trip";
type CharterVehicle = Exclude<Vehicle, "tricy">;

const stepTitles = ["Trip details", "Vehicle", "Driver", "Review"];

const charterVehicles = vehicleOptions.filter(
  (option) => option.value !== "tricy",
);

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

type Driver = {
  id: string;
  name: string;
  rating: number;
  trips: number;
  vehicle: CharterVehicle;
  model: string;
  plate: string;
  seats: number;
};

const sampleDrivers: Driver[] = [
  {
    id: "v1",
    name: "Ramon Dela Paz",
    rating: 4.9,
    trips: 214,
    vehicle: "van",
    model: "Toyota Hiace Commuter",
    plate: "NAB 4821",
    seats: 14,
  },
  {
    id: "v2",
    name: "Liza Manalo",
    rating: 4.8,
    trips: 167,
    vehicle: "van",
    model: "Nissan NV350 Urvan",
    plate: "NCD 1934",
    seats: 12,
  },
  {
    id: "v3",
    name: "Arnel Villanueva",
    rating: 4.6,
    trips: 98,
    vehicle: "van",
    model: "Toyota Hiace GL Grandia",
    plate: "NEF 7702",
    seats: 10,
  },
  {
    id: "j1",
    name: "Jojo Bautista",
    rating: 4.7,
    trips: 305,
    vehicle: "jeep",
    model: "Modern PUJ (Class 2)",
    plate: "NGH 3310",
    seats: 20,
  },
  {
    id: "j2",
    name: "Carmela Reyes",
    rating: 4.5,
    trips: 142,
    vehicle: "jeep",
    model: "Sarao Jeepney",
    plate: "NIJ 8845",
    seats: 18,
  },
  {
    id: "b1",
    name: "Nestor Aquino",
    rating: 4.9,
    trips: 421,
    vehicle: "bus",
    model: "Hino RK1J Tourist Bus",
    plate: "NKL 5567",
    seats: 49,
  },
  {
    id: "b2",
    name: "Rowena Santos",
    rating: 4.8,
    trips: 256,
    vehicle: "bus",
    model: "Daewoo BV115 Coach",
    plate: "NMN 2098",
    seats: 45,
  },
  {
    id: "b3",
    name: "Dante Morales",
    rating: 4.6,
    trips: 133,
    vehicle: "bus",
    model: "King Long XMQ6127",
    plate: "NOP 6651",
    seats: 50,
  },
];

const cardTransition: CSSTransitionProperties = {
  transitionProperty: ["backgroundColor", "borderColor"],
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
};

const maxPassengers = 50;


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

function describePlace(place: Place) {
  return place.address ? `${place.name}, ${place.address}` : place.name;
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
  const [driverId, setDriverId] = useState<string | null>(null);

  const drivers = sampleDrivers.filter(
    (driver) => driver.vehicle === vehicle && driver.seats >= passengers,
  );
  const driver = sampleDrivers.find((option) => option.id === driverId);

  const goToStep = (next: Step) => {
    setProblem("");
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goHome = () => {
    if (step === 5 || !router.canGoBack()) router.replace(Routes.commuterHome);
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

  const getDriverProblem = () =>
    driver && drivers.includes(driver) ? null : "Select a driver to continue.";

  const stepProblems: Record<Step, () => string | null> = {
    1: getTripProblem,
    2: getVehicleProblem,
    3: getDriverProblem,
    4: () => "Confirm your booking to continue.",
    5: () => "",
  };

  const canGoForward = step < 4 && !stepProblems[step]();
  const canGoBackward = step > 1 && step < 5;

  const advance = () => {
    const problem = stepProblems[step]();
    if (problem) return setProblem(problem);
    if (step === 2 && driver && driver.vehicle !== vehicle) setDriverId(null);
    goToStep((step + 1) as Step);
  };

  const retreat = () => {
    if (canGoBackward) goToStep((step - 1) as Step);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 1 && step < 5) {
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
                  setVehicle(next as CharterVehicle);
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
              <Text style={styles.helperText}>
                {drivers.length > 0
                  ? `${drivers.length} ${vehicleNames[vehicle].toLowerCase()} driver${drivers.length === 1 ? "" : "s"} available on ${tripDate ? formatDate(tripDate) : "your date"}. Select one to continue.`
                  : "No drivers are available for this vehicle and group size."}
              </Text>

              <View style={styles.driverList}>
                {drivers.map((option) => (
                  <DriverCard
                    key={option.id}
                    driver={option}
                    selected={option.id === driverId}
                    onPress={() => {
                      setProblem("");
                      setDriverId(option.id);
                    }}
                  />
                ))}
              </View>

              <Problem message={problem} />
              <ModuleButton
                label="REVIEW BOOKING"
                onPress={advance}
                disabled={drivers.length === 0}
              />
            </>
          )}

          {step === 4 &&
            driver &&
            tripDate &&
            pickupTime &&
            pickup &&
            destination && (
            <>
              <SectionTitle
                icon={
                  <ClipboardList color="#ffffff" size={18} strokeWidth={2} />
                }
                title="Review your charter"
              />
              <View style={styles.reviewCard}>
                <ReviewRow label="Pickup" value={describePlace(pickup)} />
                <ReviewRow
                  label="Destination"
                  value={describePlace(destination)}
                />
                <ReviewRow
                  label="Trip"
                  value={
                    tripType === "round_trip" && returnDate
                      ? `Round trip · ${formatDate(tripDate)} – ${formatDate(returnDate)}`
                      : `One-way · ${formatDate(tripDate)}`
                  }
                />
                <ReviewRow label="Pickup time" value={formatTime(pickupTime)} />
                {tripType === "round_trip" && returnTime && (
                  <ReviewRow
                    label="Return pickup"
                    value={formatTime(returnTime)}
                  />
                )}
                <ReviewRow label="Occasion" value={occasion} />
                <ReviewRow
                  label="Passengers"
                  value={`${passengers} passenger${passengers === 1 ? "" : "s"}`}
                />
                <ReviewRow label="Vehicle" value={vehicleNames[vehicle]} />
                <ReviewRow
                  label="Driver"
                  value={`${driver.name} · ${driver.model} (${driver.plate})`}
                />
                {!!notes.trim() && (
                  <ReviewRow label="Notes" value={notes.trim()} />
                )}
              </View>
              <Text style={styles.helperText}>
                The driver will review and confirm your request before your
                trip.
              </Text>

              <ModuleButton
                label="CONFIRM BOOKING"
                onPress={() => goToStep(5)}
              />
            </>
          )}

          {step === 5 && driver && (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <CircleCheckBig color="#ffffff" size={44} strokeWidth={2} />
              </View>
              <Text style={styles.successTitle}>Charter request sent!</Text>
              <Text style={styles.successText}>
                We’ve sent your request to {driver.name}. You’ll be notified
                once they accept your trip.
              </Text>
              <View style={styles.successNote}>
                <PartyPopper color={brandBlue} size={18} strokeWidth={2} />
                <Text style={styles.infoText}>
                  {occasion === "Other"
                    ? "Enjoy your trip!"
                    : `Enjoy your ${occasion.toLowerCase()}!`}
                </Text>
              </View>
              <ModuleButton
                label="BACK TO HOME"
                onPress={() => router.replace(Routes.commuterHome)}
                style={styles.fullWidth}
              />
            </View>
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
          {step < 5 && (
            <StepProgress
              step={step}
              collapsed={chrome.collapsed}
              canGoBack={canGoBackward}
              canGoForward={canGoForward}
              onBack={retreat}
              onForward={advance}
            />
          )}
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

function DriverCard({
  driver,
  selected,
  onPress,
}: {
  driver: Driver;
  selected: boolean;
  onPress: () => void;
}) {
  const initials = driver.name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Driver ${driver.name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.driverCard,
          selected && styles.driverCardSelected,
          cardTransition,
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <View style={styles.ratingRow}>
            <Star color="#f5b301" fill="#f5b301" size={12} />
            <Text style={styles.driverMeta}>
              {driver.rating.toFixed(1)} · {driver.trips} trips
            </Text>
          </View>
          <Text style={styles.driverMeta}>
            {driver.model} · {driver.plate}
          </Text>
          <Text style={styles.driverMeta}>Seats up to {driver.seats}</Text>
        </View>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
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
  fullWidth: { alignSelf: "stretch" },
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
  helperText: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },
  driverList: { gap: 12, marginTop: 14 },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: softBlue,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  driverCardSelected: { borderColor: brandBlue, backgroundColor: "#f3f7ff" },
  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 14 },
  driverName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  driverMeta: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#c4c4c4",
    borderRadius: 10,
  },
  radioSelected: { borderColor: brandBlue },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: brandBlue,
  },
  reviewCard: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
  },
  reviewRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f7",
  },
  reviewLabel: {
    width: 90,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
  },
  reviewValue: {
    flex: 1,
    color: text,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 16,
    textAlign: "center",
  },
  success: { alignItems: "center", paddingTop: 36 },
  successIcon: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    backgroundColor: brandBlue,
  },
  successTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 20,
    marginTop: 18,
  },
  successText: {
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  successNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
});
