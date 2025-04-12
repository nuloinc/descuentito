import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "src/components/DefaultCatchBoundary";
import { NotFound } from "src/components/NotFound";
import appCss from "@/styles/app.css?url";
import { seo } from "src/utils/seo";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "description",
        content:
          "Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo.",
      },
      {
        name: "theme-color",
        content: "#ffffff",
      },
      {
        name: "mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "default",
      },
      {
        property: "og:title",
        content: "descuentito.ar - Descuentos en supermercados",
      },
      {
        property: "og:description",
        content:
          "Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo.",
      },
      {
        property: "og:image",
        content: "/og.png",
      },
      {
        property: "og:url",
        content: "https://descuentito.ar",
      },
      {
        property: "og:type",
        content: "website",
      },
      ...seo({
        title: "descuentito.ar - Descuentos en supermercados",
        description:
          "Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo.",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    darkModeQuery.addEventListener("change", updateTheme);

    if (darkModeQuery.matches) {
      document.documentElement.classList.add("dark");
    }

    return () => darkModeQuery.removeEventListener("change", updateTheme);
  }, []);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}

        <footer className="mb-24 mt-8 flex flex-col items-center justify-center gap-3 px-2 py-4 text-center text-gray-500">
          <p>
            Los resultados mostrados son generados automaticamente. Siempre
            verifica la información en la fuente original.
          </p>
          <p>Marcas registradas pertenecen a sus respectivos dueños.</p>
        </footer>

        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
