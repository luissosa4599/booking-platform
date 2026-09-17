import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";

import { useColor } from "@/lib/theme/useColor";

interface AvatarProps {
  name: string | null;
  photoUrl?: string | null;
  /** 44 (Explorar header, teléfono), 32 (NavRail perfil), or 72 (ProfileHeader, Tú). */
  size?: 44 | 32 | 72;
  /**
   * "wash" (default) = `tint-wash` bg + `tint` text — Explorar's greeting
   * avatar, unchanged since it decided against the two tokens below.
   * "solid" = `tint-avatar-bg`/`tint-avatar-fg` — Reservas/Tú handoff §3.2's
   * ProfileHeader avatar. Reversed the original "no new tokens" call
   * (2026-09-15) once the approved screenshot showed a bolder, more
   * saturated fill than tint-wash gives — scoped to `tone="solid"` only so
   * Explorar's 44px avatar stays exactly as it was.
   */
  tone?: "wash" | "solid";
}

const INITIALS_FONT_SIZE: Record<NonNullable<AvatarProps["size"]>, number> = {
  44: 15,
  32: 12,
  72: 24,
};

export function Avatar({ name, photoUrl, size = 44, tone = "wash" }: AvatarProps) {
  const initials = initialsFor(name);
  // 2026-09-15 report: `bg-tint-avatar-bg`/`text-tint-avatar-fg` as
  // classNames generated literally no CSS rule — confirmed via
  // getComputedStyle (backgroundColor: rgba(0,0,0,0), color: rgb(0,0,0)) —
  // the same silent-no-op NativeWind gotcha documented all over this
  // codebase, this time hitting the two newest tokens. `useColor()` + inline
  // style sidesteps it entirely, same fix already used elsewhere. Only
  // needed for `tone="solid"` — `tint-wash`/`tint` (the "wash" tone) are
  // long-established tokens that render fine as classNames.
  const solidBg = useColor("tint-avatar-bg");
  const solidFg = useColor("tint-avatar-fg");

  // 2026-09-15 report: "se perdió el avatar" — a stale/expired Google photo
  // URL (signed-URL params do expire) failed to load and there was no
  // fallback at all, just an empty box. A new `photoUrl` gets a fresh
  // chance — derived-state-from-a-changed-prop during render (not an
  // effect, which would set state synchronously and cascade a render —
  // same pattern ConflictSheet/ExploreScreen's own prevView already use).
  const [imageFailed, setImageFailed] = useState(false);
  const [lastPhotoUrl, setLastPhotoUrl] = useState(photoUrl);
  if (photoUrl !== lastPhotoUrl) {
    setLastPhotoUrl(photoUrl);
    setImageFailed(false);
  }

  if (photoUrl && !imageFailed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <View
      className={tone === "solid" ? "items-center justify-center rounded-full" : "items-center justify-center rounded-full bg-tint-wash"}
      style={{
        width: size,
        height: size,
        backgroundColor: tone === "solid" ? solidBg : undefined,
      }}
    >
      <Text
        className={tone === "solid" ? "font-bold" : "font-semibold text-tint"}
        style={{
          fontSize: INITIALS_FONT_SIZE[size],
          color: tone === "solid" ? solidFg : undefined,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

function initialsFor(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
