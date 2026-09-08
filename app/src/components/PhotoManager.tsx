import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { Field } from "@/components/Field";
import {
  useAddSpaceImage,
  useCreateImageUploadUrl,
  useDeleteSpaceImage,
  useReorderSpaceImages,
} from "@/lib/api/owner";
import type { ResourceImage } from "@/lib/api/types";
import { uploadToSignedUrl, uriToBlob } from "@/lib/api/uploadToSignedUrl";
import { haptics } from "@/lib/haptics";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface PhotoManagerProps {
  spaceId: string;
  images: ResourceImage[];
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeOf(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType && CONTENT_TYPE_BY_EXT[asset.mimeType.split("/")[1] ?? ""]) {
    return asset.mimeType;
  }
  const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXT[ext] ?? "image/jpeg";
}

export function PhotoManager({ spaceId, images }: PhotoManagerProps) {
  const [busy, setBusy] = useState(false);
  const iconColor = useColor("label-2");
  const disabledColor = useColor("label-4");
  const dangerColor = useColor("state-error");

  const createUrl = useCreateImageUploadUrl(spaceId);
  const addImage = useAddSpaceImage(spaceId);
  const removeImage = useDeleteSpaceImage(spaceId);
  const reorder = useReorderSpaceImages(spaceId);

  async function pickAndUpload() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (picked.canceled) return;

    setBusy(true);
    try {
      for (const asset of picked.assets) {
        const contentType = contentTypeOf(asset);
        const { uploadUrl, publicUrl } = await createUrl.mutateAsync(contentType);
        const blob = await uriToBlob(asset.uri);
        await uploadToSignedUrl(uploadUrl, blob, contentType);
        await addImage.mutateAsync(publicUrl);
      }
    } catch {
      Alert.alert("No se pudo subir", "Intenta de nuevo con otra foto.");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    haptics.selection();
    reorder.mutate(next.map((i) => i.id));
  }

  return (
    <Field label="FOTOS">
      <View className="gap-2">
        {images.map((img, i) => (
          <View
            key={img.id}
            className="flex-row items-center gap-3 overflow-hidden rounded-group bg-card p-2"
          >
            <Image
              source={{ uri: img.url }}
              style={{ width: 64, height: 64, borderRadius: 10 }}
              contentFit="cover"
              transition={100}
            />
            <View className="flex-1 flex-row items-center gap-1">
              <Pressable
                onPress={() => move(i, -1)}
                disabled={i === 0}
                accessibilityLabel="Mover arriba"
                className="h-9 w-9 items-center justify-center rounded-full bg-fill"
              >
                <ArrowUp size={16} color={i === 0 ? disabledColor : iconColor} />
              </Pressable>
              <Pressable
                onPress={() => move(i, 1)}
                disabled={i === images.length - 1}
                accessibilityLabel="Mover abajo"
                className="h-9 w-9 items-center justify-center rounded-full bg-fill"
              >
                <ArrowDown
                  size={16}
                  color={i === images.length - 1 ? disabledColor : iconColor}
                />
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                haptics.selection();
                removeImage.mutate(img.id);
              }}
              accessibilityLabel="Quitar foto"
              className="h-9 w-9 items-center justify-center rounded-full bg-fill"
            >
              <Trash2 size={16} color={dangerColor} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={pickAndUpload}
          disabled={busy}
          accessibilityRole="button"
          className="h-11 flex-row items-center justify-center gap-2 rounded-group bg-fill"
        >
          <ImagePlus size={16} color={iconColor} />
          <Text className="text-subhead text-label-2">
            {busy ? "Subiendo…" : "Agregar fotos"}
          </Text>
        </Pressable>
      </View>
    </Field>
  );
}
