import { StatusBar } from "expo-status-bar";
import Armchair from "lucide-react-native/icons/armchair";
import Bell from "lucide-react-native/icons/bell";
import Bus from "lucide-react-native/icons/bus";
import BusFront from "lucide-react-native/icons/bus-front";
import CircleHelp from "lucide-react-native/icons/circle-question-mark";
import FileText from "lucide-react-native/icons/file-text";
import Flag from "lucide-react-native/icons/flag";
import Footprints from "lucide-react-native/icons/footprints";
import Inbox from "lucide-react-native/icons/inbox";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinSearch from "lucide-react-native/icons/map-pin-search";
import MapPinX from "lucide-react-native/icons/map-pin-x";
import Play from "lucide-react-native/icons/play";
import Star from "lucide-react-native/icons/star";
import UserPlus from "lucide-react-native/icons/user-plus";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Accordion } from "heroui-native";

import { peekSignedInHomeRoute } from "@/api/v1/profile/controllers";
import { ModuleHeader } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const hero = {
  background: "#f4f4f5",
  surface: "#ffffff",
  foreground: "#18181b",
  muted: "#71717a",
  separator: "#e4e4e7",
};

type Role = "commuter" | "driver";

const topicIcons: Record<string, typeof Bell> = {
  "Find a route": MapPinSearch,
  "Request a pickup": MapPin,
  "Get to your pickup point": Footprints,
  "When a driver accepts": BusFront,
  "Share a ride with someone": UserPlus,
  "Join someone's shared ride": UsersRound,
  "Cancel a pickup": MapPinX,
  "Rent a vehicle": Bus,
  "Location and notifications": Bell,
  "Your account": UserRound,
  "Start a trip": Play,
  "Pick up commuters": Users,
  "Manage seats": Armchair,
  "End a trip": Flag,
  "Rental jobs": Inbox,
  "Ratings and history": Star,
  "Your vehicle and account": FileText,
};

const accordionAnimation = {
  layout: {
    value: LinearTransition.duration(220).easing(Easing.out(Easing.cubic)),
  },
};

type Topic = { title: string; steps: string[] };

