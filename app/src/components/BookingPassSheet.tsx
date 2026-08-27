import { useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Sheet } from "@/components/Sheet";

interface BookingPassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Nullable + retained internally, same pattern as ConflictSheet: the caller
  // clears its selection the instant it flips `isOpen` to false, but the sheet
  // still needs something to show while it animates closed.
  code: string | null;
  resourceName: string | null;
  schedule: string | null;
}

// Handoff § "05": "'Ver pase' abre una Sheet con el código en grande y un QR.
// (No diseñada aquí — mismo Group, código a 34px tabular-nums.)"
export function BookingPassSheet({
  isOpen,
  onClose,
  code,
  resourceName,
  schedule,
}: BookingPassSheetProps) {
  const [lastCode, setLastCode] = useState(code);
  if (code && code !== lastCode) setLastCode(code);
  const [lastName, setLastName] = useState(resourceName);
  if (resourceName && resourceName !== lastName) setLastName(resourceName);
  const [lastSchedule, setLastSchedule] = useState(schedule);
  if (schedule && schedule !== lastSchedule) setLastSchedule(schedule);

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="items-center gap-6">
        <View className="items-center gap-1">
          {lastName ? (
            <Text className="text-title-sm text-center text-label-1">
              {lastName}
            </Text>
          ) : null}
          {lastSchedule ? (
            <Text
              className="text-body text-label-3"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {lastSchedule}
            </Text>
          ) : null}
        </View>

        {/* QR sits on its own white tile so it scans regardless of theme —
            react-native-qrcode-svg needs literal colors, not classNames. */}
        <View className="rounded-[18px] bg-white p-4">
          <QRCode value={lastCode ?? "—"} size={180} backgroundColor="#FFFFFF" color="#0B0B0C" />
        </View>

        <Text
          className="text-label-1"
          style={{ fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] }}
        >
          {lastCode ?? "—"}
        </Text>
      </View>
    </Sheet>
  );
}
