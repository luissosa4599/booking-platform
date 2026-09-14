import { Text, View } from "react-native";
import { Image } from "expo-image";

interface AvatarProps {
  name: string | null;
  photoUrl?: string | null;
  /** 44 (Explorar header, teléfono) or 32 (NavRail perfil). */
  size?: 44 | 32;
}

// Redesign handoff §1.1: `tint-avatar-bg`/`tint-avatar-fg` are optional new
// tokens — "si prefieres no agregar tokens, el avatar puede usar `tint-wash`
// de fondo con `tint` de texto." Taking that fallback: no new tokens needed.
export function Avatar({ name, photoUrl, size = 44 }: AvatarProps) {
  const initials = initialsFor(name);

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-tint-wash"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-semibold text-tint"
        style={{ fontSize: size === 44 ? 15 : 12 }}
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
