import { useState, type ComponentType } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DisconnectCalendarSheet } from "@/components/DisconnectCalendarSheet";
import { Group } from "@/components/Group";
import { HostCta } from "@/components/HostCta";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { StatTile } from "@/components/StatTile";
import { ThemeControl } from "@/components/ThemeControl";
import { Toggle } from "@/components/Toggle";
import {
  useCalendarStatus,
  useConnectCalendar,
  useDisconnectCalendar,
} from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/client";
import { useFavorites } from "@/lib/api/favorites";
import { useMe } from "@/lib/api/me";
import { useGoogleCalendarAuth } from "@/lib/auth/googleCalendar";
import { type IconProps, Calendar, Info, LogIn, LogOut, ShieldCheck, Store, User } from "@/lib/icons";
import { requireAccount } from "@/lib/requireAccount";
import { useIsWide } from "@/lib/useBreakpoint";
import { useAuthStore, useRole, useUserId, useViewMode } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";
import { useToastStore } from "@/lib/toastStore";

// The "Tú" screen body — shared by the guest tab (`(tabs)/profile`) and the
// host tab (`(owner)/(tabs)/profile`). Identical on both sides; the "Modo
// anfitrión" row is what moves a host between the two nav groups.
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

  const isWide = useIsWide();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const calendarStatus = useCalendarStatus();
  const calendarAuth = useGoogleCalendarAuth();
  const connectCalendar = useConnectCalendar();
  const disconnectCalendar = useDisconnectCalendar();
  const calendarConfigured =
    !!calendarStatus.data?.available && calendarAuth.ready;
  const calendarConnected = !!calendarStatus.data?.connected;
  const calendarBusy = connectCalendar.isPending || disconnectCalendar.isPending;

  // 2026-09-19 report: "siempre se pide conectar... a pesar de ya estar
  // conectado" — a failed connect attempt was entirely silent (no toast, no
  // console output visible to the user), so a real failure (Google's
  // "unverified app" interstitial for this sensitive scope, a rejected
  // redirect, ...) looked identical to "nothing happened, I guess I have to
  // try again" every single time. This doesn't fix whatever's actually
  // failing server-side, but it stops hiding it — `grant === null` is a
  // real cancellation (the user closed Google's screen) and stays silent;
  // anything that throws past that point is a real failure and now says so.
  async function handleConnectCalendar() {
    try {
      const grant = await calendarAuth.authorize();
      if (!grant) return;
      await connectCalendar.mutateAsync(grant);
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { message?: string } | null) : null;
      useToastStore
        .getState()
        .show(body?.message ?? "No se pudo conectar con Google Calendar. Intenta de nuevo.");
    }
  }

  async function handleConfirmDisconnect() {
    setConfirmDisconnect(false);
    await disconnectCalendar.mutateAsync();
  }

  const version = Constants.expoConfig?.version ?? "";
  const versionLabel = version ? (
    <Text className="pl-1 text-footnote text-label-4">Tempo v{version}</Text>
  ) : null;

  // "Acerca de Tempo" + "Permisos" (2026-10-06) — the always-reachable home
  // of the demo-data / non-profit note and the per-permission explanations.
  // Shown with or without a session.
  const infoRows = (
    <>
      <Row
        icon={Info}
        title="Acerca de Tempo"
        subtitle="Versión de prueba · sin fines de lucro"
        trailing="chevron"
        onPress={() => router.push("/about")}
      />
      <Row
        icon={ShieldCheck}
        title="Permisos"
        subtitle="Para qué usamos cada uno"
        trailing="chevron"
        onPress={() => router.push("/permissions")}
      />
    </>
  );

  // Guest mode: no account yet — a way in, plus the settings that don't need
  // one. Signing in is the user's choice here, so this row may navigate.
  if (!session) {
    return (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 32, gap: 20 }}
      >
        <View className="flex-row items-center gap-4">
          <Avatar name={null} photoUrl={null} size={72} tone="solid" />
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="text-profile-name text-label-1">
              Invitado
            </Text>
            <Text numberOfLines={1} className="text-footnote text-label-3">
              Explorando sin cuenta
            </Text>
          </View>
        </View>

        <Group dividerInset={48}>
          <Row
            icon={LogIn}
            title="Iniciar sesión o crear cuenta"
            subtitle="Para apartar, guardar favoritos y recibir avisos"
            trailing="chevron"
            onPress={() => router.push("/sign-in")}
          />
        </Group>

        <View className="gap-2">
          <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
            Ajustes
          </Text>
          <Group dividerInset={48}>
            <ThemeControl />
            {infoRows}
          </Group>
        </View>

        {versionLabel}
      </ScrollView>
    );
  }

  const name = session?.displayName ?? me?.displayName ?? null;
  const hasName = !!name?.trim();
  const email = session?.email ?? me?.email ?? "";
  const avatarUrl = session?.avatarUrl ?? me?.avatarUrl ?? null;

  const identityAndStats = (
    <>
      <ProfileHeader name={name} email={email} avatarUrl={avatarUrl} />
      <View className={isWide ? "flex-1 flex-row gap-3" : "flex-row gap-3"}>
        <StatTile value={me?.streakWeeks ?? 0} label="semanas seguidas" loading={isLoading} />
        <StatTile value={me?.bookingCount ?? 0} label="reservas en total" loading={isLoading} />
      </View>
    </>
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 32, gap: 20 }}
      >
        {/* §3.1: no H1 "Tú" — ProfileHeader's name doubles as the title.
            §3.7 desktop: identity + the two StatTiles share one row. */}
        {isWide ? (
          <View className="flex-row items-center gap-6">{identityAndStats}</View>
        ) : (
          <View className="gap-5">{identityAndStats}</View>
        )}

        {role === "guest" ? (
          <HostCta
            onPress={() => {
              if (requireAccount()) router.push("/become-host");
            }}
          />
        ) : null}

        {/* Favorites (guest only) — the handoff doesn't address this block at
            all; left unstyled, in its existing reading-order spot. */}
        {role === "guest" && favorites.length > 0 ? (
          <View className="gap-2">
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

        {/* Ajustes — §3.5 order: Modo anfitrión (host-only, kept outside the
            4 canonical blocks — it's the only phone-reachable way to switch
            modes, RailModeSwitch is tablet/desktop-only) → Tema oscuro →
            Google Calendar → Cerrar sesión. dividerInset=48 aligns the
            separators with icon-row text (16 padding + 20 icon + 12 gap). */}
        <View className="gap-2">
          <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
            Ajustes
          </Text>
          <Group dividerInset={48}>
            {role === "host" ? (
              <ToggleRow
                icon={Store}
                title="Modo anfitrión"
                subtitle="Publica espacios, define horarios y confirma visitas"
                value={viewMode === "host"}
                onValueChange={(v) => setViewMode(v ? "host" : "guest")}
              />
            ) : null}
            {/* Email+password accounts created before registration asked for a
                name have none — this is how they get one (and anyone can fix
                a typo or a Google name they don't like). */}
            <Row
              icon={User}
              title={hasName ? "Tu nombre" : "Agrega tu nombre"}
              subtitle={hasName ? "Cambia cómo te saludamos" : "Para saludarte en Explorar"}
              trailing="chevron"
              onPress={() => setEditingName(true)}
            />
            <ThemeControl />
            {calendarConfigured ? (
              <CalendarRow
                connected={calendarConnected}
                busy={calendarBusy}
                onConnect={() => void handleConnectCalendar()}
                onRequestDisconnect={() => setConfirmDisconnect(true)}
              />
            ) : null}
            {infoRows}
            <Row
              icon={LogOut}
              title="Cerrar sesión"
              accessibilityLabel="Cerrar sesión"
              onPress={() => setConfirmSignOut(true)}
            />
          </Group>
        </View>

        {versionLabel}
      </ScrollView>

      <Sheet isOpen={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-title-sm text-label-1">¿Cerrar sesión?</Text>
            <Text className="text-body text-label-3">
              Vas a volver a la pantalla de inicio de sesión. Tus reservas siguen guardadas.
            </Text>
          </View>
          {/* El destructivo real es cancelar una reserva, no cerrar sesión —
              §3.5 punto 3: sin state-error aquí; el botón de confirmar del
              sheet de cancelar reserva (CancelBookingSheet) sí lo usa. */}
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

      <EditNameSheet
        isOpen={editingName}
        initialName={name ?? ""}
        onClose={() => setEditingName(false)}
      />

      <DisconnectCalendarSheet
        isOpen={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={() => void handleConfirmDisconnect()}
        confirming={disconnectCalendar.isPending}
      />
    </>
  );
}

// A Row-shaped item with a Toggle on the trailing edge instead of a chevron
// — Row's own `trailing` prop doesn't cover this case. Gains the same
// `icon` slot Row has, for "Tema oscuro"/"Modo anfitrión".
function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon?: ComponentType<IconProps>;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const iconColor = useColor("label-2");
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">
      {Icon ? <Icon size={20} strokeWidth={1.8} color={iconColor} /> : null}
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

// §3.5 point 2 — the row itself is only tappable (to connect) while
// disconnected; once connected it shows a static "Conectado" + state-free
// dot, and only that small pill opens the disconnect confirmation sheet.
// Two different root elements (Pressable vs plain View) rather than nesting
// a Pressable inside a Pressable, same trap Row.tsx already documents.
function CalendarRow({
  connected,
  busy,
  onConnect,
  onRequestDisconnect,
}: {
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onRequestDisconnect: () => void;
}) {
  const iconColor = useColor("label-2");
  const tint = useColor("tint");
  const label4 = useColor("label-4");
  const stateFree = useColor("state-free");

  const content = (
    <>
      <Calendar size={20} strokeWidth={1.8} color={iconColor} />
      <View className="flex-1 gap-[3px]">
        <Text className="text-body-emph text-label-1">Google Calendar</Text>
        <Text className="text-subhead text-label-3">Agrega tus reservas automáticamente</Text>
      </View>
      {busy ? (
        <Text style={{ fontSize: 15, color: label4 }}>…</Text>
      ) : connected ? (
        <Pressable
          onPress={onRequestDisconnect}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Desconectar Google Calendar"
          className="flex-row items-center gap-1.5"
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stateFree }} />
          <Text style={{ fontSize: 15, color: label4 }}>Conectado</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: "600", color: tint }}>Conectar</Text>
      )}
    </>
  );

  if (connected) {
    return <View className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">{content}</View>;
  }

  return (
    <Pressable
      onPress={busy ? undefined : onConnect}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Conectar Google Calendar"
      className="min-h-[56px] flex-row items-center gap-3 px-4 py-3"
    >
      {content}
    </Pressable>
  );
}

