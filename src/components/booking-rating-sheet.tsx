import { useEffect, useState } from "react";

import type { Booking } from "@/api/v1/pickups/controllers";
import { loadMyRental, type Rental } from "@/api/v1/rentals/controllers";
import { RateDriversModal } from "@/components/rate-drivers-modal";

/** Rates the hired drivers of a completed rental from Bookings. */
export function BookingRatingSheet({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: (rated: number) => void;
}) {
  const [rental, setRental] = useState<Rental | null>(null);

  useEffect(() => {
    let active = true;
    loadMyRental(booking.id).then((result) => {
      if (!active) return;
      if (result.ok && result.data) setRental(result.data);
      else onClose(0);
    });
    return () => {
      active = false;
    };
  }, [booking.id, onClose]);

  if (!rental) return null;
  return <RateDriversModal key={rental.id} rental={rental} onClose={onClose} />;
}
