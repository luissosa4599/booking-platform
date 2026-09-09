import { Screen } from "@/components/Screen";
import { ProfileContent } from "@/components/ProfileContent";

// "Tú" — the guest-side account screen. Shared body with the host tab; see
// ProfileContent. Replaces the old "Próximamente" placeholder.
export default function ProfileScreen() {
  return (
    <Screen bg="canvas" maxWidth={640}>
      <ProfileContent />
    </Screen>
  );
}
