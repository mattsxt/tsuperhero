import ClipboardList from "lucide-react-native/icons/clipboard-list";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { loadBookings, type Booking } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { homeColors, SectionHeader } from "@/components/home-ui";
import { BookingRatingSheet } from "@/components/booking-rating-sheet";
import { Routes } from "@/constants/routes";
import { BookingCard, formatBookingDate } from "@/pages/commuter/bookings/page";
import { BookingDetailsModal } from "@/pages/commuter/bookings/booking-details";

const { brandBlue } = homeColors;

export function RecentBookings({ limit }: { limit: number }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [rating, setRating] = useState<Booking | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    loadBookings().then((result) => {
      if (active) setBookings(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  const closeRating = useCallback(
    (rated: number) => {
      // Fewer drivers left to rate on this booking.
      if (rating && rated > 0) {
        const id = rating.id;
        setBookings((list) =>
          (list ?? []).map((booking) =>
            booking.id === id
              ? {
                  ...booking,
                  driversToRate: Math.max(0, booking.driversToRate - rated),
                }
              : booking,
          ),
        );
      }
      setRating(null);
    },
    [rating],
  );

  const unrated = (bookings ?? []).filter(
    (booking) => booking.kind === "rental" && booking.driversToRate > 0,
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
              onOpen={() => setDetails(booking)}
            />
          ))}
        </View>
      )}
      <BookingDetailsModal
        booking={details}
        formatDate={formatBookingDate}
        onClose={() => setDetails(null)}
        onRate={() => {
          setRating(details);
          setDetails(null);
        }}
      />
      {rating && <BookingRatingSheet booking={rating} onClose={closeRating} />}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  list: { gap: 10, marginTop: 4 },
});
