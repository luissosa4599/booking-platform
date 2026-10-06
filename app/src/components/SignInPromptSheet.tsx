import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { LogIn } from "@/lib/icons";
import { useSignInPromptStore } from "@/lib/requireAccount";
import { useColor } from "@/lib/theme/useColor";

/**
 * Root-mounted (next to GlobalToast). Opened by `requireAccount()` whenever a
 * guest (no session) taps something that needs an account — booking,
 * favorites, the waitlist, Reservas, publishing a space. A modal on purpose,
 * never a redirect: the guest stays where they were unless they choose to
 * sign in.
 */
export function SignInPromptSheet() {
  const router = useRouter();
  const isOpen = useSignInPromptStore((s) => s.isOpen);
  const close = useSignInPromptStore((s) => s.close);
  // Resolved via useColor + inline style, never a `bg-tint-*`/`text-tint*`
  // className — those are CSS vars that don't reach a Sheet's DOM portal on
  // web (CLAUDE.md, "Direction A redesign").
  const washColor = useColor("tint-wash");
  const iconColor = useColor("tint-press");

  return (
    <Sheet isOpen={isOpen} onClose={close}>
      <View className="gap-5">
        <View className="items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: washColor }}
          >
            <LogIn size={22} color={iconColor} />
          </View>
          <Text className="text-center text-title-sm text-label-1">
            Para acceder a esta función tienes que iniciar sesión
          </Text>
          <Text className="text-center text-body text-label-3">
            Es gratis y toma un minuto. Mientras tanto, puedes seguir explorando
            sin cuenta.
          </Text>
        </View>
        <View className="gap-2">
          <Button
            variant="filled"
            onPress={() => {
              close();
              router.push("/sign-in");
            }}
          >
            Iniciar sesión
          </Button>
          <Button variant="plain" onPress={close}>
            Ahora no
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
