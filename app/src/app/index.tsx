import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { useRouter } from "expo-router";

import { ConflictSheet } from "@/components/ConflictSheet";
import { FilterPills, type FilterPillOption } from "@/components/FilterPills";
import { Group } from "@/components/Group";
import { Placeholder } from "@/components/Placeholder";
import { Row } from "@/components/Row";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { useAvailability } from "@/lib/api/availability";
import { useCreateBooking } from "@/lib/api/bookings";
import { useResourceTypes } from "@/lib/api/resourceTypes";
import type { AvailabilitySlot } from "@/lib/api/types";
import { haptics } from "@/lib/haptics";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useToastStore } from "@/lib/toastStore";
import { demoUserId } from "@/lib/userId";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function withId(set: Set<string>, id: string) {
  const next = new Set(set);
  next.add(id);
  return next;
}

function withoutId(set: Set<string>, id: string) {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export default function ExploreScreen() {
  const router = useRouter();
  const [selectedResourceTypeId, setSelectedResourceTypeId] = useState<string | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<Set<string>>(new Set());
  const [confirmedSlotIds, setConfirmedSlotIds] = useState<Set<string>>(new Set());
  const [dismissedSlotIds, setDismissedSlotIds] = useState<Set<string>>(new Set());
  // Shared (not local) so a booking made from ResourceScreen can show its
  // success toast here after navigating back — see lib/toastStore.ts.
  const toastMessage = useToastStore((s) => s.message);

  // Captured once per mount — a slight drift against a live clock over a long
  // session is fine, the query itself refetches every 60s regardless.
  const now = useMemo(() => new Date(), []);
  const endOfToday = useMemo(() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [now]);

  const resourceTypesQuery = useResourceTypes();
  const availabilityQuery = useAvailability({
    resourceTypeId: selectedResourceTypeId,
    from: now,
    to: endOfToday,
  });
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (createBooking.isConflict) {
      haptics.error();
    }
  }, [createBooking.isConflict]);

  const showSkeleton = useDelayedFlag(availabilityQuery.isLoading, 150);
  const isRefreshing = availabilityQuery.isFetching && !availabilityQuery.isLoading;

  const filterOptions: FilterPillOption[] = useMemo(
    () => [
      { id: null, label: "Cualquiera" },
      ...(resourceTypesQuery.data ?? []).map((type) => ({ id: type.id, label: type.name })),
    ],
    [resourceTypesQuery.data],
  );

  const availableSlots = (availabilityQuery.data ?? []).filter(
    (slot) => slot.capacityRemaining > 0 && !dismissedSlotIds.has(slot.id),
  );

  // "Ahora mismo" includes slots already in progress AND slots starting
  // shortly — a slot starting in 20 minutes is still something you can walk
  // into and use right now, not "later today". Without this grace window,
  // freshly-seeded near-term slots (which always start in the future, never
  // in the past) would never appear here.
  const nowMs = now.getTime();
  const nowGroupCutoffMs = nowMs + 60 * 60 * 1000;
  const nowGroup = availableSlots.filter(
    (slot) => new Date(slot.startsAt).getTime() <= nowGroupCutoffMs,
  );
  const laterGroup = availableSlots
    .filter((slot) => new Date(slot.startsAt).getTime() > nowGroupCutoffMs)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const conflictSlot = createBooking.conflict
    ? (availabilityQuery.data?.find((s) => s.id === createBooking.conflict!.availabilitySlotId) ??
      null)
    : null;

  function handleBook(slot: AvailabilitySlot) {
    haptics.selection();
    setPendingSlotIds((prev) => withId(prev, slot.id));

    createBooking.mutate(
      { availabilitySlotId: slot.id, userId: demoUserId, seats: 1 },
      {
        onSettled: () => {
          setPendingSlotIds((prev) => withoutId(prev, slot.id));
        },
        onSuccess: () => {
          setConfirmedSlotIds((prev) => withId(prev, slot.id));

          // Pause on the checkmark (per handoff: 400ms) before the row exits.
          setTimeout(() => {
            setDismissedSlotIds((prev) => withId(prev, slot.id));
            setConfirmedSlotIds((prev) => withoutId(prev, slot.id));
            useToastStore
              .getState()
              .show(`${slot.resourceName} · hoy ${formatTime(slot.startsAt)}`, "Ver");
          }, 400);
        },
      },
    );
  }

  function handleOpenResource(slot: AvailabilitySlot) {
    router.push({
      pathname: "/resource/[id]",
      params: { id: slot.resourceId, name: slot.resourceName, location: slot.locationName },
    });
  }

  const isEmpty =
    !availabilityQuery.isLoading && nowGroup.length === 0 && laterGroup.length === 0;

  return (
    <View className="flex-1 bg-canvas">
      <View className="gap-5 px-4 pt-3">
        <View className="flex-row items-end justify-between">
          <Text className="text-title-lg text-label-1">Ahora</Text>
          <Text className="text-subhead text-label-4">
            {isRefreshing ? "Actualizando…" : formatHeaderDate(now)}
          </Text>
        </View>

        {/* Static for now — no search endpoint exists yet, see README. */}
        <View className="h-[38px] flex-row items-center gap-2 rounded-control bg-fill px-3">
          <Text className="text-[13px] text-label-4">⌕</Text>
          <TextInput
            editable={false}
            placeholder="Buscar"
            placeholderTextColor="#8A8A8E"
            className="flex-1 text-label-4"
          />
        </View>

        <FilterPills
          options={filterOptions}
          selectedId={selectedResourceTypeId}
          onSelect={setSelectedResourceTypeId}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 20, padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => availabilityQuery.refetch()}
            tintColor="transparent"
            colors={["transparent"]}
          />
        }
      >
        <View style={{ opacity: isRefreshing ? 0.6 : 1, gap: 20 }}>
          {showSkeleton ? (
            <Group header="LIBRE AHORA MISMO">
              <Skeleton />
              <Skeleton />
            </Group>
          ) : null}

          {!showSkeleton && nowGroup.length > 0 ? (
            <Group header="LIBRE AHORA MISMO">
              {nowGroup.map((slot, index) => (
                <Animated.View key={slot.id} layout={LinearTransition} exiting={FadeOut}>
                  <Row
                    title={slot.resourceName}
                    subtitle={`${slot.locationName} · hasta ${formatTime(slot.endsAt)}`}
                    meta={
                      slot.capacityRemaining === 1
                        ? `Último lugar · hasta ${formatTime(slot.endsAt)}`
                        : undefined
                    }
                    metaTone={slot.capacityRemaining === 1 ? "last" : "default"}
                    trailing={confirmedSlotIds.has(slot.id) ? "check" : "action"}
                    actionLabel="Apartar"
                    actionTone={index === 0 ? "filled" : "wash"}
                    actionLoading={pendingSlotIds.has(slot.id)}
                    onActionPress={() => handleBook(slot)}
                    onPress={() => handleOpenResource(slot)}
                  />
                </Animated.View>
              ))}
            </Group>
          ) : null}

          {!showSkeleton && laterGroup.length > 0 ? (
            <Group header="MÁS TARDE HOY">
              {laterGroup.map((slot) => (
                <Row
                  key={slot.id}
                  title={slot.resourceName}
                  subtitle={slot.locationName}
                  trailing="chevron"
                  trailingText={formatTime(slot.startsAt)}
                  onPress={() => handleOpenResource(slot)}
                />
              ))}
            </Group>
          ) : null}

          {isEmpty ? (
            <Placeholder
              reason="noAvailability"
              icon={<Text className="text-[26px] text-chevron">⌘</Text>}
              title="Nada libre por ahora"
              body="No hay espacios disponibles hoy con este filtro. Vuelve a intentar más tarde o quita el filtro."
              primaryAction={{ label: "Actualizar", onPress: () => availabilityQuery.refetch() }}
              secondaryAction={
                selectedResourceTypeId
                  ? { label: "Quitar filtro", onPress: () => setSelectedResourceTypeId(null) }
                  : undefined
              }
            />
          ) : null}
        </View>
      </ScrollView>

      {conflictSlot ? (
        <ConflictSheet
          isOpen
          onClose={() => createBooking.reset()}
          slotId={conflictSlot.id}
          slotStartsAt={conflictSlot.startsAt}
          technicalMessage={createBooking.conflict?.message}
        />
      ) : null}

      {toastMessage ? (
        <Toast
          message={toastMessage}
          actionLabel="Ver"
          onAction={() => useToastStore.getState().clear()}
          onDismiss={() => useToastStore.getState().clear()}
        />
      ) : null}
    </View>
  );
}

function formatHeaderDate(date: Date) {
  const formatted = date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${formatted} · ${time}`;
}
