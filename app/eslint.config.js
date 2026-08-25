// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const { allExtensions } = require("eslint-config-expo/flat/utils/extensions");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-config-expo computes `allExtensions` (with .native/.web/.ios/
    // .android suffixes) but only feeds the bare `jsExtensions` to the node
    // resolver, so any bare import of a platform-split file (e.g.
    // `@/components/Sheet` -> Sheet.native.tsx / Sheet.web.tsx) fails
    // import/no-unresolved even though Metro and tsc both resolve it fine.
    settings: {
      'import/resolver': {
        node: { extensions: allExtensions },
        // `@/...` imports resolve through this one (it reads tsconfig
        // `paths`), so the platform-suffix extensions have to be repeated
        // here too, not just on the node resolver above.
        typescript: { extensions: allExtensions },
      },
    },
  },
]);
