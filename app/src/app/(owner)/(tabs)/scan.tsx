import { useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import { ScanResultSheet } from "@/components/ScanResultSheet";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { useSubmitCheckin, useCheckinQueueDrain } from "@/lib/api/checkins";
import { BRAND } from "@/lib/brand";
import { Camera, X } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

const CODE_RE = /^[A-Z]{2,4}-?\d{3,4}$/;

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const iconColor = useColor("chevron");
  const [permission, requestPermission] = useCameraPermissions();
  const submit = useSubmitCheckin();
  useCheckinQueueDrain();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const scanLock = useRef(false);

  function run(code: string, force = false) {
    submit.mutate(
      { code, force },
      {
        onSuccess: () => setResultOpen(true),
        onSettled: () => {
          setManualOpen(false);
        },
      },
    );
  }

  function onBarcodeScanned({ data }: { data: string }) {
    if (scanLock.current || resultOpen) return;
    scanLock.current = true;
    run(data);
  }

  // --- no permission yet -------------------------------------------------
  if (!permission || !permission.granted) {
    return (
      <Screen bg="canvas">
        <View className="flex-1 items-center justify-center">
          <Placeholder
            icon={<Camera size={26} color={iconColor} />}
            title="Permite el acceso a la cámara"
            body="Tempo la usa solo para leer el QR de las reservas. Nada se guarda."
            reason="noResults"
            primaryAction={{
              label: permission?.canAskAgain === false ? "Abrir ajustes" : "Permitir cámara",
              onPress:
                permission?.canAskAgain === false
                  ? () => Linking.openSettings()
                  : () => void requestPermission(),
            }}
            secondaryAction={{
              label: "Ingresar código manualmente",
              onPress: () => setManualOpen(true),
            }}
          />
        </View>
        <ManualSheet
          isOpen={manualOpen}
          value={manualCode}
          onChange={setManualCode}
          busy={submit.isPending}
          onClose={() => setManualOpen(false)}
          onSubmit={() => run(manualCode)}
        />
        <ScanResultSheet
          result={submit.data ?? null}
          isOpen={resultOpen}
          onClose={() => {
            setResultOpen(false);
            scanLock.current = false;
          }}
          onScanAgain={() => {
            setResultOpen(false);
            scanLock.current = false;
          }}
          onForce={(code) => run(code, true)}
          onManual={() => {
            setResultOpen(false);
            scanLock.current = false;
            setManualOpen(true);
          }}
        />
      </Screen>
    );
  }

  // --- immersive camera ------------------------------------------------
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: BRAND.ink }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onBarcodeScanned}
      />

      <Pressable
        onPress={() => router.replace("/(owner)/(tabs)")}
        accessibilityRole="button"
        accessibilityLabel="Cerrar el escáner"
        style={{ position: "absolute", top: insets.top + 8, left: 16 }}
        className="h-9 w-9 items-center justify-center rounded-full"
        hitSlop={8}
      >
        <View style={{ backgroundColor: "rgba(255,255,255,0.14)" }} className="h-9 w-9 items-center justify-center rounded-full">
          <X size={18} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={StyleSheet.absoluteFill} className="items-center justify-center gap-11 px-8">
        <Text style={{ color: "rgba(255,255,255,0.92)" }} className="text-body font-medium">
          Apunta al QR de la reserva
        </Text>
        <View style={{ width: 262, height: 262 }}>
          <Corner style={{ top: 0, left: 0 }} />
          <Corner style={{ top: 0, right: 0 }} />
          <Corner style={{ bottom: 0, left: 0 }} />
          <Corner style={{ bottom: 0, right: 0 }} />
        </View>
      </View>

      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 24 }}
        className="items-center"
      >
        <Pressable
          onPress={() => setManualOpen(true)}
          accessibilityRole="button"
          style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
          className="h-12 items-center justify-center rounded-button px-6"
        >
          <Text className="text-body-emph text-white">Ingresar código manualmente</Text>
        </Pressable>
      </View>

      <ManualSheet
        isOpen={manualOpen}
        value={manualCode}
        onChange={setManualCode}
        busy={submit.isPending}
        onClose={() => setManualOpen(false)}
        onSubmit={() => run(manualCode)}
      />
      <ScanResultSheet
        result={submit.data ?? null}
        isOpen={resultOpen}
        onClose={() => {
          setResultOpen(false);
          scanLock.current = false;
        }}
        onScanAgain={() => {
          setResultOpen(false);
          scanLock.current = false;
        }}
        onForce={(code) => run(code, true)}
        onManual={() => {
          setResultOpen(false);
          scanLock.current = false;
          setManualOpen(true);
        }}
      />
    </View>
  );
}

function Corner({ style }: { style: object }) {
  return (
    <View
      style={[
        {
          position: "absolute",
          width: 44,
          height: 44,
          borderColor: "#FFFFFF",
          borderWidth: 3,
        },
        style,
      ]}
    />
  );
}

function ManualSheet({
  isOpen,
  value,
  onChange,
  busy,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const placeholderColor = useColor("label-4");
  const valid = CODE_RE.test(value.trim().toUpperCase());
  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-5">
        <Text className="text-title-sm text-label-1">Ingresar código</Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.toUpperCase())}
          placeholder="BOR-1234"
          placeholderTextColor={placeholderColor}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
          style={{ fontVariant: ["tabular-nums"] }}
        />
        <Button
          variant="filled"
          disabled={!valid}
          loading={busy}
          onPress={onSubmit}
        >
          Confirmar visita
        </Button>
      </View>
      {Platform.OS === "ios" ? <View className="h-8" /> : null}
    </Sheet>
  );
}
