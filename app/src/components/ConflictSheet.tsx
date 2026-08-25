import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useJoinWaitlist } from "@/lib/api/waitlist";
import { demoUserId } from "@/lib/userId";

interface ConflictSheetProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  slotStartsAt: string;
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

  const startTime = new Date(slotStartsAt).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
            disabled={joinWaitlist.isSuccess}
            onPress={() =>
              joinWaitlist.mutate({ availabilitySlotId: slotId, userId: demoUserId })
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
