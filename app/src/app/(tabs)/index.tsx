import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
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

import { Avatar } from "@/components/Avatar";
import { BookingPassSheet } from "@/components/BookingPassSheet";
import { CategoryCircles, type CategoryOption } from "@/components/CategoryCircles";
import { ConflictSheet } from "@/components/ConflictSheet";
import { FilterPills } from "@/components/FilterPills";
import { FilterSheet } from "@/components/FilterSheet";
import { Group } from "@/components/Group";
import { MapListFab } from "@/components/MapListFab";
import { NextBookingBanner } from "@/components/NextBookingBanner";
import { NotificationBell } from "@/components/NotificationBell";
import { Placeholder } from "@/components/Placeholder";
import { RefreshButton } from "@/components/RefreshButton";
import { ResourceCard } from "@/components/ResourceCard";
import { ResourcePane } from "@/components/ResourcePane";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { SortControl } from "@/components/SortControl";
import type { StatusTone } from "@/components/StatusBadge";
import { SpaceMap } from "@/components/SpaceMap";
import { MAP_TOGGLE_BOTTOM, type MapPlace } from "@/components/SpaceMap.types";
import { StaleStamp } from "@/components/StaleStamp";
import { useAvailability, type AvailabilitySort } from "@/lib/api/availability";
import { useCreateBooking, useMyBookings } from "@/lib/api/bookings";
import { useFavorites, useToggleFavorite } from "@/lib/api/favorites";
import { useNotifications } from "@/lib/api/notifications";
import { useResourceTypes } from "@/lib/api/resourceTypes";
import type { AvailabilitySlot, MyBooking } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { composeEmptyStateCopy } from "@/lib/emptyStateCopy";
import { haptics } from "@/lib/haptics";
import {
  BookOpen,
  CalendarX,
  Compass,
  Heart,
  List,
  Map as MapIcon,
  PanelBottom,
  Presentation,
  Search,
  SlidersHorizontal,
  Theater,
} from "@/lib/icons";
import { requestAndGetPosition } from "@/lib/location";
import { distanceToMeters, useLocationStore } from "@/lib/locationStore";
import { formatDistance } from "@/lib/maps";
import { useIsOffline } from "@/lib/net";
import { useAuthStore, useUserId } from "@/lib/session";
import { stockImageUrl } from "@/lib/stockImages";
import { useColor } from "@/lib/theme/useColor";
import { useHasDetailPane, useIsWide } from "@/lib/useBreakpoint";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useDetailSelection } from "@/lib/useDetailSelection";
import { useDelayedFlag } from "@/lib/useDelayedFlag";
import { useReduceMotion } from "@/lib/useReduceMotion";
import { useToastStore } from "@/lib/toastStore";

