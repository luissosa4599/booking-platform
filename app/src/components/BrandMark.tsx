import { View } from "react-native";

interface BrandMarkProps {
  /** Overall bounding-box size in px. */
  size?: number;
}

// Tempo's real icon mark — geometry + colors read directly from
// tempo-icon.svg (1024x1024 viewBox): a solid background square plus the
// three-block "T" (left bar, right bar, stem), scaled down as plain Views
// (percentage geometry, no SVG lib / bitmap needed — same "pure geometry, no
// bitmaps to copy" approach lib/brand.ts already uses for the other brand
// assets). Paints its own background on purpose, unlike the splash's
// transparent mark — the light-toned blocks are only legible against it, so
// the caller should clip this to whatever shape it needs (HostCta clips it
// to a circle) instead of layering another background behind it.
const BG = "#B8481D";
const LIGHT = "#FBEFE8";
const MID = "#EDB694";

export function BrandMark({ size = 28 }: BrandMarkProps) {
  const s = size / 1024;

  return (
    <View style={{ width: size, height: size, backgroundColor: BG }}>
      <View
        style={{
          position: "absolute",
          left: 184.32 * s,
          top: 290.82 * s,
          width: 312.32 * s,
          height: 163.84 * s,
          borderRadius: 46 * s,
          backgroundColor: LIGHT,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 527.36 * s,
          top: 290.82 * s,
          width: 312.32 * s,
          height: 163.84 * s,
          borderRadius: 46 * s,
          backgroundColor: MID,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 430.08 * s,
          top: 495.62 * s,
          width: 163.84 * s,
          height: 312.32 * s,
          borderRadius: 46 * s,
          backgroundColor: LIGHT,
        }}
      />
    </View>
  );
}
