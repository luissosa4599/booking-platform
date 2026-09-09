import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { Toggle } from "@/components/Toggle";
import { useFavorites } from "@/lib/api/favorites";
import { useMe } from "@/lib/api/me";
import { useAuthStore, useRole, useUserId, useViewMode } from "@/lib/session";
import { useThemeStore } from "@/lib/theme/themeStore";
import { useIsDark } from "@/lib/theme/useColor";

// The "Tú" screen body — shared by the guest tab (`(tabs)/profile`) and the
// host tab (`(owner)/(tabs)/profile`). Identical on both sides; the "Modo
// anfitrión" switch is what moves a host between the two nav groups.
export function ProfileContent() {
  const router = useRouter();
  const userId = useUserId();
  const role = useRole();
  const viewMode = useViewMode();
  const session = useAuthStore((s) => s.session);
  const setViewMode = useAuthStore((s) => s.setViewMode);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: me, isLoading } = useMe(userId);
  const { favorites } = useFavorites();

  const isDark = useIsDark();
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const name = session?.displayName ?? me?.displayName ?? session?.email ?? "";
  const email = session?.email ?? me?.email ?? "";
  const initials = initialsOf(name || email);
  const avatarUrl = session?.avatarUrl ?? me?.avatarUrl ?? null;

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
      >
        <Text className="text-title-lg text-label-1">Tú</Text>

        {/* Identity */}
        <View className="mt-6 flex-row items-center gap-4 px-1">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 64, height: 64, borderRadius: 9999 }}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-fill">
              <Text className="text-[24px] font-semibold text-label-3">{initials}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text numberOfLines={1} className="text-title-sm text-label-1">
              {name}
            </Text>
            <Text numberOfLines={1} className="text-subhead text-label-3">
              {email}
            </Text>
          </View>
        </View>

        {/* Stats — two cells + a vertical inset divider, not a Row list */}
        <View className="mt-6 gap-2">
          <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
            Tu actividad
          </Text>
          <View className="flex-row overflow-hidden rounded-group bg-card">
            <StatCell
              value={me?.streakWeeks}
              label="semanas seguidas"
              loading={isLoading}
            />
            <View className="w-px bg-hairline-inset" />
            <StatCell
              value={me?.bookingCount}
              label="reservas"
              loading={isLoading}
            />
          </View>
        </View>

        {/* Actions */}
        <View className="mt-6">
          <Group>
            {role === "guest" ? (
              <Row
                title="Publica tu espacio"
                subtitle="Renta salas, escritorios o lo que quieras"
                trailing="chevron"
                onPress={() => router.push("/become-host")}
              />
            ) : (
              <ToggleRow
                title="Modo anfitrión"
                subtitle="Publica espacios, define horarios y confirma visitas"
                value={viewMode === "host"}
                onValueChange={(v) => setViewMode(v ? "host" : "guest")}
              />
            )}
            <Row
              title="Cerrar sesión"
              accessibilityLabel="Cerrar sesión"
              onPress={() => setConfirmSignOut(true)}
            />
          </Group>
        </View>

        {/* Favorites (guest only) */}
        {role === "guest" && favorites.length > 0 ? (
          <View className="mt-6 gap-2">
            <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
              Tus favoritos
            </Text>
            <Group>
              {favorites.map((f) => (
                <Row
                  key={f.resourceId}
                  title={f.name}
                  subtitle={f.locationName}
                  trailing="chevron"
                  onPress={() =>
                    router.push({
                      pathname: "/resource/[id]",
                      params: {
                        id: f.resourceId,
                        name: f.name,
                        location: f.locationName,
                      },
                    })
                  }
                />
              ))}
            </Group>
          </View>
        ) : null}

        {/* Settings */}
        <View className="mt-6 gap-2">
          <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
            Ajustes
          </Text>
          <Group>
            <ToggleRow
              title="Tema oscuro"
              value={isDark}
              onValueChange={(v) => setThemePreference(v ? "dark" : "light")}
            />
          </Group>
        </View>

        <Text className="mt-6 pl-1 text-footnote text-label-4">Tempo v1.0.0</Text>
      </ScrollView>

      <Sheet isOpen={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-title-sm text-label-1">¿Cerrar sesión?</Text>
            <Text className="text-body text-label-3">
              Vas a volver a la pantalla de inicio. Tus reservas siguen guardadas.
            </Text>
          </View>
          <Button
            variant="gray"
            onPress={() => {
              setConfirmSignOut(false);
              void signOut();
            }}
          >
            Cerrar sesión
          </Button>
          <Button variant="plain" onPress={() => setConfirmSignOut(false)}>
            Cancelar
          </Button>
        </View>
      </Sheet>
    </>
  );
}

// A Row-shaped item with a Toggle on the trailing edge instead of a chevron.
// The Row component's `trailing` prop doesn't cover this case.
function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-[3px]">
        <Text className="text-body-emph text-label-1">{title}</Text>
        {subtitle ? (
          <Text className="text-subhead text-label-3">{subtitle}</Text>
        ) : null}
      </View>
      <Toggle
        value={value}
        onChange={onValueChange}
        accessibilityLabel={title}
      />
    </View>
  );
}

function StatCell({
  value,
  label,
  loading,
}: {
  value: number | undefined;
  label: string;
  loading: boolean;
}) {
  return (
    <View className="flex-1 px-4 py-[18px]">
      {loading || value === undefined ? (
        <View className="h-[28px] w-12 rounded-[6px] bg-fill" />
      ) : (
        <Text
          className="text-title-md text-label-1"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {value}
        </Text>
      )}
      <Text className="mt-1 text-subhead text-label-3">{label}</Text>
    </View>
  );
}

function initialsOf(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
