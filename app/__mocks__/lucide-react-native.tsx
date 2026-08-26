// Manual mock for tests. lucide-react-native ships ESM-only .mjs files that
// Jest's default transformIgnorePatterns (node_modules aren't transformed by
// default) can't parse — and none of these tests assert anything about icon
// rendering, so a null-rendering stand-in for every icon name is enough.
// A Proxy means new icons added to lib/icons.ts never need this file
// updated. Lives in __mocks__/ (not inline via jest.mock(factory) in a test
// file) for the same reason as __mocks__/@gorhom/bottom-sheet.tsx — see that
// file's comment.
function MockIcon() {
  return null;
}

module.exports = new Proxy(
  {},
  {
    get: () => MockIcon,
  },
);
