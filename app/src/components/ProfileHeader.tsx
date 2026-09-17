import { Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";

interface ProfileHeaderProps {
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

// Reservas/Tú handoff §3.2. Tú has no H1 — this replaces it, the name
// doubles as the screen's title. §3.6 "correo largo/nombre ausente": no name
// → the email promotes into the name line (18/24px→ single line, ellipsis)
// and the second line simply doesn't render, rather than showing an empty
// gap — the block's height stays the same either way (2 lines vs. 1).
export function ProfileHeader({ name, email, avatarUrl }: ProfileHeaderProps) {
  const displayName = name && name.trim() ? name.trim() : null;
  // Avatar's initialsFor splits on whitespace and slices a single "word" to
  // 2 chars — passing just the first letter of the email here (rather than
  // the whole address) gets exactly the "primera letra del correo" §3.6
  // asks for, with zero changes to Avatar's shared initials logic.
  const initialsSource = displayName ?? (email ? email.charAt(0).toUpperCase() : null);

  return (
    <View className="flex-row items-center gap-4">
      <Avatar name={initialsSource} photoUrl={avatarUrl} size={72} tone="solid" />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-profile-name text-label-1">
          {displayName ?? email}
        </Text>
        {displayName ? (
          <Text numberOfLines={1} className="text-footnote text-label-3">
            {email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
