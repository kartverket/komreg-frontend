import { useState, type ReactNode } from "react";
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link as RouterLink,
  Outlet,
  RouterProvider,
  type RouterHistory,
} from "@tanstack/react-router";
import { Link } from "@kv-designsystem/react";
import { ErrorPage } from "./pages/ErrorPage";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { NewRegulering } from "./pages/NewRegulering";
import { ReguleringDetail } from "./pages/ReguleringDetail";
import { Reguleringer } from "./pages/Reguleringer";

export type MapSearchParams = { lat?: number; lon?: number; zoom?: number };

// Every page but the map: the nav, then the content in a width-capped <main>.
function Layout({ children }: { children: ReactNode }) {
  return (
    <main>
      <nav style={{ display: "flex", gap: "var(--ds-size-4)" }}>
        <Link asChild>
          <RouterLink to="/">Hjem</RouterLink>
        </Link>
        <Link asChild>
          <RouterLink to="/kart">Kart</RouterLink>
        </Link>
        <Link asChild>
          <RouterLink to="/reguleringer">Reguleringer</RouterLink>
        </Link>
      </nav>
      {children}
    </main>
  );
}

function createAppRouter(history: RouterHistory) {
  // The unknown path matches only the root, so the not-found page brings its own layout.
  // Errors are caught here too, and only here: no route has its own errorComponent, so an error
  // anywhere bubbles to the root and the page is replaced whole, layout included. A
  // `defaultErrorComponent` would render inside the failing route's parent instead, giving two
  // navs under `layout` and none on the map.
  const rootRoute = createRootRoute({
    notFoundComponent: () => (
      <Layout>
        <NotFound />
      </Layout>
    ),
    errorComponent: () => (
      <Layout>
        <ErrorPage />
      </Layout>
    ),
  });
  // Pathless: groups the pages that share the layout. The map sits outside it, since it's the
  // whole window. Decided by the route tree, not by checking the path while rendering, which
  // would remount the map once its lazy route finished loading.
  const layout = createRoute({
    getParentRoute: () => rootRoute,
    id: "layout",
    component: () => (
      <Layout>
        <Outlet />
      </Layout>
    ),
  });
  const routeTree = rootRoute.addChildren([
    layout.addChildren([
      createRoute({ getParentRoute: () => layout, path: "/", component: Home }),
      createRoute({ getParentRoute: () => layout, path: "/reguleringer", component: Reguleringer }),
      createRoute({
        getParentRoute: () => layout,
        path: "/reguleringer/ny",
        component: NewRegulering,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/reguleringer/$reguleringId",
        remountDeps: ({ params }) => params,
        component: ReguleringDetail,
      }),
    ]),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/kart",
      // Map position lives in the URL so a refresh keeps it. All three or none.
      validateSearch: (search: Record<string, unknown>): MapSearchParams => {
        const { lat, lon, zoom } = search;
        if (lat == null || lon == null || zoom == null) return {};
        const position = { lat: Number(lat), lon: Number(lon), zoom: Number(zoom) };
        return Object.values(position).every(Number.isFinite) ? position : {};
      },
      // Its own chunk: OpenLayers is heavy, and the front page shouldn't wait for it.
      component: lazyRouteComponent(() => import("./pages/MapPage"), "MapPage"),
    }),
  ]);
  return createRouter({ routeTree, history });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

export function App({ history }: { history?: RouterHistory }) {
  const [router] = useState(() => createAppRouter(history ?? createBrowserHistory()));
  return <RouterProvider router={router} />;
}
