import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { BookingCard } from "@/components/BookingCard";
import { BookingDayHeader } from "@/components/BookingDayHeader";
import { BookingMasterRow } from "@/components/BookingMasterRow";
import { BookingPane } from "@/components/BookingPane";
import { BookingPassSheet } from "@/components/BookingPassSheet";
import { CancelBookingSheet } from "@/components/CancelBookingSheet";
import { Group } from "@/components/Group";
import { Pill } from "@/components/Pill";
import { Placeholder } from "@/components/Placeholder";
import { RefreshButton } from "@/components/RefreshButton";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import { useCancelBooking, useMyBookings } from "@/lib/api/bookings";
import { useLeaveWaitlist, useMyWaitlist } from "@/lib/api/waitlist";
import { useIsOffline } from "@/lib/net";
import { useToastStore } from "@/lib/toastStore";
import type { BookingScope, MyBooking, WaitlistEntryDetail } from "@/lib/api/types";
import { haptics } from "@/lib/haptics";
import { Calendar, RotateCw, WifiOff } from "@/lib/icons";
import { useHasDetailPane } from "@/lib/useBreakpoint";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useDetailSelection } from "@/lib/useDetailSelection";
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

function formatSeats(seats: number): string {
  return `${seats} ${seats === 1 ? "persona" : "personas"}`;
}

function ordinal(position: number): string {
  return `${position}.º`;
}

function isInProgress(booking: MyBooking): boolean {
  const now = Date.now();
  return (
    new Date(booking.startsAt).getTime() <= now && now < new Date(booking.endsAt).getTime()
  );
}

// Reservas handoff §2.4/§2.5d — day header for Próximas ("Hoy · mar 15" /
// "mié 16 de sep"), month header for Anteriores ("SEPTIEMBRE").
function dayHeaderLabel(startsAt: string): string {
  const d = new Date(startsAt);
  const isToday = d.toDateString() === new Date().toDateString();
  const weekdayDay = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  if (isToday) return `Hoy · ${weekdayDay}`;
  const month = d.toLocaleDateString("es-MX", { month: "short" });
  return `${weekdayDay} de ${month}`;
}

function monthHeaderLabel(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString("es-MX", { month: "long" }).toUpperCase();
}

interface BookingGroup {
  key: string;
  label: string;
  bookings: MyBooking[];
}

