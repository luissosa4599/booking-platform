const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// lucide-react-native's ESM entry imports each icon as a relative `.mjs`
// path — Metro doesn't resolve that extension by default, which surfaces as
// "Unable to resolve module ./icons/a-arrow-down.mjs" the moment anything
// imports from the package, even indirectly.
config.resolver.sourceExts.push("mjs");

module.exports = withNativeWind(config, { input: "./src/global.css" });
