/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as IndexImport } from './routes/index'
import { Route as ConfiguracionMediosImport } from './routes/configuracion/medios'

// Create/Update Routes

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const ConfiguracionMediosRoute = ConfiguracionMediosImport.update({
  id: '/configuracion/medios',
  path: '/configuracion/medios',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/configuracion/medios': {
      id: '/configuracion/medios'
      path: '/configuracion/medios'
      fullPath: '/configuracion/medios'
      preLoaderRoute: typeof ConfiguracionMediosImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/configuracion/medios': typeof ConfiguracionMediosRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/configuracion/medios': typeof ConfiguracionMediosRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/configuracion/medios': typeof ConfiguracionMediosRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/configuracion/medios'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/configuracion/medios'
  id: '__root__' | '/' | '/configuracion/medios'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ConfiguracionMediosRoute: typeof ConfiguracionMediosRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ConfiguracionMediosRoute: ConfiguracionMediosRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/configuracion/medios"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/configuracion/medios": {
      "filePath": "configuracion/medios.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
