import type { ComponentType } from "react";
import { Platform, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Calendar, MapPin, type IconProps } from "@/lib/icons";
import { usePermissionPromptStore, type PermissionKind } from "@/lib/permissionPrompt";
import { useColor } from "@/lib/theme/useColor";

// Copy per permission. `why` is the same reason the tutorial and Tú → Permisos
// give; `settingsSteps` says exactly where the switch lives.
const COPY: Record<
  PermissionKind,
  {
    icon: ComponentType<IconProps>;
    askTitle: string;
    settingsTitle: string;
    why: string;
    settingsSteps: string;
    webSteps: string;
    allowLabel: string;
  }
> = {
  location: {
    icon: MapPin,
    askTitle: "Permite tu ubicación para ver lo más cercano",
    settingsTitle: "Activa tu ubicación para ver lo más cercano",
    why: "Tempo usa tu ubicación solo mientras usas la app, para ordenar los espacios por cercanía y mostrarte la distancia. No guardamos tu historial.",
    settingsSteps:
      "Está desactivada para Tempo. En Configuración, entra a Permisos › Ubicación y elige «Permitir solo mientras se usa la app».",
    webSteps:
      "Tu navegador la tiene bloqueada para este sitio. Actívala desde el ícono junto a la dirección y vuelve a intentarlo.",
    allowLabel: "Permitir ubicación",
  },
  calendar: {
    icon: Calendar,
    askTitle: "Permite el acceso a tu calendario",
    settingsTitle: "Activa el calendario para agregar tu reserva",
    why: "Lo usamos solo para agregar esta reserva a tu calendario. No leemos ni modificamos tus otros eventos.",
    settingsSteps:
      "Está desactivado para Tempo. En Configuración, entra a Permisos › Calendario y elige «Permitir».",
    webSteps: "",
    allowLabel: "Permitir calendario",
  },
};

/**
 * Root-mounted. Shown by `ensurePermission()` when someone retries an action
 * whose permission they already denied — explains why, then either re-asks
 * (the system can still show its dialog) or opens the app's settings (it
 * can't anymore). See lib/permissionPrompt.ts.
 */
export function PermissionPromptSheet() {
  const kind = usePermissionPromptStore((s) => s.kind);
  const mode = usePermissionPromptStore((s) => s.mode);
  const fallback = usePermissionPromptStore((s) => s.fallback);
  const close = usePermissionPromptStore((s) => s.close);
  const askAgain = usePermissionPromptStore((s) => s.askAgain);
  const openSettings = usePermissionPromptStore((s) => s.openSettings);
  // useColor + inline style — tint classNames don't reach a Sheet's portal on web.
  const washColor = useColor("tint-wash");
  const iconColor = useColor("tint-press");

  // Keep the last kind's copy while the sheet animates closed.
  const copy = COPY[kind ?? "location"];
  const Icon = copy.icon;
  const isWeb = Platform.OS === "web";

  return (
    <Sheet isOpen={kind !== null} onClose={close}>
      <View className="gap-5">
        <View className="items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: washColor }}
          >
            <Icon size={22} color={iconColor} />
          </View>
          <Text className="text-center text-title-sm text-label-1">
            {mode === "ask" ? copy.askTitle : copy.settingsTitle}
          </Text>
          <Text className="text-center text-body text-label-3">{copy.why}</Text>
          {mode === "settings" ? (
            <Text className="text-center text-subhead text-label-2">
              {isWeb ? copy.webSteps : copy.settingsSteps}
            </Text>
          ) : null}
        </View>
        <View className="gap-2">
          {mode === "ask" ? (
            <Button variant="filled" onPress={() => void askAgain()}>
              {copy.allowLabel}
            </Button>
          ) : !isWeb ? (
            <Button variant="filled" onPress={openSettings}>
              Abrir Configuración
            </Button>
          ) : null}
          {fallback ? (
            <Button
              variant="gray"
              onPress={() => {
                close();
                fallback.run();
              }}
            >
              {fallback.label}
            </Button>
          ) : null}
          <Button variant={isWeb && mode === "settings" ? "filled" : "plain"} onPress={close}>
            {isWeb && mode === "settings" ? "Entendido" : "Ahora no"}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
