import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Customizes the root HTML document for the static web export (Node-only,
// no window/DOM APIs here — see Expo Router's static-rendering docs). Added
// 2026-09-21 to make "Agregar a pantalla de inicio" on iOS Safari behave
// like a real installed app (own icon, no browser chrome) — Metro's web
// export ships a bare template with no favicon/manifest/apple-touch-icon at
// all (confirmed by inspecting the built dist/index.html), unlike the older
// webpack-based Expo web bundler this project doesn't use.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Disables body scrolling so RN's <ScrollView> behaves like native
            — matches the default Expo web template's behavior exactly. */}
        <ScrollViewStyleReset />

        <link rel="icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* "Add to Home Screen" on iOS Safari. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Tempo" />
        <meta name="theme-color" content="#B8481D" />
      </head>
      <body>
        <noscript>Necesitas activar JavaScript para usar esta app.</noscript>
        {children}
      </body>
    </html>
  );
}