const guides: Record<Role, Topic[]> = {
  commuter: [
    {
      title: "Find a route",
      steps: [
        "On Home, tap the search bar and type where you want to go.",
        "Pick a route or place to see it on the map, with the jeepneys and tricycles serving it.",
        "Open Routes to browse every route and see vehicles moving on them live.",
      ],
    },
    {
      title: "Request a pickup",
      steps: [
        "Open Pickup and choose where you want to be picked up: search a place, tap the location button to use where you are, or pin a spot on the map.",
        "For jeepneys, the app suggests the nearest registered waiting area on the route. You can use it or keep your own spot.",
        "Choose the vehicle and the number of passengers. The count includes you: up to 10 for a jeepney, 4 for a tricycle.",
        "Tap Confirm. Your request is created, and the screen shows the route to your pickup point.",
      ],
    },
    {
      title: "Get to your pickup point",
      steps: [
        "Drivers only see your request once you are at the pickup point, so follow the route on the map.",
        "When you arrive, the badge changes to Visible to drivers and nearby drivers are notified.",
        "Sharing a ride? Drivers see your request only once you and every companion who accepted are at the pickup point.",
        "Stay close. If you walk more than 150 m away for over 2 minutes, drivers stop seeing your request until you come back.",
        "If no driver accepts after 10 minutes, the app suggests cancelling and trying another vehicle type.",
      ],
    },
    {
      title: "When a driver accepts",
      steps: [
        "You'll see the driver's plate number, vehicle and estimated time of arrival.",
        "Watch the vehicle approach on the map and wait at the pickup point.",
        "Once you board, your trip is added to Bookings, where you can rate it.",
      ],
    },
    {
      title: "Share a ride with someone",
      steps: [
        "Under Share a Ride?, search for another commuter by name or email, select them, then tap the send button.",
        "Their name shows as a chip: grey while waiting, green once they accept, red if they decline.",
        "You can confirm the pickup once everyone has answered, or after you remove anyone who hasn't.",
        "While an invitation is waiting for a reply, the pickup location is locked. If you change it after people accepted, they are asked to approve the new location.",
        "The pickup screen shows whether each companion is on the way or already at the pickup point.",
      ],
    },
    {
      title: "Join someone's shared ride",
      steps: [
        "When someone invites you, a card appears with their name, the pickup point and the passenger count. Tap View on map to see the route from where you are.",
        "If you accept, Pickup shows Your shared ride with its status: Waiting for confirmation, Waiting for a driver, or Driver on the way.",
        "Head to the pickup point. Your companion can see when you get there.",
        "While you're in a shared ride, you can't request your own pickup. Tap Leave shared ride first; your companion is notified.",
      ],
    },
    {
      title: "Cancel a pickup",
      steps: [
        "On the pickup screen, tap Cancel Request, then confirm.",
        "Anyone sharing the ride with you is notified, and the request form is cleared so you can start again.",
      ],
    },
    {
      title: "Rent a vehicle",
      steps: [
        "Open Rental and enter the pickup location, destination, date, time, occasion and number of passengers.",
        "Choose how many of each vehicle you need: jeepneys, vans, buses or tricycles, in any mix up to 10. Check the summary, then tap Post Request.",
        "Your request goes on the job board for drivers of those vehicles. Each vehicle is booked by its own driver, and you'll be notified as each one accepts, with their name and plate number.",
        "Rental shows your request while it waits and once it's booked. You can call your drivers or cancel from there, and tap Mark as Completed after the trip.",
        "You can have one request at a time: while a rental is active you can't request a pickup, and the other way around.",
      ],
    },
    {
      title: "Location and notifications",
      steps: [
        "The app needs your location to show routes to your pickup point and confirm you've arrived.",
        "If you turned location off for the app, tap Open Settings on the pickup screen to allow it again.",
        "Notifications tell you when a driver accepts, when companions reply, and when a ride is cancelled.",
      ],
    },
    {
      title: "Your account",
      steps: [
        "Edit your name, contact number, birth date and photo from Profile.",
        "Change your password under Security.",
        "Signing out cancels a pickup in progress or leaves a shared ride. The app asks you first.",
      ],
    },
  ],
  driver: [
    {
      title: "Start a trip",
      steps: [
        "From Home, open Start Trip. The map shows your route and your vehicle.",
        "Allow location access, including all the time, so commuters can see your vehicle even when the app is in the background.",
        "Tap START to begin. Your location is shared while the trip is active.",
        "If you have a booked rental, regular trips are paused from 1 hour before to 1 hour after its pickup time (and its return pickup on round trips).",
      ],
    },
    {
      title: "Pick up commuters",
      steps: [
        "Pickup requests near you appear as cards above the trip panel. Commuters only appear once they are at their pickup point.",
        "Each card shows the number of passengers and how far away they are. Accept it if you have enough seats.",
        "Drive to the pickup point. Passengers are counted as boarded when you reach them.",
      ],
    },
    {
      title: "Manage seats",
      steps: [
        "Use the passenger counter to add or remove passengers as they get on and off.",
        "Tap FULL to stop receiving new requests, and tap it again when you have seats.",
      ],
    },
    {
      title: "End a trip",
      steps: [
        "Tap STOP when you finish your route, then confirm.",
        "The trip is saved to Trip History with the distance covered.",
      ],
    },
    {
      title: "Rental jobs",
      steps: [
        "Open Rental Jobs to see the job board: charter trips commuters posted for your type of vehicle.",
        "Tap a job to see the details, then Accept Job to take it, or Not Interested to remove it from your board. The first driver to accept gets the trip.",
        "Accepted jobs are saved in My jobs, and the commuter is notified. Jobs that clash with one you already have are marked.",
        "Tap a job in My jobs to see the trip, the other vehicles and the commuter's contact. The commuter marks the rental as completed after the trip.",
      ],
    },
    {
      title: "Ratings and history",
      steps: [
        "Your average rating and recent feedback appear on Home.",
        "Trip History lists your past trips. Filter by all trips, this week or this month.",
      ],
    },
    {
      title: "Your vehicle and account",
      steps: [
        "Keep your vehicle details and documents up to date under Profile, then Vehicles & Documents.",
        "Change your password under Security. Stop any active trip before signing out.",
      ],
    },
  ],
};

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [role] = useState<Role>(() =>
    peekSignedInHomeRoute() === Routes.transitHome ? "driver" : "commuter",
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <Accordion
            variant="surface"
            selectionMode="single"
            isCollapsible
            animation={accordionAnimation}
            styles={{ container: styles.card, separator: styles.separator }}
          >
            {guides[role].map((topic) => {
              const Icon = topicIcons[topic.title] ?? CircleHelp;
              return (
                <Accordion.Item
                  key={topic.title}
                  value={topic.title}
                  style={styles.item}
                >
                  <Accordion.Trigger style={styles.trigger}>
                    <View style={styles.topicRow}>
                      <Icon color={hero.muted} size={16} strokeWidth={2} />
                      <Text style={styles.topicTitle}>{topic.title}</Text>
                    </View>
                    <Accordion.Indicator
                      style={styles.indicator}
                      iconProps={{ color: hero.muted, size: 16 }}
                    />
                  </Accordion.Trigger>
                  <Accordion.Content style={styles.content}>
                    <Text style={styles.stepText}>
                      {topic.steps.map((step) => `•  ${step}`).join("\n\n")}
                    </Text>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Help"
          subtitle={
            role === "driver"
              ? "Learn how to run trips and handle requests, step by step."
              : "Learn how to find routes and request pickups, step by step."
          }
          icon={<CircleHelp color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={() => goBackOr(Routes.profile)}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: hero.background },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    flexDirection: "column",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: hero.surface,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: hero.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  separator: {
    height: 1,
    marginHorizontal: 12,
    backgroundColor: hero.separator,
  },
  item: { flexDirection: "column", overflow: "hidden" },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  topicRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  topicTitle: {
    flex: 1,
    color: hero.foreground,
    fontFamily: "Sora",
    fontSize: 14,
    lineHeight: 20,
  },
  indicator: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  stepText: {
    paddingLeft: 28,
    color: hero.muted,
    fontFamily: "Sora",
    fontSize: 13,
    lineHeight: 20,
  },
});