// Always mounted (isOpen-driven) like the other sheets here, so it animates
// both ways. The draft is re-seeded from the current name on every open.
function EditNameSheet({
  isOpen,
  initialName,
  onClose,
}: {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
}) {
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialName);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived-state reset on the closed -> open edge (same pattern as
  // ConflictSheet), not a useEffect — react-hooks/set-state-in-effect.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(initialName);
      setError(null);
    }
  }

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialName.trim() && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(trimmed);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      onClose();
    } catch {
      setError("No pudimos guardar tu nombre. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-title-sm text-label-1">Tu nombre</Text>
          <Text className="text-body text-label-3">Así te saludamos en Explorar.</Text>
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Cómo quieres que te llamemos"
          placeholderTextColor="#8A8A8E"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={80}
          editable={!saving}
          onSubmitEditing={() => canSave && void save()}
          className="h-[52px] rounded-button border border-hairline bg-card px-4 text-body text-label-1"
        />
        {error ? <Text className="text-footnote text-state-error">{error}</Text> : null}
        <Button variant="filled" disabled={!canSave} loading={saving} onPress={() => void save()}>
          Guardar
        </Button>
        <Button variant="plain" onPress={onClose}>
          Cancelar
        </Button>
      </View>
    </Sheet>
  );
}