// Redesign handoff §4 — the category-icon mapping, keyed by the resource
// type's internal ASCII `name` (never the display label — see `ResourceType`
// in lib/api/types.ts). "Cualquiera" isn't a real type, so it's added
// separately in `categoryOptions` below.
const CATEGORY_ICON_BY_TYPE_NAME: Record<string, typeof BookOpen> = {
  Salon: Presentation,
  "Cubiculo de estudio": PanelBottom,
  "Sala de lectura": BookOpen,
  Auditorio: Theater,
};

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
  // Desktop master–detail: the selected resource shows in a pane, the list
  // stays mounted and live. Tablet/phone push the full screen as before.
  const hasPane = useHasDetailPane();
  const isWide = useIsWide();
  const { selectedId: paneId, select, clear } = useDetailSelection();
  const [sort, setSort] = useState<AvailabilitySort>("soonest");
  const [locating, setLocating] = useState(false);
  // Live device position (updates as you move) drives the per-row distance
  // label and the map's initial centre; `sortAnchor` (a lagging copy) keys the
  // server sort so the list order doesn't churn while you walk. `bootstrap()`
  // (called once from `_layout.tsx` on app start) fills these in before the
  // user ever taps a sort option — see `locationStore.ts`.
  const livePos = useLocationStore((s) => s.position);
  const sortAnchor = useLocationStore((s) => s.sortAnchor);
  const locationStatus = useLocationStore((s) => s.status);
  const ensureWatching = useLocationStore((s) => s.ensureWatching);
  const stopWatching = useLocationStore((s) => s.stop);
  // Only auto-switch to "nearest" once, and never once the user has picked a
  // sort themselves (including explicitly picking "nearest" or opting out).
  const sortTouched = useRef(false);
  // Set from the empty state's primary action ("Ver disponibilidad") — extends
  // the query window past today so `emptyContext.nextAvailableAt` actually
  // shows up in the list.
  const [horizon, setHorizon] = useState<Date | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<Set<string>>(new Set());
  const [dismissedSlotIds, setDismissedSlotIds] = useState<Set<string>>(
    new Set(),
  );
  const [minCapacity, setMinCapacity] = useState(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | null>(null);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const searchIconColor = useColor("label-4");

  // Collapses the greeting row as soon as the list starts scrolling, so the
  // search bar takes its place at the top (2026-09-14 report: "al comenzar
  // el slide se puede ocultar el header y que el search quede arriba"). Map
  // view already hides the greeting outright (see below) — this only ever
  // runs against the list ScrollView. Legacy `Animated` (not Reanimated),
  // same "this is what actually works on web" pattern as the resource
  // detail hero's scroll-driven collapse (`lib/useCollapsingHero.ts`).
  const reduceMotion = useReduceMotion();
  const [greetingCollapsed, setGreetingCollapsed] = useState(false);
  // Measured via onLayout, not hardcoded — the two-line "Hola, <name>" block
  // can run taller than the 44px avatar depending on font metrics. 44 is
  // just a sane pre-measurement fallback so there's no 0-height flash.
  const [greetingHeight, setGreetingHeight] = useState(44);
  const greetingCollapse = useState(() => new RNAnimated.Value(0))[0];
  useEffect(() => {
    RNAnimated.timing(greetingCollapse, {
      toValue: greetingCollapsed ? 1 : 0,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: false,
    }).start();
  }, [greetingCollapsed, greetingCollapse, reduceMotion]);
  const handleListScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;
      setGreetingCollapsed((collapsed) => (collapsed ? y > 0 : y > 8));
    },
    [],
  );
  // Coming back from map view should start expanded again — the ScrollView
  // resets to the top on remount, but this boolean lives on the screen
  // component itself and would otherwise stay stuck collapsed from before
  // the switch. "Adjusting state when a prop changes" via a state-based
  // previous-value comparison during render, not `useEffect` (trips
  // `react-hooks/set-state-in-effect`) and not a ref (`react-hooks/refs`
  // forbids reading/writing `.current` during render in this project) —
  // same derived-state-from-a-changed-value pattern `ConflictSheet` already
  // uses for its own retained value.
  const [prevView, setPrevView] = useState(view);
  if (prevView !== view) {
    setPrevView(view);
    if (view === "list" && greetingCollapsed) {
      setGreetingCollapsed(false);
    }
  }

  // Captured once per mount — a slight drift against a live clock over a long
  // session is fine, the query itself refetches every 60s regardless.
  const now = useMemo(() => new Date(), []);
  const endOfToday = useMemo(() => endOfDay(now), [now]);
  const to = horizon ?? endOfToday;

  // The bootstrap fix or, once a watch is running, the lagging sort anchor.
  const queryCoords = sortAnchor ?? livePos;
  const resourceTypesQuery = useResourceTypes();
  const availabilityQuery = useAvailability({
    resourceTypeId: selectedResourceTypeId,
    from: now,
    to,
    q: debouncedSearch || undefined,
    minCapacity: minCapacity > 0 ? minCapacity : undefined,
    sort,
    lat: queryCoords?.lat,
    lng: queryCoords?.lng,
  });
  const createBooking = useCreateBooking();
  const { ids: favoriteIds } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const offline = useIsOffline();
  const userId = useUserId();
  const session = useAuthStore((s) => s.session);
  const upcomingBookings = useMyBookings("upcoming", userId);
  const nextBooking = upcomingBookings.data?.[0] ?? null;
  const [passBooking, setPassBooking] = useState<MyBooking | null>(null);
  // Separate from SortControl's own sheet (2026-09-14 report: "filtros y
  // ordenamientos abren el mismo modal") — sort changes order, this changes
  // which results show up at all.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const { unreadCount: unreadNotificationCount } = useNotifications();

  const favoriteChipActiveColor = useColor("canvas");
  const favoriteChipRestColor = useColor("label-2");
  const segOnColor = useColor("label-1");
  const segOffColor = useColor("label-3");
  const filterIconColor = useColor("on-tint");

  useEffect(() => {
    if (createBooking.isConflict) {
      haptics.error();
    }
  }, [createBooking.isConflict]);

  const showSkeleton = useDelayedFlag(availabilityQuery.isLoading, 150);
  const isRefreshing =
    availabilityQuery.isFetching && !availabilityQuery.isLoading;

  // ASCII internal name (never the display label) — the category-icon lookup
  // needs it, the stock-photo fallback needs it (`stockImageUrl`).
  const resourceTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of resourceTypesQuery.data ?? []) map.set(type.id, type.name);
    return map;
  }, [resourceTypesQuery.data]);

  const categoryOptions: CategoryOption[] = useMemo(
    () => [
      { id: null, label: "Cualquiera", icon: Compass },
      ...(resourceTypesQuery.data ?? []).map((type) => ({
        id: type.id,
        // The user-facing plural, never the internal `name` (which is ASCII-only
        // and not styled for display — e.g. "Salon" vs "salones").
        label:
          type.labels.plural.charAt(0).toUpperCase() +
          type.labels.plural.slice(1),
        icon: CATEGORY_ICON_BY_TYPE_NAME[type.name] ?? Compass,
      })),
    ],
    [resourceTypesQuery.data],
  );

  // A real per-resource photo (`/availability`'s `imageUrl`, from the
  // resource's own seeded/uploaded `ResourceImage`s) when there is one —
  // falls back to one fixed stock image per resource TYPE otherwise. Every
  // card in a category showing the exact same photo read as "solo hay 5
  // imagenes" (2026-09-14 report) even though the seeder already attaches 2
  // distinct photos per resource; this was never wired through to Explore.
  const imageForSlot = useCallback((slot: AvailabilitySlot): string => {
    return (
      slot.imageUrl ??
      stockImageUrl(resourceTypeNameById.get(slot.resourceTypeId), {
        width: 400,
        height: 300,
      })
    );
  }, [resourceTypeNameById]);

  // Redesign handoff §6 "Badge de estado" — status shows in BOTH groups; the
  // "later" group's label carries the countdown, the "now" group's doesn't
  // (it's already free).
  function statusFor(
    slot: AvailabilitySlot,
    isLater: boolean,
  ): { tone: StatusTone; label: string } {
    const last = slot.capacityRemaining === 1;
    if (!isLater) {
      return last ? { tone: "last", label: "Último lugar" } : { tone: "free", label: "Libre" };
    }
    const minutes = Math.max(
      0,
      Math.round((new Date(slot.startsAt).getTime() - now.getTime()) / 60_000),
    );
    return last
      ? { tone: "last", label: `Último lugar · en ${minutes} min` }
      : { tone: "free", label: `Libre en ${minutes} min` };
  }

  function timeWindowFor(slot: AvailabilitySlot, isLater: boolean): string {
    return isLater
      ? `${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`
      : `hasta ${formatTime(slot.endsAt)}`;
  }

  // Client-side, not a backend query param — every AvailabilitySlot already
  // carries coords/distanceMeters, and this only ever applies once the
  // device position is known (FilterSheet greys the options out otherwise).
  const maxDistanceMeters = maxDistanceKm != null ? maxDistanceKm * 1000 : null;
  const availableSlots = availabilityQuery.slots.filter((slot) => {
    if (slot.capacityRemaining <= 0) return false;
    if (dismissedSlotIds.has(slot.id)) return false;
    if (favoritesOnly && !favoriteIds.has(slot.resourceId)) return false;
    if (maxDistanceMeters != null) {
      const meters =
        distanceToMeters(livePos, slot.locationLatitude, slot.locationLongitude) ??
        slot.distanceMeters ??
        null;
      if (meters == null || meters > maxDistanceMeters) return false;
    }
    return true;
  });

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
        imageUri: imageForSlot(slot),
        capacityLabel: String(slot.capacityRemaining),
        distanceLabel: meters != null ? formatDistance(meters) : null,
        actionLabel: "Ver detalles",
      });
    }
    return [...byResource.values()];
  }, [availableSlots, livePos, now, imageForSlot]);

  // The map's peek card opens the resource's detail screen (or the pane, on
  // wide layouts) rather than booking directly — picking a slot/seats still
  // needs the detail screen's context, same as tapping a "MÁS TARDE HOY" row.
  function openResourceFromMap(resourceId: string) {
    const slot = availableSlots.find((s) => s.resourceId === resourceId);
    if (slot) handleOpenResource(slot);
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
          // Brief pause (400ms) before the card exits — gives the tap a
          // moment to register before the row vanishes from under it.
          setTimeout(() => {
            setDismissedSlotIds((prev) => withId(prev, slot.id));
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
    sortTouched.current = true;
    // `bootstrap()` (app start) already resolved this most of the time — only
    // fall back to asking again if it hasn't (e.g. the store hasn't finished
    // yet, or something cleared `position`). `requestAndGetPosition` itself
    // no-ops without re-prompting once the user has denied this session.
    if (livePos) {
      setSort("nearest");
      ensureWatching();
      return;
    }
    setLocating(true);
    const pos = await requestAndGetPosition();
    setLocating(false);
    if (pos) {
      useLocationStore.setState({ position: pos, sortAnchor: pos });
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
    sortTouched.current = true;
    if (next === "nearest") {
      void enableNearest();
    } else {
      setSort(next);
      stopWatching();
    }
  }

  // `bootstrap()` (app start, `_layout.tsx`) resolves in the background — once
  // it grants a fix, default to "nearest" (falling back to "soonest" already
  // happened, it's the initial state). Skipped once the user has touched the
  // sort control themselves, in either direction.
  useEffect(() => {
    if (sortTouched.current || locationStatus !== "granted") return;
    setSort("nearest");
    ensureWatching();
  }, [locationStatus, ensureWatching]);

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
    if (hasPane) {
      haptics.selection();
      select(slot.resourceId);
      return;
    }
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

  const paneOpen = hasPane && !!paneId;
  const cardVariant: "stacked" | "row" = hasPane ? "row" : "stacked";
  const firstName = session?.displayName?.trim().split(/\s+/)[0] ?? null;

  return (
    <Screen bg="canvas" fluid>
     <View style={{ flex: 1, flexDirection: "row" }}>
      {/* No maxWidth cap — this column fills whatever the pane (fixed
          380px, only mounted when paneOpen) doesn't take, so the row fills
          the real browser width instead of leaving a dead strip on wide
          monitors. Was capped at 760/1080px; see CLAUDE.md-adjacent PRs
          #10/#11 for why a pane needs a fluid tool screen in the first
          place — the cap itself just wasn't hooked up to the viewport. */}
      <View style={{ flex: 1 }}>
      {/* Fixed header — the `pb-4` keeps a gap between the controls and the
          list even while the list scrolls under it (a scrolled
          contentContainer top-padding would disappear). */}
      <View className="px-4 pb-4 pt-3">
        {/* Redesign handoff §"Mapa · teléfono" (2026-09-14 report: "el header
            de hola se esconde") — the greeting gives up its vertical space to
            the map entirely, not a scroll-driven collapse there. In list
            view it instead collapses as soon as scrolling starts, so the
            search bar takes its place at the top (2026-09-14 report: "al
            comenzar el slide se puede ocultar el header y que el search
            quede arriba") — height/opacity/margin all animate together via
            `greetingCollapse`, and the real height is measured via
            `onLayout` rather than guessed, since the two-line name block
            can run taller than the 44px avatar depending on font metrics. */}
        {view !== "map" ? (
          <RNAnimated.View
            style={{
              opacity: greetingCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              height: greetingCollapse.interpolate({
                inputRange: [0, 1],
                outputRange: [greetingHeight, 0],
              }),
              marginBottom: greetingCollapse.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
              overflow: "hidden",
            }}
          >
            <View
              onLayout={(e) => setGreetingHeight(e.nativeEvent.layout.height)}
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Avatar name={firstName} photoUrl={session?.avatarUrl ?? null} size={44} />
                <View>
                  <Text className="text-body-emph text-label-3">Hola,</Text>
                  <Text className="text-title-md text-label-1">{firstName ?? "—"}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1.5">
                <NotificationBell
                  unreadCount={unreadNotificationCount}
                  onPress={() => {
                    haptics.selection();
                    router.push("/notifications");
                  }}
                />
                <RefreshButton
                  onPress={() => availabilityQuery.refetch()}
                  refreshing={isRefreshing}
                />
                {/* No idle-state date/time here on purpose (2026-09-15
                    report: "la hora en el header no tiene mucho sentido, ya
                    que la barra del sistema con la hora esta al lado") —
                    only real transient status, which the system clock can't
                    show. */}
                {locating || isRefreshing ? (
                  <Text className="text-footnote text-label-3">
                    {locating ? "Ubicando…" : "Actualizando…"}
                  </Text>
                ) : null}
              </View>
            </View>
          </RNAnimated.View>
        ) : null}

        <View className="gap-4">
        <View
          className="h-[52px] flex-row items-center gap-2.5 rounded-full bg-fill"
          // Inline, not `pl-4 pr-1.5` — confirmed via getComputedStyle that
          // combination generated no padding at all (0px both sides), the
          // same class of NativeWind gotcha as elsewhere in this project —
          // left the search icon flush against the pill's rounded edge
          // instead of the intended 16px/6px breathing room (2026-09-14
          // report).
          style={{ paddingLeft: 16, paddingRight: 6 }}
        >
          <Search size={18} strokeWidth={2} color={searchIconColor} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Buscar sala, cabina, piso…"
            placeholderTextColor="#8A8A8E"
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="flex-1 text-subhead text-label-1"
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              setFilterSheetOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Filtros"
            className="h-10 w-10 items-center justify-center rounded-full bg-tint"
          >
            <SlidersHorizontal size={18} strokeWidth={2} color={filterIconColor} />
            {minCapacity > 0 || maxDistanceKm != null ? (
              <View
                className="bg-state-error"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                }}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Redesign handoff §"Mapa · teléfono" (2026-09-14 report: "filtros
            pierden el ícono") — categories are plain text pills on the map,
            not the icon circles the list uses. Same selection state either
            way (`FilterPills` and `CategoryCircles` share that API on
            purpose), so switching view never resets the filter. */}
        {view === "map" ? (
          <FilterPills
            options={categoryOptions}
            selectedId={selectedResourceTypeId}
            onSelect={setSelectedResourceTypeId}
          />
        ) : (
          <CategoryCircles
            options={categoryOptions}
            selectedId={selectedResourceTypeId}
            onSelect={setSelectedResourceTypeId}
            circleSize={hasPane ? 48 : 54}
          />
        )}

        {view !== "map" ? (
          <>
            <NextBookingBanner
              booking={nextBooking}
              onOpenPass={() => setPassBooking(nextBooking)}
            />
            <StaleStamp
              dataUpdatedAt={availabilityQuery.dataUpdatedAt}
              className="pl-1 text-footnote text-label-4"
            />
          </>
        ) : null}

        {mapAvailable && isWide ? (
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

        {view !== "map" ? (
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
        ) : null}
        </View>
      </View>

      <View style={{ flex: 1 }}>
      {view === "map" && mapAvailable ? (
        <SpaceMap
          places={mapPlaces}
          selectedId={selectedMapId}
          onSelect={(id) => setSelectedMapId((cur) => (cur === id ? null : id))}
          onAction={openResourceFromMap}
          userPosition={livePos}
        />
      ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          gap: 20,
          paddingHorizontal: 16,
          paddingBottom: isWide ? 16 : 96,
        }}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
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
            <View className="gap-3">
              <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
                LIBRE AHORA MISMO
              </Text>
              <View style={{ gap: 14 }}>
                {nowGroup.map((slot) => {
                  const status = statusFor(slot, false);
                  return (
                    <Animated.View
                      key={slot.id}
                      layout={LinearTransition.springify()}
                      exiting={FadeOut}
                    >
                      <ResourceCard
                        variant={cardVariant}
                        name={slot.resourceName}
                        imageUri={imageForSlot(slot)}
                        locationName={slot.locationName}
                        capacityLabel={String(slot.capacityRemaining)}
                        statusTone={status.tone}
                        statusLabel={status.label}
                        timeLabel={timeWindowFor(slot, false)}
                        distanceLabel={slotDistance(slot)}
                        isFavorite={favoriteIds.has(slot.resourceId)}
                        onToggleFavorite={() => handleToggleFavorite(slot)}
                        onBook={() => handleBook(slot)}
                        onPress={() => handleOpenResource(slot)}
                        bookLoading={pendingSlotIds.has(slot.id)}
                        selected={paneId === slot.resourceId}
                        actionAccessibilityLabel={`Apartar ${slot.resourceName} ahora, hasta ${formatTime(slot.endsAt)}`}
                      />
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!showSkeleton && laterGroup.length > 0 ? (
            <View className="gap-3">
              <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
                {laterHeader}
              </Text>
              <View style={{ gap: 14 }}>
                {laterGroup.map((slot) => {
                  const status = statusFor(slot, true);
                  return (
                    <ResourceCard
                      key={slot.id}
                      variant={cardVariant}
                      name={slot.resourceName}
                      imageUri={imageForSlot(slot)}
                      locationName={slot.locationName}
                      capacityLabel={String(slot.capacityRemaining)}
                      statusTone={status.tone}
                      statusLabel={status.label}
                      timeLabel={timeWindowFor(slot, true)}
                      distanceLabel={slotDistance(slot)}
                      isFavorite={favoriteIds.has(slot.resourceId)}
                      onToggleFavorite={() => handleToggleFavorite(slot)}
                      onBook={() => handleBook(slot)}
                      onPress={() => handleOpenResource(slot)}
                      bookLoading={pendingSlotIds.has(slot.id)}
                      selected={paneId === slot.resourceId}
                      actionAccessibilityLabel={`Apartar ${slot.resourceName}, ${formatTime(slot.startsAt)}`}
                    />
                  );
                })}
              </View>
            </View>
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

      {!isWide && mapAvailable ? (
        <MapListFab
          view={view}
          onToggle={() => {
            haptics.selection();
            setView((v) => (v === "list" ? "map" : "list"));
          }}
          // Same small distance above the tab bar in both views — list
          // view's toggle ("Mapa") was left at the old, too-high 96 offset
          // when only the map view's ("Lista") got fixed, which is exactly
          // what "mapa mantiene la posicion original" (2026-09-14 report)
          // called out: measured live, it left the same ~97px dead gap
          // above the tab bar that map view had before that fix. The
          // ScrollView's own paddingBottom (96, below) is unrelated to
          // this — it only needs to clear the FAB's own height so the last
          // visible card isn't covered, and MAP_TOGGLE_BOTTOM plus the
          // FAB's height still fits comfortably inside it.
          bottomOffset={MAP_TOGGLE_BOTTOM}
        />
      ) : null}
      </View>
      </View>

      {paneOpen ? (
        <ResourcePane
          id={paneId!}
          onClose={clear}
          onBook={handleBook}
          pendingSlotIds={pendingSlotIds}
        />
      ) : null}
     </View>

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
      <BookingPassSheet
        isOpen={!!passBooking}
        onClose={() => setPassBooking(null)}
        code={passBooking?.code ?? null}
        resourceName={passBooking?.resourceName ?? null}
        schedule={
          passBooking
            ? `${formatTime(passBooking.startsAt)} – ${formatTime(passBooking.endsAt)}`
            : null
        }
        checkedInAt={passBooking?.checkedInAt ?? null}
      />
      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        minCapacity={minCapacity}
        onMinCapacityChange={setMinCapacity}
        maxDistanceKm={maxDistanceKm}
        onMaxDistanceKmChange={setMaxDistanceKm}
        locationAvailable={!!livePos}
        onClear={() => {
          setMinCapacity(0);
          setMaxDistanceKm(null);
        }}
      />
    </Screen>
  );
}
