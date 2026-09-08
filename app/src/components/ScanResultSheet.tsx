import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { SuccessCheckmark } from "@/components/SuccessCheckmark";
import type { CheckinResult } from "@/lib/api/types";
import { Check, X } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface ScanResultSheetProps {
  result: CheckinResult | null;
  isOpen: boolean;
  onClose: () => void;
  onScanAgain: () => void;
  /** "Confirmar de todos modos" on out_of_window. */
  onForce: (code: string) => void;
  /** "Código manual" on unknown_code / "Reintentar". */
  onManual: () => void;
}

// Handoff J — one Sheet, the outcome (result.status) picks the variant.
export function ScanResultSheet({
  result,
  isOpen,
  onClose,
  onScanAgain,
  onForce,
  onManual,
}: ScanResultSheetProps) {
  // Retain the last real result so the sheet has something to show while it
  // animates closed (same pattern as ConflictSheet / BookingPassSheet).
  const [last, setLast] = useState(result);
  if (result && result !== last) setLast(result);
  const r = last;

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="items-center gap-5">
        {r ? <Body r={r} isOpen={isOpen} onScanAgain={onScanAgain} onForce={onForce} onManual={onManual} /> : null}
      </View>
    </Sheet>
  );
}

function Body({
  r,
  isOpen,
  onScanAgain,
  onForce,
  onManual,
}: {
  r: CheckinResult;
  isOpen: boolean;
  onScanAgain: () => void;
  onForce: (code: string) => void;
  onManual: () => void;
}) {
  const mutedIcon = useColor("label-3");

  if (r.status === "confirmed" || r.status === "queued") {
    return (
      <>
        {isOpen ? <SuccessCheckmark /> : <View className="h-[104px]" />}
        <Text className="text-title-md text-center text-label-1">Visita confirmada</Text>
        <VisitCard r={r} />
        {r.status === "queued" ? (
          <Text className="text-center text-footnote text-label-4">
            Se confirmará al reconectar.
          </Text>
        ) : null}
        <Button variant="filled" onPress={onScanAgain}>Escanear otra</Button>
      </>
    );
  }

  if (r.status === "already_confirmed") {
    return (
      <>
        <IconCircle bg="fill">
          <Check size={24} strokeWidth={3} color={mutedIcon} />
        </IconCircle>
        <View className="items-center gap-1">
          <Text className="text-title-sm text-center text-label-1">Ya habías confirmado</Text>
          <Text className="text-subhead text-center text-label-3">
            Esta visita se confirmó a las {formatTime(r.confirmedAt)}.
          </Text>
        </View>
        <VisitCard r={r} />
        <Button variant="gray" onPress={onScanAgain}>Escanear otra</Button>
      </>
    );
  }

  if (r.status === "wrong_space") {
    return (
      <>
        <IconCircle bg="error">
          <X size={26} strokeWidth={3} color="#FFFFFF" />
        </IconCircle>
        <View className="items-center gap-1">
          <Text className="text-title-sm text-center text-label-1">
            Esta reserva es de otro espacio
          </Text>
          <Text className="text-subhead text-center text-label-3">
            {r.spaceName ? `${r.spaceName} — no la administras.` : "No la administras."}
          </Text>
        </View>
        <Button variant="gray" onPress={onScanAgain}>Escanear otra</Button>
      </>
    );
  }

  if (r.status === "out_of_window") {
    const past = r.direction === "past";
    return (
      <>
        <IconCircle bg="warn">
          <Text className="text-[26px] font-bold text-white">!</Text>
        </IconCircle>
        <View className="items-center gap-1">
          <Text className="text-title-sm text-center text-label-1">Fuera de horario</Text>
          <Text className="text-subhead text-center text-label-3">
            {past
              ? "Esta reserva ya pasó."
              : `Esta reserva es para ${r.startsAt ? formatWhen(r.startsAt) : "otro momento"}.`}
          </Text>
        </View>
        <View className="w-full gap-2">
          {!past && r.code ? (
            <Button variant="filled" onPress={() => onForce(r.code!)}>
              Confirmar de todos modos
            </Button>
          ) : null}
          <Button variant="gray" onPress={onScanAgain}>Cerrar</Button>
        </View>
      </>
    );
  }

  // unknown_code (and any unexpected status)
  return (
    <>
      <IconCircle bg="error">
        <X size={26} strokeWidth={3} color="#FFFFFF" />
      </IconCircle>
      <View className="items-center gap-1">
        <Text className="text-title-sm text-center text-label-1">
          No encontramos esa reserva
        </Text>
        {r.code ? (
          <Text
            className="text-subhead text-center text-label-3"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            Código {r.code}
          </Text>
        ) : null}
      </View>
      <View className="w-full flex-row gap-2">
        <View className="flex-1">
          <Button variant="filled" onPress={onScanAgain}>Reintentar</Button>
        </View>
        <View className="flex-1">
          <Button variant="gray" onPress={onManual}>Código manual</Button>
        </View>
      </View>
    </>
  );
}

function VisitCard({ r }: { r: CheckinResult }) {
  return (
    <View className="w-full">
      <Group variant="canvas">
        <View className="px-4 py-3">
          <Text className="text-body-emph text-label-1">
            {r.visitorName ?? "Visitante"}
          </Text>
          <Text className="text-subhead text-label-3" style={{ fontVariant: ["tabular-nums"] }}>
            {r.seats ?? 1} {(r.seats ?? 1) === 1 ? "persona" : "personas"}
            {r.code ? ` · ${r.code}` : ""}
          </Text>
        </View>
        <Row title="Espacio" trailing="text" trailingText={r.spaceName ?? "—"} />
        <Row
          title="Horario"
          trailing="text"
          trailingText={r.startsAt ? formatWhen(r.startsAt) : "—"}
        />
      </Group>
    </View>
  );
}

function IconCircle({
  bg,
  children,
}: {
  bg: "fill" | "error" | "warn";
  children: ReactNode;
}) {
  const errorColor = useColor("state-error");
  const warnColor = useColor("state-last");
  const fillColor = useColor("fill");
  const color = bg === "error" ? errorColor : bg === "warn" ? warnColor : fillColor;
  return (
    <View
      className="items-center justify-center"
      style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color }}
    >
      {children}
    </View>
  );
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}
