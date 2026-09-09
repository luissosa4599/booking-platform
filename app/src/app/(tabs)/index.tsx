import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { useRouter } from "expo-router";

import { ConflictSheet } from "@/components/ConflictSheet";
import { FilterPills, type FilterPillOption } from "@/components/FilterPills";
import { Group } from "@/components/Group";
import { Placeholder } from "@/components/Placeholder";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { SortControl } from "@/components/SortControl";
import { SpaceMap } from "@/components/SpaceMap";
import type { MapPlace } from "@/components/SpaceMap.types";
import { StaleStamp } from "@/components/StaleStamp";
import { useAvailability, type AvailabilitySort } from "@/lib/api/availability";
import { useCreateBooking } from "@/lib/api/bookings";
import { useFavorites, useToggleFavorite } from "@/lib/api/favorites";
import { useResourceTypes } from "@/lib/api/resourceTypes";
import type { AvailabilitySlot } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { composeEmptyStateCopy } from "@/lib/emptyStateCopy";
import { haptics } from "@/lib/haptics";
import { CalendarX, Heart, List, Map as MapIcon, Search } from "@/lib/icons";
import { requestAndGetPosition } from "@/lib/location";
import { distanceToMeters, useLocationStore } from "@/lib/locationStore";
import { formatDistance, type Coords } from "@/lib/maps";
import { useIsOffline } from "@/lib/net";
import { useColor } from "@/lib/theme/useColor";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useToastStore } from "@/lib/toastStore";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
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
  const [selectedResourceTypeId, setSelectedResourceTypeId] = useState<
    string | null
  >(null);
  const [searchInput, setSearchInput] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // List vs map (PR #10). Web only — native keeps the list (see SpaceMap.native).
  const mapAvailable = Platform.OS === "web";
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [sort, setSort] = useState<AvailabilitySort>("soonest");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  // Live device position (updates as you move) drives the per-row distance
  // label; `sortAnchor` (a lagging copy) keys the server sort so the list order
  // doesn't churn while you walk.
  const livePos = useLocationStore((s) => s.position);
  const sortAnchor = useLocationStore((s) => s.sortAnchor);
  const ensureWatching = useLocationStore((s) => s.ensureWatching);
  const stopWatching = useLocationStore((s) => s.stop);
  // Set from the empty state's primary action ("Ver disponibilidad") — extends
  // the query window past today so `emptyContext.nextAvailableAt` actually
  // shows up in the list.
  const [horizon, setHorizon] = useState<Date | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<Set<string>>(new Set());
  const [confirmedSlotIds, setConfirmedSlotIds] = useState<Set<string>>(
    new Set(),
  );
  const [dismissedSlotIds, setDismissedSlotIds] = useState<Set<string>>(
    new Set(),
  );

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const searchIconColor = useColor("label-4");

  // Captured once per mount — a slight drift against a live clock over a long
  // session is fine, the query itself refetches every 60s regardless.
  const now = useMemo(() => new Date(), []);
  const endOfToday = useMemo(() => endOfDay(now), [now]);
  const to = horizon ?? endOfToday;

  // The one-shot fix or, once a watch is running, the lagging sort anchor.
  const queryCoords = sortAnchor ?? coords;
  const resourceTypesQuery = useResourceTypes();
  const availabilityQuery = useAvailability({
    resourceTypeId: selectedResourceTypeId,
    from: now,
    to,
    q: debouncedSearch || undefined,
    sort,
    lat: queryCoords?.lat,
    lng: queryCoords?.lng,
  });
  const createBooking = useCreateBooking();
  const { ids: favoriteIds } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const offline = useIsOffline();

  const favoriteChipActiveColor = useColor("canvas");
  const favoriteChipRestColor = useColor("label-2");
  const segOnColor = useColor("label-1");
  const segOffColor = useColor("label-3");

  useEffect(() => {
    if (createBooking.isConflict) {
      haptics.error();
    }
  }, [createBooking.isConflict]);

  const showSkeleton = useDelayedFlag(availabilityQuery.isLoading, 150);
  const isRefreshing =
    availabilityQuery.isFetching && !availabilityQuery.isLoading;

  const filterOptions: FilterPillOption[] = useMemo(
    () => [
      { id: null, label: "Cualquiera" },
      ...(resourceTypesQuery.data ?? []).map((type) => ({
        id: type.id,
        // The user-facing plural, never the internal `name` (which is ASCII-only
        // and not styled for display — e.g. "Salon" vs "salones").
        label:
          type.labels.plural.charAt(0).toUpperCase() +
          type.labels.plural.slice(1),
      })),
    ],
    [resourceTypesQuery.data],
  );

  const availableSlots = availabilityQuery.slots.filter(
    (slot) =>
      slot.capacityRemaining > 0 &&
      !dismissedSlotIds.has(slot.id) &&
      (!favoritesOnly || favoriteIds.has(slot.resourceId)),
  );

  // One marker per resource for the map — the earliest bookable slot decides
  // its state (`free` if starting within the hour, else `soon` + minutes).
  const mapPlaces: MapPlace[] = useMemo(() => {
    const byResource = new Map<string, MapPlace>();
    const nowMs = now.getTime();
    for (const slot of availableSlots) {
      if (slot.locationLatitude == null || slot.locationLongitude == null) {
        continue;
      }
      const startMs = new Date(slot.startsAt).getTime();
      const minutesUntil = Math.max(0, Math.round((startMs - nowMs) / 60_000));
      const freeNow = startMs <= nowMs + 60 * 60 * 1000;
      const prev = byResource.get(slot.resourceId);
      if (prev && (prev.state === "free" || (prev.soonMinutes ?? 1e9) <= minutesUntil)) {
        continue;
      }
      const meters = distanceToMeters(
        livePos,
        slot.locationLatitude,
        slot.locationLongitude,
      );
      byResource.set(slot.resourceId, {
        resourceId: slot.resourceId,
        name: slot.resourceName,
        locationName: slot.locationName,
        lat: slot.locationLatitude,
        lng: slot.locationLongitude,
        state: freeNow ? "free" : "soon",
        soonMinutes: freeNow ? null : minutesUntil,
        distanceLabel: meters != null ? formatDistance(meters) : null,
        actionLabel: "Apartar",
      });
    }
    return [...byResource.values()];
  }, [availableSlots, livePos, now]);

  function bookByResource(resourceId: string) {
    const slot = availableSlots.find((s) => s.resourceId === resourceId);
    if (slot) handleBook(slot);
  }

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
  const laterGroupUnsorted = availableSlots.filter(
    (slot) => new Date(slot.startsAt).getTime() > nowGroupCutoffMs,
  );
  // The server already ordered the flat list for the chosen sort; only re-sort
  // by time when we're on the default "soonest".
  const laterGroup =
    sort === "soonest"
      ? [...laterGroupUnsorted].sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
      : laterGroupUnsorted;

  const laterHeader = horizon ? "PRÓXIMAMENTE" : "MÁS TARDE HOY";

  const conflictSlot = createBooking.conflict
    ? (availabilityQuery.slots.find(
        (s) => s.id === createBooking.conflict!.availabilitySlotId,
      ) ?? null)
    : null;

  function handleBook(slot: AvailabilitySlot) {
    if (offline) {
      useToastStore.getState().show("Necesitas conexión para apartar un lugar");
      return;
    }
    haptics.selection();
    setPendingSlotIds((prev) => withId(prev, slot.id));

    createBooking.mutate(
      {
        availabilitySlotId: slot.id,
        seats: 1,
        rowVersion: slot.rowVersion,
      },
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
              .show(
                `${slot.resourceName} · hoy ${formatTime(slot.startsAt)}`,
                "Ver",
              );
          }, 400);
        },
      },
    );
  }

  async function enableNearest() {
    if (coords) {
      setSort("nearest");
      ensureWatching();
      return;
    }
    setLocating(true);
    const pos = await requestAndGetPosition();
    setLocating(false);
    if (pos) {
      setCoords(pos);
      setSort("nearest");
      ensureWatching();
    } else {
      // Denied / unavailable — stay on the current sort, don't nag.
      useToastStore
        .getState()
        .show("Activa la ubicación para ordenar por cercanía");
    }
  }

  function handleSortChange(next: AvailabilitySort) {
    if (next === "nearest") {
      void enableNearest();
    } else {
      setSort(next);
      stopWatching();
    }
  }

  // Stop the watcher when leaving Explore.
  useEffect(() => () => stopWatching(), [stopWatching]);

  function handleToggleFavorite(slot: AvailabilitySlot) {
    toggleFavorite.mutate({
      resourceId: slot.resourceId,
      next: !favoriteIds.has(slot.resourceId),
      summary: {
        resourceId: slot.resourceId,
        name: slot.resourceName,
        locationName: slot.locationName,
        locationAddress: null,
        resourceTypeId: slot.resourceTypeId,
      },
    });
  }

  function handleOpenResource(slot: AvailabilitySlot) {
    router.push({
      pathname: "/resource/[id]",
      params: {
        id: slot.resourceId,
        name: slot.resourceName,
        location: slot.locationName,
      },
    });
  }

  const isEmpty =
    !availabilityQuery.isLoading &&
    nowGroup.length === 0 &&
    laterGroup.length === 0;

  const emptyCopy = composeEmptyStateCopy(availabilityQuery.emptyContext);
  const nextAvailableAt =
    availabilityQuery.emptyContext?.nextAvailableAt ?? null;

  // The primary action *executes* the resolving datum. A typo'd search is
  // resolved by clearing it, not by jumping the calendar forward — so that
  // takes precedence over `nextAvailableAt` when the cause is `noResults`.
  const emptyReason = availabilityQuery.emptyContext?.reason;
  // A "Favoritos"-filtered empty list is its own case — the fix is to drop the
  // filter, not to widen the time window or clear the search.
  const favoritesEmpty = favoritesOnly && isEmpty;
  let emptyPrimary: { label: string; onPress: () => void };
  if (favoritesEmpty) {
    emptyPrimary = { label: "Ver todo", onPress: () => setFavoritesOnly(false) };
  } else if (debouncedSearch && emptyReason === "noResults") {
    emptyPrimary = {
      label: "Ver todo",
      onPress: () => {
        setSearchInput("");
        setSelectedResourceTypeId(null);
      },
    };
  } else if (nextAvailableAt && !horizon) {
    emptyPrimary = {
      label: "Ver disponibilidad",
      onPress: () => setHorizon(endOfDay(new Date(nextAvailableAt))),
    };
  } else if (debouncedSearch) {
    emptyPrimary = {
      label: "Ver todo",
      onPress: () => {
        setSearchInput("");
        setSelectedResourceTypeId(null);
      },
    };
  } else if (selectedResourceTypeId) {
    emptyPrimary = {
      label: "Quitar filtro",
      onPress: () => setSelectedResourceTypeId(null),
    };
  } else {
    emptyPrimary = {
      label: "Actualizar",
      onPress: () => availabilityQuery.refetch(),
    };
  }

  const emptySecondary =
    selectedResourceTypeId && emptyPrimary.label !== "Quitar filtro"
      ? {
          label: "Quitar filtro",
          onPress: () => setSelectedResourceTypeId(null),
        }
      : undefined;

  // Distance label for a row — live (from the watched position) if we have one,
  // else the server's fix. Null unless sorting by proximity.
  function slotDistance(slot: AvailabilitySlot): string | null {
    return formatDistance(
      distanceToMeters(livePos, slot.locationLatitude, slot.locationLongitude) ??
        slot.distanceMeters,
    );
  }

  return (
    <Screen bg="canvas" maxWidth={1080}>
      {/* Fixed header — the `pb-4` keeps a gap between the pills and the list
          even while the list scrolls under it (a scrolled contentContainer
          top-padding would disappear). */}
      <View className="gap-5 px-4 pb-4 pt-3">
        <View className="flex-row items-end justify-between">
          <Text className="text-title-lg text-label-1">Ahora</Text>
          <Text className="text-subhead text-label-4">
            {locating
              ? "Ubicando…"
              : isRefreshing
                ? "Actualizando…"
                : formatHeaderDate(now)}
          </Text>
        </View>

        <View className="h-[38px] flex-row items-center gap-2 rounded-control bg-fill px-3 text-label-4">
          <Search size={13} color={searchIconColor} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Buscar sala, cabina, piso…"
            placeholderTextColor="#8A8A8E"
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="flex-1 text-body text-label-1"
          />
        </View>

        <FilterPills
          options={filterOptions}
          selectedId={selectedResourceTypeId}
          onSelect={setSelectedResourceTypeId}
          removable={isEmpty && !!selectedResourceTypeId}
        />

        <StaleStamp dataUpdatedAt={availabilityQuery.dataUpdatedAt} className="pl-1 text-footnote text-label-4" />

        {mapAvailable ? (
          <View className="h-9 flex-row rounded-control bg-fill p-[3px]">
            {(["list", "map"] as const).map((v) => {
              const on = view === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => {
                    haptics.selection();
                    setView(v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={v === "list" ? "Ver como lista" : "Ver en el mapa"}
                  className={cn(
                    "flex-1 flex-row items-center justify-center gap-1.5 rounded-control-segmented-inner",
                    on ? "bg-card" : "",
                  )}
                >
                  {v === "list" ? (
                    <List size={14} color={on ? segOnColor : segOffColor} />
                  ) : (
                    <MapIcon size={14} color={on ? segOnColor : segOffColor} />
                  )}
                  <Text
                    className={cn(
                      "text-subhead font-semibold",
                      on ? "text-label-1" : "text-label-3",
                    )}
                  >
                    {v === "list" ? "Lista" : "Mapa"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <SortControl value={sort} onChange={handleSortChange} />
          <Pressable
            onPress={() => {
              haptics.selection();
              setFavoritesOnly((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel="Mostrar solo favoritos"
            accessibilityState={{ selected: favoritesOnly }}
            className={cn(
              "h-[34px] flex-row items-center gap-1.5 rounded-full px-[14px]",
              favoritesOnly ? "bg-label-1" : "bg-card",
            )}
          >
            <Heart
              size={13}
              color={favoritesOnly ? favoriteChipActiveColor : favoriteChipRestColor}
              fill={favoritesOnly ? favoriteChipActiveColor : "none"}
            />
            <Text
              className={cn(
                "text-subhead",
                favoritesOnly ? "text-canvas" : "text-label-2",
              )}
            >
              Favoritos
            </Text>
          </Pressable>
        </View>
      </View>

      {view === "map" && mapAvailable ? (
        <SpaceMap
          places={mapPlaces}
          selectedId={selectedMapId}
          onSelect={(id) => setSelectedMapId((cur) => (cur === id ? null : id))}
          onAction={bookByResource}
          userPosition={livePos}
        />
      ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          gap: 20,
          paddingHorizontal: 16,
          paddingBottom: 16,
        }}
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
              <Animated.View exiting={FadeOut.duration(200)}>
                <Skeleton />
              </Animated.View>
              <Animated.View exiting={FadeOut.duration(200)}>
                <Skeleton />
              </Animated.View>
            </Group>
          ) : null}

          {!showSkeleton && nowGroup.length > 0 ? (
            <Group header="LIBRE AHORA MISMO">
              {nowGroup.map((slot) => (
                <Animated.View
                  key={slot.id}
                  layout={LinearTransition.springify()}
                  exiting={FadeOut}
                >
                  <Row
                    title={slot.resourceName}
                    subtitle={
                      slotDistance(slot)
                        ? `${slot.locationName} · a ${slotDistance(slot)}`
                        : `${slot.locationName} · hasta ${formatTime(slot.endsAt)}`
                    }
                    meta={
                      slot.capacityRemaining === 1
                        ? `Último lugar · hasta ${formatTime(slot.endsAt)}`
                        : undefined
                    }
                    metaTone={slot.capacityRemaining === 1 ? "last" : "default"}
                    trailing={
                      confirmedSlotIds.has(slot.id) ? "check" : "action"
                    }
                    actionLabel="Apartar"
                    actionTone="wash"
                    actionLoading={pendingSlotIds.has(slot.id)}
                    actionAccessibilityLabel={`Apartar ${slot.resourceName} ahora, hasta ${formatTime(slot.endsAt)}`}
                    onActionPress={() => handleBook(slot)}
                    favorite={favoriteIds.has(slot.resourceId)}
                    onFavoriteToggle={() => handleToggleFavorite(slot)}
                    onPress={() => handleOpenResource(slot)}
                    accessibilityLabel={`${slot.resourceName}, ${slot.locationName}, disponible hasta ${formatTime(slot.endsAt)}`}
                  />
                </Animated.View>
              ))}
            </Group>
          ) : null}

          {!showSkeleton && laterGroup.length > 0 ? (
            <Group header={laterHeader}>
              {laterGroup.map((slot) => (
                <Row
                  key={slot.id}
                  title={slot.resourceName}
                  subtitle={
                    slotDistance(slot)
                      ? `${slot.locationName} · a ${slotDistance(slot)}`
                      : slot.locationName
                  }
                  trailing="chevron"
                  trailingText={formatTime(slot.startsAt)}
                  favorite={favoriteIds.has(slot.resourceId)}
                  onFavoriteToggle={() => handleToggleFavorite(slot)}
                  onPress={() => handleOpenResource(slot)}
                  accessibilityLabel={`${slot.resourceName}, ${slot.locationName}, disponible a las ${formatTime(slot.startsAt)}`}
                />
              ))}
            </Group>
          ) : null}

          {isEmpty ? (
            <Placeholder
              reason={
                (availabilityQuery.emptyContext?.reason as
                  "noAvailability" | "noResults" | "filtered" | undefined) ??
                "noAvailability"
              }
              icon={<CalendarX size={26} />}
              title={favoritesEmpty ? "Sin favoritos disponibles" : emptyCopy.title}
              body={
                favoritesEmpty
                  ? "Ninguno de tus espacios favoritos tiene lugar ahora mismo."
                  : emptyCopy.body
              }
              primaryAction={emptyPrimary}
              secondaryAction={favoritesEmpty ? undefined : emptySecondary}
            />
          ) : null}
        </View>
      </ScrollView>
      )}

      {/* The success toast is rendered once at the root (_layout.tsx) so it
          survives router.back() into here and sits at the true bottom. */}
      <ConflictSheet
        isOpen={!!conflictSlot}
        onClose={() => createBooking.reset()}
        slotId={conflictSlot?.id ?? null}
        slotStartsAt={conflictSlot?.startsAt ?? null}
        technicalMessage={createBooking.conflict?.message}
        alternatives={createBooking.conflict?.alternatives ?? []}
      />
    </Screen>
  );
}

function formatHeaderDate(date: Date) {
  const formatted = date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatted} · ${time}`;
}
