import { Screen } from "@/components/Screen";
import { ProfileContent } from "@/components/ProfileContent";

export default function OwnerProfileScreen() {
  return (
    <Screen bg="canvas" maxWidth={720}>
      <ProfileContent />
    </Screen>
  );
}
