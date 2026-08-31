import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { useCreateBooking } from "@/lib/api/bookings";
import { useJoinWaitlist } from "@/lib/api/waitlist";
import type { BookingAlternative } from "@/lib/api/types";
import { haptics } from "@/lib/haptics";
import { useToastStore } from "@/lib/toastStore";

interface ConflictSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Nullable, not the conflict data directly: the caller's `conflictSlot`
  // goes back to `null` the instant `isOpen` flips to `false` (this is now
  // always-mounted, like Toast, so `Sheet` can animate the close instead of
  // being torn down mid-transition) — this component retains the last real
  // values itself so it has something to show while it fades out.
  slotId: string | null;
  slotStartsAt: string | null;
  /** Pre-calculated "next best" slots from the 409 body — see design-handoff screen 07. */
  alternatives?: BookingAlternative[];
  /** How many seats the failed attempt was for — carried into the alternative booking. */
  seats?: number;
  /** Raw backend message — shown as a small selectable footnote, never as the main copy. */
  technicalMessage?: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConflictSheet({
  isOpen,
  onClose,
  slotId,
  slotStartsAt,
  alternatives = [],
  seats = 1,
  technicalMessage,
}: ConflictSheetProps) {
  const joinWaitlist = useJoinWaitlist();
  const bookAlternative = useCreateBooking();

  // Retained during render (not an effect, not a ref) so the sheet still has
  // real content while it plays its close transition, after the caller's own
  // props have already gone back to null/empty.
  const [lastSlotId, setLastSlotId] = useState(slotId);
  if (slotId && slotId !== lastSlotId) {
    setLastSlotId(slotId);
  }
  const [lastSlotStartsAt, setLastSlotStartsAt] = useState(slotStartsAt);
  if (slotStartsAt && slotStartsAt !== lastSlotStartsAt) {
    setLastSlotStartsAt(slotStartsAt);
  }
  const [lastAlternatives, setLastAlternatives] = useState(alternatives);
  if (alternatives.length > 0 && alternatives !== lastAlternatives) {
    setLastAlternatives(alternatives);
  }

  const [pendingAltId, setPendingAltId] = useState<string | null>(null);

  const startTime = lastSlotStartsAt ? formatTime(lastSlotStartsAt) : "";

  function handleBookAlternative(alt: BookingAlternative) {
    haptics.selection();
    setPendingAltId(alt.slotId);
    bookAlternative.mutate(
      { availabilitySlotId: alt.slotId, seats },
      {
        onSettled: () => setPendingAltId(null),
        onSuccess: () => {
          useToastStore
            .getState()
            .show(`${alt.resourceName} · ${formatTime(alt.startsAt)}`, "Ver");
          onClose();
        },
        // On failure the sheet stays open; `bookAlternative.conflict` now holds
        // the fresh alternatives and the list below re-renders in place — no
        // stacked sheets, per the handoff.
      },
    );
  }

  // A retry that also 409s replaces the list in place rather than stacking.
  const shownAlternatives =
    bookAlternative.conflict?.alternatives ?? lastAlternatives;

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-title-md text-label-1">Alguien se adelantó</Text>
          <Text className="text-body text-label-3">
            Las {startTime} se llenaron mientras confirmabas. No guardamos nada.
          </Text>
        </View>

        {shownAlternatives.length > 0 ? (
          <Group header="CERCA DE LO QUE QUERÍAS" variant="canvas">
            {shownAlternatives.map((alt) => (
              <Row
                key={alt.slotId}
                title={`${alt.resourceName} · ${formatTime(alt.startsAt)}`}
                tabularTitle
                subtitle={
                  alt.seatsLeft === 1
                    ? `${alt.distanceNote} · último lugar`
                    : `${alt.distanceNote} · ${alt.seatsLeft} lugares`
                }
                trailing="action"
                actionLabel="Apartar"
                actionTone="wash"
                actionLoading={pendingAltId === alt.slotId}
                actionAccessibilityLabel={`Apartar ${alt.resourceName} a las ${formatTime(alt.startsAt)}`}
                onActionPress={() => handleBookAlternative(alt)}
              />
            ))}
          </Group>
        ) : null}

        <View className="gap-2">
          <Button
            variant="gray"
            loading={joinWaitlist.isPending}
            disabled={joinWaitlist.isSuccess || !lastSlotId}
            onPress={() =>
              lastSlotId &&
              joinWaitlist.mutate({ availabilitySlotId: lastSlotId })
            }
          >
            {joinWaitlist.isSuccess
              ? "Te anotamos"
              : `Anotarme para las ${startTime}`}
          </Button>
          <Button variant="plain" onPress={onClose}>
            Volver
          </Button>
        </View>

        {technicalMessage ? (
          <Text selectable className="text-footnote text-label-4">
            {technicalMessage}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
