import {
  createHashRouter,
  isRouteErrorResponse,
  Navigate,
  useRouteError,
} from "react-router";
import { Login } from "./components/Login";
import { AdminCDAList } from "./components/AdminCDAList";
import { CDAVendedoresList } from "./components/CDAVendedoresList";
import { VendorDashboard } from "./components/VendorDashboard";
import { RequireAdmin, RequireVendor } from "../lib/auth";

function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Ocurrió un error inesperado.";

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <section className="max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
        <h1 className="text-xl font-bold text-gray-900">No se pudo cargar esta pantalla</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <a
          href="#/"
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Volver al inicio
        </a>
      </section>
    </main>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    Component: Login,
    errorElement: <RouteError />,
  },
  {
    Component: RequireAdmin,
    errorElement: <RouteError />,
    children: [
      {
        path: "/admin",
        Component: AdminCDAList,
      },
      {
        path: "/cda/:cdaId",
        Component: CDAVendedoresList,
      },
    ],
  },
  // Ruta antigua (datos de ejemplo): el administrador sigue entrando desde la lista.
  // Se eliminará cuando los paneles lean de Supabase.
  {
    path: "/cda/:cdaId/vendedor/:vendedorId",
    Component: RequireVendor,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        Component: VendorDashboard,
      },
    ],
  },
  // Ruta nueva: cada vendedor entra a su panel con su UUID de Supabase.
  {
    path: "/vendedor/:vendedorId",
    Component: RequireVendor,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        Component: VendorDashboard,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