// §1: "Lo que agrupa es el día, no el espacio." Bookings are already sorted
// server-side (asc for upcoming, desc for past), so a Map preserves the
// right chronological group order for free.
function groupBookings(bookings: MyBooking[], mode: "day" | "month"): BookingGroup[] {
  const map = new Map<string, BookingGroup>();
  for (const booking of bookings) {
    const d = new Date(booking.startsAt);
    const key = mode === "day" ? d.toDateString() : `${d.getFullYear()}-${d.getMonth()}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: mode === "day" ? dayHeaderLabel(booking.startsAt) : monthHeaderLabel(booking.startsAt),
        bookings: [],
      });
    }
    map.get(key)!.bookings.push(booking);
  }
  return Array.from(map.values());
}

export default function BookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<BookingScope>("upcoming");
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [passBooking, setPassBooking] = useState<MyBooking | null>(null);
  // §2.6 — a confirmation sheet now gates the existing undo-toast flow;
  // tapping "Cancelar" no longer hides the row directly.
  const [confirmCancel, setConfirmCancel] = useState<MyBooking | null>(null);
  const userId = useUserId();

  // Desktop master–detail: the selected booking shows in a pane (with its QR
  // pass inline), the list stays mounted. Phone/tablet keep the BookingPassSheet.
  const hasPane = useHasDetailPane();
  const { selectedId, select, clear } = useDetailSelection();

  const bookingsQuery = useMyBookings(scope, userId);
  const waitlistQuery = useMyWaitlist(userId);
  const cancelBooking = useCancelBooking();
  const leaveWaitlist = useLeaveWaitlist();
  const offline = useIsOffline();
  const showSkeleton = useDelayedFlag(bookingsQuery.isLoading, 150);
  const isRefreshing =
    (bookingsQuery.isFetching && !bookingsQuery.isLoading) ||
    (waitlistQuery.isFetching && !waitlistQuery.isLoading);

  function handleRefresh() {
    bookingsQuery.refetch();
    waitlistQuery.refetch();
  }

  // Pending-cancel only masks the "upcoming" list — a real, already-cancelled
  // booking should still surface under "Anteriores".
  const bookings = (bookingsQuery.data ?? []).filter(
    (b) => scope !== "upcoming" || b.id !== pendingCancelId,
  );
  const waitlist = waitlistQuery.data ?? [];

  // The nearest upcoming booking gets variant="next" wherever its day group
  // lands — it's still filed under its own day header (§2.7: "la reserva en
  // curso ... el encabezado del día sigue siendo 'Hoy · mar 15'"), not pulled
  // out above the agenda.
  const nextBookingId = scope === "upcoming" ? bookings[0]?.id : undefined;
  const dayGroups = scope === "upcoming" ? groupBookings(bookings, "day") : [];
  const monthGroups = scope === "past" ? groupBookings(bookings, "month") : [];

  const selectedBooking =
    (hasPane && selectedId
      ? bookings.find((b) => b.id === selectedId)
      : undefined) ?? null;

  // §2.8: "la próxima reserva Y la seleccionada coinciden al entrar" — fires
  // once the desktop pane is available AND the bookings query has actually
  // resolved (nextBookingId is still undefined on the first render while
  // loading — a [hasPane]-only dependency array would fire too early and
  // never retry). The ref guard is what keeps this a one-time "on entering"
  // selection instead of re-forcing a pick every time the list changes or
  // the user closes the pane.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (
      !autoSelectedRef.current &&
      hasPane &&
      scope === "upcoming" &&
      !selectedId &&
      nextBookingId
    ) {
      autoSelectedRef.current = true;
      select(nextBookingId);
    }
  }, [hasPane, scope, selectedId, nextBookingId, select]);

  function handleScopeChange(next: BookingScope) {
    clear();
    setScope(next);
  }

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
    bookings.length === 0;
  const isEmptyState =
    (!showSkeleton && bookingsQuery.isError) || nothingUpcoming || nothingPast;

  function handleCancel(booking: MyBooking) {
    haptics.selection();
    setConfirmCancel(booking);
  }

  function handleConfirmCancel() {
    if (!confirmCancel) return;
    haptics.selection();
    setPendingCancelId(confirmCancel.id);
    setConfirmCancel(null);
  }

  function handleUndo() {
    setPendingCancelId(null);
  }

  // Handoff: "El DELETE se envía al expirar el toast, no antes." The toast's
  // natural auto-dismiss — not the sheet's confirm tap — is where the
  // request fires.
  function handleToastExpired() {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    // The real DELETE fires here (not on confirm). Offline it can't —
    // restore the row rather than queue it, so a long offline window can't
    // cancel a booking the user later decided to keep.
    if (offline) {
      setPendingCancelId(null);
      useToastStore.getState().show("Sin conexión — la reserva no se canceló");
      return;
    }
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

  function handleLeaveWaitlist(entry: WaitlistEntryDetail) {
    haptics.selection();
    leaveWaitlist.mutate(entry.id);
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

  function renderBooking(booking: MyBooking, variant: "next" | "default") {
    const inProgress = variant === "next" && isInProgress(booking);
    const schedule = formatSchedule(booking.startsAt, booking.endsAt);
    return (
      <BookingCard
        key={booking.id}
        variant={variant}
        resourceName={booking.resourceName}
        metaLabel={`${formatSeats(booking.seats)} · ${booking.locationName}`}
        startTimeLabel={inProgress ? "En curso" : timeOfDay(booking.startsAt)}
        endTimeLabel={inProgress ? `termina ${timeOfDay(booking.endsAt)}` : `– ${timeOfDay(booking.endsAt)}`}
        inProgress={inProgress}
        imageUrl={variant === "next" ? booking.imageUrl : undefined}
        onViewPass={() =>
          hasPane ? select(booking.id) : setPassBooking(booking)
        }
        viewPassAccessibilityLabel={`Ver pase de ${booking.resourceName}, ${schedule}`}
        onCancel={() => handleCancel(booking)}
        cancelAccessibilityLabel={`Cancelar reserva de ${booking.resourceName}, ${schedule}`}
        cancelLoading={shakeId === booking.id}
      />
    );
  }

  return (
    <Screen bg="canvas" fluid>
     <View style={{ flex: 1, flexDirection: "row" }}>
      {/* No maxWidth cap — fills whatever the pane (fixed 380px, only
          mounted when selectedBooking is set) doesn't take, so the row
          fills the real browser width instead of leaving a dead strip on
          wide monitors. */}
      <View style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-4 pt-3">
        <Text className={hasPane ? "text-title-master text-label-1" : "text-title-screen text-label-1"}>
          Reservas
        </Text>
        <RefreshButton onPress={handleRefresh} refreshing={isRefreshing} />
      </View>

      {/* `pb-4` keeps a gap below the pills while the list scrolls under it. */}
      <View className="flex-row gap-2 px-4 pb-4 pt-[22px]">
        <Pill
          active={scope === "upcoming"}
          label="Próximas"
          count={scope === "upcoming" ? bookings.length : undefined}
          size={hasPane ? "desktop" : "phone"}
          onPress={() => handleScopeChange("upcoming")}
        />
        <Pill
          active={scope === "past"}
          label="Anteriores"
          size={hasPane ? "desktop" : "phone"}
          onPress={() => handleScopeChange("past")}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingBottom: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={["transparent"]}
          />
        }
      >
        {/* §2.7: "Placeholder, centrado en el área de lista... las pestañas
            siguen visibles" — the empty/error states center vertically
            within the scrollable area (ScrollView's own flexGrow:1 gives
            them the room), real content stays top-aligned as always. These
            three states are always mutually exclusive with everything else
            in this stack, so flex:1+center never fights real rows. */}
        <View
          style={{
            gap: 22,
            opacity: isRefreshing ? 0.6 : 1,
            ...(isEmptyState ? { flex: 1, justifyContent: "center" } : null),
          }}
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
              icon={<WifiOff size={26} />}
              title="No pudimos cargar tus reservas"
              body="Revisa tu conexión e intenta de nuevo."
              secondaryAction={{
                label: "Reintentar",
                onPress: () => bookingsQuery.refetch(),
              }}
            />
          ) : null}

          {scope === "upcoming" && waitlist.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View className="flex-row items-center gap-2 pl-1">
                <Text
                  className="uppercase text-label-4"
                  style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.96 }}
                >
                  EN ESPERA
                </Text>
                {/* Representative badge — the soonest entry's position. Each
                    card's own meta line still states its own position in
                    text, so this stays correct even with several entries at
                    different spots in different lines. */}
                <StatusBadge
                  tone="waiting"
                  variant="solid"
                  label={`${ordinal(waitlist[0]!.position)} en fila`}
                />
              </View>
              <View style={{ gap: 10 }}>
                {waitlist.map((entry) => (
                  <BookingCard
                    key={entry.id}
                    variant="waitlist"
                    resourceName={entry.resourceName}
                    metaLabel={`Eres el ${ordinal(entry.position)} · ${entry.locationName}`}
                    startTimeLabel={timeOfDay(entry.startsAt)}
                    endTimeLabel={`– ${timeOfDay(entry.endsAt)}`}
                    onCancel={() => handleLeaveWaitlist(entry)}
                    cancelAccessibilityLabel={`Salir de la lista de espera de ${entry.resourceName}, ${formatSchedule(entry.startsAt, entry.endsAt)}`}
                    cancelLoading={leaveWaitlist.isPending && leaveWaitlist.variables === entry.id}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {scope === "upcoming"
            ? dayGroups.map((group) => (
                <View key={group.key} style={{ gap: 10 }}>
                  <BookingDayHeader label={group.label} />
                  <View style={{ gap: 10 }}>
                    {group.bookings.map((booking) =>
                      hasPane ? (
                        <BookingMasterRow
                          key={booking.id}
                          resourceName={booking.resourceName}
                          metaLabel={`${formatSeats(booking.seats)} · ${booking.locationName}`}
                          startTimeLabel={timeOfDay(booking.startsAt)}
                          selected={booking.id === selectedId}
                          onPress={() => select(booking.id)}
                        />
                      ) : (
                        renderBooking(booking, booking.id === nextBookingId ? "next" : "default")
                      ),
                    )}
                  </View>
                </View>
              ))
            : null}

          {scope === "past"
            ? monthGroups.map((group) => (
                <View key={group.key} style={{ gap: 10 }}>
                  <BookingDayHeader label={group.label} />
                  <View style={{ gap: 10 }}>
                    {group.bookings.map((booking) =>
                      hasPane ? (
                        <BookingMasterRow
                          key={booking.id}
                          resourceName={booking.resourceName}
                          metaLabel={`${dayHeaderLabel(booking.startsAt)} · ${formatSeats(booking.seats)}`}
                          startTimeLabel={timeOfDay(booking.startsAt)}
                          selected={booking.id === selectedId}
                          onPress={() => select(booking.id)}
                        />
                      ) : (
                        <BookingCard
                          key={booking.id}
                          variant="past"
                          resourceName={booking.resourceName}
                          metaLabel={`${dayHeaderLabel(booking.startsAt)} · ${formatSeats(booking.seats)}`}
                          startTimeLabel={timeOfDay(booking.startsAt)}
                          endTimeLabel={`– ${timeOfDay(booking.endsAt)}`}
                          onRepeat={() => handleRepeat(booking)}
                          repeatAccessibilityLabel={`Repetir reserva de ${booking.resourceName}`}
                        />
                      ),
                    )}
                  </View>
                </View>
              ))
            : null}

          {nothingUpcoming ? (
            <Placeholder
              reason="noBookings"
              icon={<Calendar size={26} />}
              title="Nada apartado todavía"
              body="Busca un espacio y apártalo en un tap."
              primaryAction={{
                label: "Explorar espacios",
                onPress: () => router.navigate("/"),
              }}
            />
          ) : null}

          {nothingPast ? (
            <Placeholder
              reason="noHistory"
              icon={<RotateCw size={26} />}
              title="Aún sin historial"
              body="Cuando termine una reserva aparecerá aquí, lista para repetir."
            />
          ) : null}
        </View>
      </ScrollView>
      </View>

      {selectedBooking ? (
        <BookingPane
          booking={selectedBooking}
          scope={scope}
          onClose={clear}
          onCancel={(b) => {
            clear();
            handleCancel(b);
          }}
          onRepeat={(b) => {
            clear();
            handleRepeat(b);
          }}
          onViewFullPass={(b) => setPassBooking(b)}
        />
      ) : null}
     </View>

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
        checkedInAt={passBooking?.checkedInAt ?? null}
      />

      <CancelBookingSheet
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        resourceName={confirmCancel?.resourceName ?? null}
        scheduleLabel={
          confirmCancel ? formatSchedule(confirmCancel.startsAt, confirmCancel.endsAt) : null
        }
        onConfirm={handleConfirmCancel}
      />

      <Toast
        isOpen={!!pendingCancelId}
        message="Reserva cancelada"
        actionLabel="Deshacer"
        durationMs={5000}
        raised
        onAction={handleUndo}
        onDismiss={handleToastExpired}
      />
    </Screen>
  );
}
