import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ConflictSheet } from "@/components/ConflictSheet";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { ScreenFade } from "@/components/ScreenFade";
import { Skeleton } from "@/components/Skeleton";
import { Stepper } from "@/components/Stepper";
import { SuccessCheckmark } from "@/components/SuccessCheckmark";
import { Button } from "@/components/Button";
import { useCreateBooking } from "@/lib/api/bookings";
import { useResource } from "@/lib/api/resources";
import { useResourceTypes } from "@/lib/api/resourceTypes";
import { useJoinWaitlist } from "@/lib/api/waitlist";
import type { AvailabilitySlot } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useToastStore } from "@/lib/toastStore";
import { demoUserId } from "@/lib/userId";

// Brief pause on the checkmark before returning to Explore — long enough to
// see the 340ms entrance plus a beat of the halo, same idea as ExploreScreen's
// 400ms pause on its own (smaller) confirmation checkmark.
const SUCCESS_PAUSE_MS = 900;
const DAYS_SHOWN = 4;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function withId(set: Set<string>, id: string) {
  const next = new Set(set);
  next.add(id);
  return next;
}

function capitalize(value: string) {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

// The backend only gives one capacityUnit noun per ResourceType (e.g.
// "personas", already singular "persona" for types capped at 1 seat) — for
// counts of exactly 1 on a plural noun, trim the trailing "s" so the CTA
// subtitle reads "1 persona", not "1 personas".
function pluralizeUnit(count: number, unit: string) {
  return count === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

interface DayBucket {
  date: Date;
  label: string;
  dayNumber: number;
  slots: AvailabilitySlot[];
}

function buildDayBuckets(slots: AvailabilitySlot[]): DayBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: DAYS_SHOWN }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const daySlots = slots
      .filter((slot) => {
        const startsAt = new Date(slot.startsAt);
        return startsAt >= date && startsAt < nextDate;
      })
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );

    return {
      date,
      label:
        index === 0
          ? "Hoy"
          : date.toLocaleDateString("es-MX", { weekday: "short" }),
      dayNumber: date.getDate(),
      slots: daySlots,
    };
  });
}

