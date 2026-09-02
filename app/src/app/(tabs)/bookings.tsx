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

import { BookingPassSheet } from "@/components/BookingPassSheet";
import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Placeholder } from "@/components/Placeholder";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { useCancelBooking, useMyBookings } from "@/lib/api/bookings";
import { useMyWaitlist } from "@/lib/api/waitlist";
import type { BookingScope, MyBooking } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { CalendarX } from "@/lib/icons";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useReduceMotion } from "@/lib/useReduceMotion";
import { useUserId } from "@/lib/session";

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const isToday = start.toDateString() === new Date().toDateString();
  const dayLabel = isToday
    ? "Hoy"
    : start.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  return `${dayLabel} ${timeOfDay(startsAt)} – ${timeOfDay(endsAt)}`;
}

// Handoff § "05": "Cuenta atrás ... 'En 2 h 15 min'. Solo se muestra si falta
// menos de 24 h; si no, la fecha ocupa su lugar."
function formatCountdown(startsAt: string): string | null {
  const diffMs = new Date(startsAt).getTime() - Date.now();
  if (diffMs <= 0 || diffMs >= 24 * 60 * 60 * 1000) return null;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `En ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `En ${h} h` : `En ${h} h ${m} min`;
}

function formatCardDate(startsAt: string): string {
  const d = new Date(startsAt);
  const day = d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
  });
  return `${day} · ${timeOfDay(startsAt)}`;
}

function formatSeats(seats: number): string {
  return `${seats} ${seats === 1 ? "persona" : "personas"}`;
}

function formatHistoryLine(booking: MyBooking): string {
  const date = new Date(booking.startsAt).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
  const state = booking.status === "Cancelled" ? "cancelada" : "completada";
  return `${date} · ${state}`;
}

function ordinal(position: number): string {
  return `${position}.º`;
}

// Shared shake for a cancellation that failed server-side — handoff: "la
// tarjeta vuelve con un shake de 6 px".
function useShake(active: boolean) {
  "use no memo";
  const reduceMotion = useReduceMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) return;
    x.value = withSequence(
      withTiming(-6, { duration: 30 }),
      withTiming(6, { duration: 30 }),
      withTiming(-6, { duration: 30 }),
      withTiming(0, { duration: 30 }),
    );
  }, [active, reduceMotion, x]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value + 0 }] }));
}

function NextBookingCard({
  booking,
  shaking,
  onShowPass,
  onCancel,
}: {
  booking: MyBooking;
  shaking: boolean;
  onShowPass: () => void;
  onCancel: () => void;
}) {
  const shakeStyle = useShake(shaking);
  const countdown = formatCountdown(booking.startsAt);

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      exiting={FadeOut.duration(200)}
      style={shakeStyle}
    >
      <View className="gap-4 rounded-group bg-card p-4 py-[18px]">
        <Text
          className={cn(
            "text-subhead font-semibold",
            countdown ? "text-tint" : "text-label-3",
          )}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {countdown ?? formatCardDate(booking.startsAt)}
        </Text>

        <View className="gap-[3px]">
          <Text className="text-title-sm text-label-1">
            {booking.resourceName}
          </Text>
          <Text
            className="text-body text-label-3"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatSchedule(booking.startsAt, booking.endsAt)} ·{" "}
            {formatSeats(booking.seats)}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button variant="dark" onPress={onShowPass}>
              Ver pase
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="gray"
              onPress={onCancel}
              accessibilityLabel={`Cancelar reserva de ${booking.resourceName}, ${formatSchedule(booking.startsAt, booking.endsAt)}`}
            >
              Cancelar
            </Button>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function CancelableRow({
  booking,
  shaking,
  onCancel,
}: {
  booking: MyBooking;
  shaking: boolean;
  onCancel: () => void;
}) {
  const shakeStyle = useShake(shaking);

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      exiting={FadeOut}
      style={shakeStyle}
    >
      <Row
        title={booking.resourceName}
        subtitle={`${booking.locationName} · ${formatSchedule(booking.startsAt, booking.endsAt)}`}
        trailing="action"
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
  const [passBooking, setPassBooking] = useState<MyBooking | null>(null);
  const userId = useUserId();

  const bookingsQuery = useMyBookings(scope, userId);
  const waitlistQuery = useMyWaitlist(userId);
  const cancelBooking = useCancelBooking();
  const showSkeleton = useDelayedFlag(bookingsQuery.isLoading, 150);

  // Pending-cancel only masks the "upcoming" list — a real, already-cancelled
  // booking should still surface under "Anteriores".
  const bookings = (bookingsQuery.data ?? []).filter(
    (b) => scope !== "upcoming" || b.id !== pendingCancelId,
  );
  const waitlist = waitlistQuery.data ?? [];

  const nextBooking = scope === "upcoming" ? bookings[0] : undefined;
  const otherUpcoming = scope === "upcoming" ? bookings.slice(1) : [];
  const history = scope === "past" ? bookings : [];

  const nothingUpcoming =
    scope === "upcoming" &&
    !bookingsQuery.isLoading &&
    !bookingsQuery.isError &&
    bookings.length === 0 &&
    waitlist.length === 0;
  const nothingPast =
    scope === "past" &&
    !bookingsQuery.isLoading &&
    !bookingsQuery.isError &&
    history.length === 0;

  function handleCancel(booking: MyBooking) {
    haptics.selection();
    setPendingCancelId(booking.id);
  }

  function handleUndo() {
    setPendingCancelId(null);
  }

  // Handoff: "El DELETE se envía al expirar el toast, no antes." The toast's
  // natural auto-dismiss — not the Cancelar tap — is where the request fires.
  function handleToastExpired() {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    cancelBooking.mutate(id, {
      onSuccess: () => {
        queryClient.setQueryData<MyBooking[]>(
          ["bookings", { scope: "upcoming", userId }],
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

  // Handoff "Repetir": preload same resource / time-of-day / party size and go
  // straight to the detail with everything preselected. ResourceScreen reads
  // `repeatTime` / `repeatSeats` and selects the matching slot on the first day
  // that has one.
  function handleRepeat(booking: MyBooking) {
    haptics.selection();
    router.push({
      pathname: "/resource/[id]",
      params: {
        id: booking.resourceId,
        name: booking.resourceName,
        location: booking.locationName,
        repeatTime: timeOfDay(booking.startsAt),
        repeatSeats: String(booking.seats),
      },
    });
  }

  return (
    <Screen bg="canvas">
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
        contentContainerStyle={{ gap: 22, padding: 16 }}
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

        {nextBooking ? (
          <NextBookingCard
            booking={nextBooking}
            shaking={shakeId === nextBooking.id}
            onShowPass={() => setPassBooking(nextBooking)}
            onCancel={() => handleCancel(nextBooking)}
          />
        ) : null}

        {otherUpcoming.length > 0 ? (
          <Group>
            {otherUpcoming.map((booking) => (
              <CancelableRow
                key={booking.id}
                booking={booking}
                shaking={shakeId === booking.id}
                onCancel={() => handleCancel(booking)}
              />
            ))}
          </Group>
        ) : null}

        {scope === "upcoming" && waitlist.length > 0 ? (
          <Group header="EN ESPERA">
            {waitlist.map((entry) => (
              <Row
                key={entry.id}
                title={entry.resourceName}
                subtitle={`${entry.locationName} · ${formatSchedule(entry.startsAt, entry.endsAt)}`}
                meta={`En espera · eres el ${ordinal(entry.position)}`}
                metaTone="waiting"
                trailing="chevron"
                onPress={() =>
                  router.push({
                    pathname: "/resource/[id]",
                    params: {
                      id: entry.resourceId,
                      name: entry.resourceName,
                      location: entry.locationName,
                    },
                  })
                }
                accessibilityLabel={`Lista de espera para ${entry.resourceName}, ${formatSchedule(entry.startsAt, entry.endsAt)}, eres el ${ordinal(entry.position)}`}
              />
            ))}
          </Group>
        ) : null}

        {scope === "past" && history.length > 0 ? (
          <Group header="ESTE MES">
            {history.map((booking) => (
              <Row
                key={booking.id}
                title={booking.resourceName}
                subtitle={formatHistoryLine(booking)}
                trailing="action"
                actionLabel="Repetir"
                actionTone="wash"
                actionAccessibilityLabel={`Repetir reserva de ${booking.resourceName}`}
                onActionPress={() => handleRepeat(booking)}
              />
            ))}
          </Group>
        ) : null}

        {nothingUpcoming ? (
          <Placeholder
            reason="noBookings"
            icon={<CalendarX size={26} />}
            title="Nada por aquí todavía"
            body="Cuando reserves un espacio, aparecerá aquí."
            primaryAction={{
              label: "Explorar espacios",
              onPress: () => router.navigate("/"),
            }}
          />
        ) : null}

        {nothingPast ? (
          <Placeholder
            reason="noHistory"
            icon={<CalendarX size={26} />}
            title="Todavía no tienes historial"
            body="Tus reservas pasadas y canceladas aparecerán aquí."
            primaryAction={{
              label: "Explorar espacios",
              onPress: () => router.navigate("/"),
            }}
          />
        ) : null}
      </ScrollView>

      <BookingPassSheet
        isOpen={!!passBooking}
        onClose={() => setPassBooking(null)}
        code={passBooking?.code ?? null}
        resourceName={passBooking?.resourceName ?? null}
        schedule={
          passBooking
            ? formatSchedule(passBooking.startsAt, passBooking.endsAt)
            : null
        }
      />

      <Toast
        isOpen={!!pendingCancelId}
        message="Reserva cancelada"
        actionLabel="Deshacer"
        durationMs={5000}
        onAction={handleUndo}
        onDismiss={handleToastExpired}
      />
    </Screen>
  );
}
