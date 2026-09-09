import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { WifiOff } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useOfflineNoticeStore } from "@/lib/offlineNoticeStore";
import { useColor } from "@/lib/theme/useColor";

/**
 * Root-mounted (next to GlobalToast). First time connectivity drops it shows a
 * one-off explainer sheet; after that, a slim persistent bar under the status
 * bar while offline. Nothing when online.
 */
export function OfflineNotice() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  const barColor = useColor("label-2");

  const hydrated = useOfflineNoticeStore((s) => s.hydrated);
  const seen = useOfflineNoticeStore((s) => s.seen);
  const hydrate = useOfflineNoticeStore((s) => s.hydrate);
  const markSeen = useOfflineNoticeStore((s) => s.markSeen);

  const [sheetOpen, setSheetOpen] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (offline && !wasOffline.current && hydrated && !seen) {
      setSheetOpen(true);
    }
    wasOffline.current = offline;
  }, [offline, hydrated, seen]);

  return (
    <>
      {offline && !sheetOpen ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top, left: 0, right: 0, zIndex: 50 }}
          className="flex-row items-center justify-center gap-1.5 bg-fill py-1.5"
        >
          <WifiOff size={13} color={barColor} />
          <Text className="text-footnote text-label-2">Sin conexión</Text>
        </View>
      ) : null}

      <Sheet
        isOpen={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          markSeen();
        }}
      >
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-title-sm text-label-1">Modo sin conexión</Text>
            <Text className="text-body text-label-3">
              Sigues pudiendo ver tus reservas y tu pase, y explorar con los
              últimos datos guardados. Apartar un lugar y publicar necesitan
              conexión — lo retomamos en cuanto vuelvas.
            </Text>
          </View>
          <Button
            variant="filled"
            onPress={() => {
              setSheetOpen(false);
              markSeen();
            }}
          >
            Entendido
          </Button>
        </View>
      </Sheet>
    </>
  );
}
