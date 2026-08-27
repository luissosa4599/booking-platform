import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { Group } from "@/components/Group";
import { Placeholder } from "@/components/Placeholder";
import { Row } from "@/components/Row";
import { ScreenFade } from "@/components/ScreenFade";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { useCancelBooking, useMyBookings } from "@/lib/api/bookings";
import type { BookingScope, MyBooking } from "@/lib/api/types";
import { haptics } from "@/lib/haptics";
import { CalendarX } from "@/lib/icons";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useReduceMotion } from "@/lib/useReduceMotion";
import { demoUserId } from "@/lib/userId";

function formatSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const isToday = start.toDateString() === new Date().toDateString();
  const dayLabel = isToday
    ? "Hoy"
    : start.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dayLabel} ${startTime} – ${endTime}`;
}

interface BookingRowProps {
  booking: MyBooking;
  canCancel: boolean;
  onCancel: () => void;
  shaking: boolean;
}

function BookingRow({
  booking,
  canCancel,
  onCancel,
  shaking,
}: BookingRowProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (!shaking || reduceMotion) {
      return;
    }
    // Same 4-value shake used by Stepper's "at max" feedback, just a wider
    // 6px throw — handoff: "la tarjeta vuelve con un shake de 6 px" for a
    // cancellation that failed server-side.
    shakeX.value = withSequence(
      withTiming(-6, { duration: 30 }),
      withTiming(6, { duration: 30 }),
      withTiming(-6, { duration: 30 }),
      withTiming(0, { duration: 30 }),
    );
  }, [shaking, shakeX, reduceMotion]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value + 0 }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      exiting={FadeOut}
      style={shakeStyle}
    >
      <Row
        title={booking.resourceName}
        subtitle={`${booking.locationName} · ${formatSchedule(booking.startsAt, booking.endsAt)}`}
        trailing={canCancel ? "action" : "none"}
        actionLabel="Cancelar"
        actionTone="wash"
        actionAccessibilityLabel={`Cancelar reserva de ${booking.resourceName}, ${formatSchedule(booking.startsAt, booking.endsAt)}`}
        onActionPress={onCancel}
      />
    </Animated.View>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<BookingScope>("upcoming");
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  const bookingsQuery = useMyBookings(scope, demoUserId);
  const cancelBooking = useCancelBooking();
  const showSkeleton = useDelayedFlag(bookingsQuery.isLoading, 150);

  // Only meaningful for "upcoming" — cancelling only ever happens from that
  // list, and a pending id should never mask a real, already-cancelled
  // booking from showing up in "past" once the user switches tabs.
  const bookings = (bookingsQuery.data ?? []).filter(
    (b) => scope !== "upcoming" || b.id !== pendingCancelId,
  );
  const isEmpty =
    !bookingsQuery.isLoading && !bookingsQuery.isError && bookings.length === 0;

  function handleCancel(booking: MyBooking) {
    haptics.selection();
    setPendingCancelId(booking.id);
  }

  function handleUndo() {
    setPendingCancelId(null);
  }

  // Handoff § "05 · BookingsScreen": "El DELETE se envía al expirar el
  // toast, no antes." So this — the toast's natural auto-dismiss, not the
  // cancel tap — is the moment the real request fires. Undo (handleUndo)
  // never reaches this at all; there's nothing to abort or roll back.
  function handleToastExpired() {
    if (!pendingCancelId) {
      return;
    }
    const id = pendingCancelId;
    cancelBooking.mutate(id, {
      // Patch the "upcoming" cache directly instead of only invalidating it:
      // invalidation kicks off a refetch that resolves on its own timeline,
      // and clearing `pendingCancelId` in `onSettled` below happens before
      // that resolves — which left a real gap where the stale (pre-cancel)
      // cached list briefly rendered the just-cancelled row again. Patching
      // here removes it from the exact same render pass, no race to time.
      onSuccess: () => {
        queryClient.setQueryData<MyBooking[]>(
          ["bookings", { scope: "upcoming", userId: demoUserId }],
          (old) => (old ?? []).filter((b) => b.id !== id),
        );
      },
      onError: () => {
        haptics.error();
        setShakeId(id);
        setTimeout(() => setShakeId(null), 150);
      },
      onSettled: () => setPendingCancelId(null),
    });
  }

  return (
    <ScreenFade>
      <View className="flex-1 bg-canvas">
        <View className="px-4 pt-3">
          <Text className="text-title-lg text-label-1">Reservas</Text>
        </View>

        <View className="px-4 pt-[22px]">
          <SegmentedControl
            options={[
              { label: "Próximas", value: "upcoming" },
              { label: "Anteriores", value: "past" },
            ]}
            value={scope}
            onChange={(v) => setScope(v as BookingScope)}
          />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 20, padding: 16 }}
        >
          {showSkeleton ? (
            <Group>
              <Animated.View exiting={FadeOut.duration(200)}>
                <Skeleton />
              </Animated.View>
              <Animated.View exiting={FadeOut.duration(200)}>
                <Skeleton />
              </Animated.View>
            </Group>
          ) : null}

          {!showSkeleton && bookingsQuery.isError ? (
            <Placeholder
              reason="offline"
              icon={<CalendarX size={26} />}
              title="Sin conexión"
              body="No pudimos cargar tus reservas. Revisa tu conexión e intenta de nuevo."
              primaryAction={{
                label: "Reintentar",
                onPress: () => bookingsQuery.refetch(),
              }}
            />
          ) : null}

          {!showSkeleton && !bookingsQuery.isError && isEmpty ? (
            <Placeholder
              reason={scope === "upcoming" ? "noBookings" : "noHistory"}
              icon={<CalendarX size={26} />}
              title={
                scope === "upcoming"
                  ? "Nada por aquí todavía"
                  : "Todavía no tienes historial"
              }
              body={
                scope === "upcoming"
                  ? "Cuando reserves un espacio, aparecerá aquí."
                  : "Tus reservas pasadas y canceladas aparecerán aquí."
              }
              primaryAction={{
                label: "Explorar espacios",
                // `.navigate`, not `.push` — this and Explorar are sibling
                // tabs now, so this should switch tabs, not stack a new
                // screen on top.
                onPress: () => router.navigate("/"),
              }}
            />
          ) : null}

          {!showSkeleton && !bookingsQuery.isError && bookings.length > 0 ? (
            <Group>
              {bookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  canCancel={scope === "upcoming"}
                  onCancel={() => handleCancel(booking)}
                  shaking={shakeId === booking.id}
                />
              ))}
            </Group>
          ) : null}
        </ScrollView>
      </View>

      <Toast
        isOpen={!!pendingCancelId}
        message="Reserva cancelada"
        actionLabel="Deshacer"
        durationMs={5000}
        onAction={handleUndo}
        onDismiss={handleToastExpired}
      />
    </ScreenFade>
  );
}
