import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Placeholder } from "@/components/Placeholder";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SpacePane } from "@/components/SpacePane";
import { useOwnerSpaces } from "@/lib/api/owner";
import { haptics } from "@/lib/haptics";
import { Store } from "@/lib/icons";
import { useUserId } from "@/lib/session";
import { useHasDetailPane } from "@/lib/useBreakpoint";
import { useDetailSelection } from "@/lib/useDetailSelection";

export default function MySpacesScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { data: spaces, isLoading } = useOwnerSpaces(userId);

  const isEmpty = !isLoading && (spaces?.length ?? 0) === 0;

  // Desktop master–detail: tapping a space opens a read-only SpacePane; the
  // list stays mounted. Tablet/phone push the full (owner)/space/[id] screen.
  const hasPane = useHasDetailPane();
  const { selectedId, select, clear } = useDetailSelection();
  const paneId =
    hasPane && selectedId && (spaces ?? []).some((s) => s.id === selectedId)
      ? selectedId
      : null;

  return (
    <Screen bg="canvas" edges={["top", "bottom"]} fluid>
     <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1, maxWidth: paneId ? 760 : 1080 }}>
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
            flexGrow: 1,
          }}
        >
          <Text className="text-title-lg text-label-1">Mis espacios</Text>

          {isEmpty ? (
            <View className="flex-1 items-center justify-center">
              <Placeholder
                icon={<Store size={26} />}
                title="Aún no publicas nada"
                body="Publica un espacio, define sus horarios y aparecerá en Explorar."
                reason="noBookings"
                primaryAction={{
                  label: "Publicar un espacio",
                  onPress: () => router.push("/(owner)/space/new"),
                }}
                secondaryAction={{
                  label: "Cómo funciona",
                  onPress: () => router.push("/become-host"),
                }}
              />
            </View>
          ) : (
            <View className="mt-6 gap-6">
              <Group>
                {(spaces ?? []).map((space) => (
                  <Row
                    key={space.id}
                    title={space.name}
                    subtitle={space.locationName}
                    meta={
                      space.hasSchedule || space.upcomingSlotCount > 0
                        ? `${space.upcomingSlotCount} horarios`
                        : "Sin horarios"
                    }
                    metaTone={space.upcomingSlotCount > 0 ? "default" : "last"}
                    trailing="chevron"
                    onPress={() => {
                      if (hasPane) {
                        haptics.selection();
                        select(space.id);
                      } else {
                        router.push(`/(owner)/space/${space.id}`);
                      }
                    }}
                  />
                ))}
              </Group>
              <Text className="pl-1 text-footnote text-label-4">
                Los horarios se cuentan sobre los próximos 7 días.
              </Text>
            </View>
          )}
        </ScrollView>

        {!isEmpty ? (
          <View className="border-t border-hairline-inset bg-glass px-4 pb-3 pt-3">
            <Button
              variant="filled"
              onPress={() => router.push("/(owner)/space/new")}
            >
              Publicar un espacio
            </Button>
          </View>
        ) : null}
      </View>
      </View>

      {paneId ? <SpacePane id={paneId} onClose={clear} /> : null}
     </View>
    </Screen>
  );
}
