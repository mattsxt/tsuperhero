import ClipboardList from "lucide-react-native/icons/clipboard-list";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { loadBookings, type Booking } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { homeColors, SectionHeader } from "@/components/home-ui";
import { RateTripModal } from "@/components/star-rating";
import { Routes } from "@/constants/routes";
import { BookingCard } from "@/pages/commuter/bookings/page";

const { brandBlue } = homeColors;

export function RecentBookings({ limit }: { limit: number }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [rating, setRating] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    loadBookings().then((result) => {
      if (active) setBookings(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  const saveRating = (score: number, feedback: string) => {
    if (!rating) return;
    const id = rating.id;
    setBookings((current) =>
      (current ?? []).map((booking) =>
        booking.id === id
          ? { ...booking, rating: { score, feedback: feedback || null } }
          : booking,
      ),
    );
    setRating(null);
  };

  const unrated = (bookings ?? []).filter(
    (booking) => booking.kind === "rental" && !booking.rating,
  ).length;

  return (
    <View>
      <SectionHeader
        title="My Bookings"
        icon={<ClipboardList color="#ffffff" size={16} strokeWidth={2} />}
        count={unrated}
        action={{
          label: "See all",
          onPress: () => router.push(Routes.commuterBookings),
        }}
      />
      {bookings === null ? (
        <LoadingLogo size={28} style={styles.loading} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<ClipboardList color={brandBlue} size={32} strokeWidth={1.8} />}
          message="Your completed rentals and pickups will appear here."
        />
      ) : (
        <View style={styles.list}>
          {bookings.slice(0, limit).map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onRate={() => setRating(booking)}
            />
          ))}
        </View>
      )}
      <RateTripModal
        target={
          rating
            ? {
                id: rating.id,
                title: rating.destination,
                subtitle: rating.driverName ?? "",
              }
            : null
        }
        onClose={() => setRating(null)}
        onRated={saveRating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  list: { gap: 10, marginTop: 4 },
});