export default function ResourceScreen() {
  const router = useRouter();
  // `name`/`location` are passed from the ExploreScreen row so the header
  // paints instantly (per handoff: "cero pantalla de carga al entrar")
  // instead of waiting on GET /resources/{id} for content already known.
  const {
    id,
    name: passedName,
    location: passedLocation,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    location?: string;
  }>();

  const [seatCount, setSeatCount] = useState(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [joinedWaitlistSlotIds, setJoinedWaitlistSlotIds] = useState<
    Set<string>
  >(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  const resourceQuery = useResource(id);
  const resourceTypesQuery = useResourceTypes();
  const createBooking = useCreateBooking();
  const joinWaitlist = useJoinWaitlist();

  const resource = resourceQuery.data;
  // Not returned by GET /resources/{id} (only by GET /resource-types) —
  // cross-referenced from the resource-types cache instead of adding fields
  // to the detail endpoint, since ExploreScreen already warms that cache.
  const resourceType = resourceTypesQuery.data?.find(
    (t) => t.id === resource?.resourceTypeId,
  );
  const allowsMultipleSeats = resourceType?.allowsMultipleSeats ?? false;
  const allowsWaitlist = resourceType?.allowsWaitlist ?? false;
  const capacityUnitLabel = resourceType?.labels.capacityUnit ?? "personas";
  const actionVerb = resourceType?.labels.actionVerb ?? "Apartar";

  useEffect(() => {
    if (createBooking.isConflict) {
      haptics.error();
    }
  }, [createBooking.isConflict]);

  const days = useMemo(
    () => buildDayBuckets(resource?.upcomingSlots ?? []),
    [resource],
  );
  const daySlots = days[selectedDayIndex]?.slots ?? [];
  // Handoff: "Stepper máximo = seatsLeft del slot seleccionado. Si el usuario
  // sube personas por encima de lo que permite el slot elegido, ese slot se
  // deselecciona y su fila pasa a disabled." Derived directly during render
  // (no effect+setState needed): a selected slot that can no longer fit
  // `seatCount` simply stops counting as selected on the very next render,
  // and its row's own `eligible` check (below) disables it in the same pass.
  const rawSelectedSlot = daySlots.find((s) => s.id === selectedSlotId) ?? null;
  const selectedSlot =
    rawSelectedSlot && rawSelectedSlot.capacityRemaining >= seatCount
      ? rawSelectedSlot
      : null;

  const stepperMax = selectedSlot
    ? selectedSlot.capacityRemaining
    : (resource?.capacity ?? 1);
  const showSlotSkeleton = useDelayedFlag(resourceQuery.isLoading, 150);

  const conflictSlot = createBooking.conflict
    ? (resource?.upcomingSlots.find(
        (s) => s.id === createBooking.conflict!.availabilitySlotId,
      ) ?? null)
    : null;

  const displayName = resource?.name ?? passedName ?? "";
  const subtitleParts = [
    resource?.description ?? undefined,
    resource
      ? `hasta ${resource.capacity} ${capacityUnitLabel}`
      : passedLocation,
  ].filter((part): part is string => !!part);

  const durationMinutes = selectedSlot
    ? Math.round(
        (new Date(selectedSlot.endsAt).getTime() -
          new Date(selectedSlot.startsAt).getTime()) /
          60_000,
      )
    : null;

  const ctaLabel = selectedSlot
    ? `${actionVerb} ${formatTime(selectedSlot.startsAt)}`
    : "Elige un horario";
  const ctaSubtitle = selectedSlot
    ? `${seatCount} ${pluralizeUnit(seatCount, capacityUnitLabel)} · ${durationMinutes} min`
    : undefined;

  function handleJoinWaitlist(slot: AvailabilitySlot) {
    haptics.selection();
    joinWaitlist.mutate(
      { availabilitySlotId: slot.id, userId: demoUserId },
      {
        onSuccess: () =>
          setJoinedWaitlistSlotIds((prev) => withId(prev, slot.id)),
      },
    );
  }

  function handleConfirm() {
    if (!selectedSlot || !resource) {
      return;
    }
    haptics.selection();
    const bookedSlot = selectedSlot;

    createBooking.mutate(
      {
        availabilitySlotId: bookedSlot.id,
        userId: demoUserId,
        seats: seatCount,
      },
      {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => {
            useToastStore
              .getState()
              .show(
                `${resource.name} · hoy ${formatTime(bookedSlot.startsAt)}`,
                "Ver",
              );
            router.back();
          }, SUCCESS_PAUSE_MS);
        },
      },
    );
  }

  return (
    <ScreenFade>
      <View className="flex-1 bg-card">
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="h-[196px] justify-start bg-fill p-4">
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/86"
            >
              <Text className="text-[17px] text-label-1">←</Text>
            </Pressable>
          </View>

          <View className="gap-6 px-4 pt-6">
            <View className="gap-[6px]">
              <Text className="text-title-md text-label-1">{displayName}</Text>
              {subtitleParts.length > 0 ? (
                <Text className="text-body text-label-3">
                  {subtitleParts.join(" · ")}
                </Text>
              ) : null}
            </View>

            {allowsMultipleSeats ? (
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-[17px] text-label-1">
                  {capitalize(capacityUnitLabel)}
                </Text>
                <Stepper
                  value={seatCount}
                  max={stepperMax}
                  onChange={setSeatCount}
                />
              </View>
            ) : null}

            <View className="gap-3">
              <View className="flex-row gap-2">
                {days.map((day, index) => {
                  const isSelected = index === selectedDayIndex;
                  const hasSlots = day.slots.length > 0;
                  return (
                    <Pressable
                      key={day.date.toISOString()}
                      disabled={!hasSlots}
                      onPress={() => setSelectedDayIndex(index)}
                      className={cn(
                        "h-[52px] flex-1 items-center justify-center gap-px rounded-button",
                        isSelected ? "bg-tint-wash" : "bg-fill",
                        !hasSlots ? "opacity-40" : undefined,
                      )}
                    >
                      <Text className="text-[13px] text-label-4">
                        {day.label}
                      </Text>
                      <Text
                        className={cn(
                          "text-body-emph",
                          isSelected ? "text-tint-press" : "text-label-1",
                        )}
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {day.dayNumber}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Group variant="canvas">
                {showSlotSkeleton ? (
                  <>
                    <Skeleton />
                    <Skeleton />
                  </>
                ) : daySlots.length > 0 ? (
                  daySlots.map((slot) => {
                    const isFull = slot.capacityRemaining <= 0;
                    const isJoined = joinedWaitlistSlotIds.has(slot.id);
                    const isJoining =
                      joinWaitlist.isPending &&
                      joinWaitlist.variables?.availabilitySlotId === slot.id;
                    const eligible = slot.capacityRemaining >= seatCount;
                    const title = `${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`;

                    if (isFull) {
                      if (allowsWaitlist) {
                        return (
                          <Row
                            key={slot.id}
                            title={title}
                            tabularTitle
                            trailing={isJoined ? "check" : "text"}
                            trailingText={isJoined ? undefined : "Anotarme"}
                            trailingTone="waiting"
                            disabled={isJoined || isJoining}
                            onPress={
                              isJoined
                                ? undefined
                                : () => handleJoinWaitlist(slot)
                            }
                          />
                        );
                      }
                      return (
                        <Row
                          key={slot.id}
                          title={title}
                          tabularTitle
                          trailing="text"
                          trailingText="Ocupada"
                          disabled
                        />
                      );
                    }

                    return (
                      <Row
                        key={slot.id}
                        title={title}
                        tabularTitle
                        trailing="text"
                        trailingText={
                          slot.capacityRemaining === 1
                            ? "Último lugar"
                            : `${slot.capacityRemaining} lugares`
                        }
                        trailingTone={
                          slot.capacityRemaining === 1 ? "last" : "default"
                        }
                        selected={slot.id === selectedSlotId && eligible}
                        disabled={!eligible}
                        onPress={
                          eligible
                            ? () => setSelectedSlotId(slot.id)
                            : undefined
                        }
                      />
                    );
                  })
                ) : (
                  <View className="px-4 py-6">
                    <Text className="text-body text-label-3">
                      No hay horarios este día.
                    </Text>
                  </View>
                )}
              </Group>
            </View>
          </View>
        </ScrollView>

        <View className="absolute inset-x-0 bottom-0 border-t border-hairline bg-card/94 px-4 pb-[34px] pt-3">
          <Button
            variant="filled"
            subtitle={ctaSubtitle}
            disabled={!selectedSlot}
            loading={createBooking.isPending}
            onPress={handleConfirm}
          >
            {ctaLabel}
          </Button>
        </View>

        <ConflictSheet
          isOpen={!!conflictSlot}
          onClose={() => createBooking.reset()}
          slotId={conflictSlot?.id ?? null}
          slotStartsAt={conflictSlot?.startsAt ?? null}
          technicalMessage={createBooking.conflict?.message}
        />

        {showSuccess ? (
          <View className="absolute inset-0 items-center justify-center bg-card">
            <SuccessCheckmark />
          </View>
        ) : null}
      </View>
    </ScreenFade>
  );
}
