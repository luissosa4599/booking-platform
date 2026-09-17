import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

interface QrPassTileProps {
  code: string | null;
  size: number;
  /** Dims the code once a host has already checked the visitor in. */
  dimmed?: boolean;
}

// The QR needs literal colors (react-native-qrcode-svg takes hex props, not
// NativeWind classNames) and a white tile so it still scans in dark mode.
// Shared by BookingPassSheet (phone/tablet pass modal, 180px) and BookingPane
// (desktop inline pass, 112px per §2.8) — previously two independent copies
// with drifting magic numbers.
export function QrPassTile({ code, size, dimmed = false }: QrPassTileProps) {
  return (
    <View className="rounded-[18px] bg-white p-4" style={{ opacity: dimmed ? 0.35 : 1 }}>
      <QRCode value={code || "—"} size={size} backgroundColor="#FFFFFF" color="#0B0B0C" />
    </View>
  );
}
