import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useJoinWaitlist } from "@/lib/api/waitlist";
import { demoUserId } from "@/lib/userId";

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
  /** Raw backend message — shown as a small selectable footnote, never as the main copy. */
  technicalMessage?: string;
}

// Simplified vs. the handoff's spec: it describes a "CERCA DE LO QUE
// QUERÍAS" group with two precomputed alternative slots
// (`{conflict, alternatives: [...]}` in the 409 body). The backend's actual
// 409 body is just `{message, availabilitySlotId}` — alternative-slot
// suggestion is a real recommendation feature, out of scope for the core
// booking endpoints (see docs/session-log.md). This renders what the API
// actually returns; the alternatives group is left out rather than faked.
export function ConflictSheet({
  isOpen,
  onClose,
  slotId,
  slotStartsAt,
  technicalMessage,
}: ConflictSheetProps) {
  const joinWaitlist = useJoinWaitlist();

  // Retained during render (not an effect, not a ref) so the sheet still has
  // real content while it plays its close transition, after the caller's own
  // `slotId`/`slotStartsAt` have already gone back to `null`.
  const [lastSlotId, setLastSlotId] = useState(slotId);
  if (slotId && slotId !== lastSlotId) {
    setLastSlotId(slotId);
  }
  const [lastSlotStartsAt, setLastSlotStartsAt] = useState(slotStartsAt);
  if (slotStartsAt && slotStartsAt !== lastSlotStartsAt) {
    setLastSlotStartsAt(slotStartsAt);
  }

  const startTime = lastSlotStartsAt
    ? new Date(lastSlotStartsAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-title-md text-label-1">Alguien se adelantó</Text>
          <Text className="text-body text-label-3">
            Las {startTime} se llenaron mientras confirmabas. No guardamos nada.
          </Text>
        </View>

        <View className="gap-2">
          <Button
            variant="gray"
            loading={joinWaitlist.isPending}
            disabled={joinWaitlist.isSuccess || !lastSlotId}
            onPress={() =>
              lastSlotId &&
              joinWaitlist.mutate({ availabilitySlotId: lastSlotId, userId: demoUserId })
            }
          >
            {joinWaitlist.isSuccess ? "Te anotamos" : `Anotarme para las ${startTime}`}
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
