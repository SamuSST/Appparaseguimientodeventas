import {
  createHashRouter,
  isRouteErrorResponse,
  Navigate,
  Outlet,
  useParams,
  useRouteError,
} from "react-router";
import { mockCDAs } from "./data/mockCDAs";
import { Login } from "./components/Login";
import { AdminCDAList } from "./components/AdminCDAList";
import { CDAVendedoresList } from "./components/CDAVendedoresList";
import { VendorDashboard } from "./components/VendorDashboard";

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

function RequireAdmin() {
  return localStorage.getItem("userRole") === "admin"
    ? <Outlet />
    : <Navigate to="/" replace />;
}

function RequireVendor() {
  const { cdaId, vendedorId } = useParams();
  const role = localStorage.getItem("userRole");
  const validVendor = mockCDAs.some((cda) => cda.id === Number(cdaId)
    && cda.vendedores.some((vendor) => vendor.id === Number(vendedorId)));
  const isVendor = role === "vendedor"
    && localStorage.getItem("userCdaId") === cdaId
    && localStorage.getItem("userId") === vendedorId;
  const authorized = role === "admin" || (validVendor && isVendor);

  return authorized ? <Outlet /> : <Navigate to="/" replace />;
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
  { path: "*", element: <Navigate to="/" replace /> },
]);