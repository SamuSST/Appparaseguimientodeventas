import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useParams } from "react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "vendedor";
  activo: boolean;
};

type AuthState = {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Perfil>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function cargarPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, activo")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("No se pudo cargar el perfil:", error.message);
    return null;
  }
  return data as Perfil | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [perfilReady, setPerfilReady] = useState(false);

  // 1) Sesión: se restaura sola desde el navegador y se mantiene al día.
  //    Dentro del callback solo se actualiza el estado (sin llamar a Supabase).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Perfil (rol y nombre) desde la tabla "usuarios" cuando cambia la sesión.
  useEffect(() => {
    if (!sessionReady) return;

    const userId = session?.user.id;
    if (!userId) {
      setPerfil(null);
      setPerfilReady(true);
      return;
    }

    let cancelado = false;
    setPerfilReady(false);
    cargarPerfil(userId).then((p) => {
      if (cancelado) return;
      setPerfil(p && p.activo ? p : null);
      setPerfilReady(true);
    });
    return () => {
      cancelado = true;
    };
  }, [session?.user.id, sessionReady]);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const p = await cargarPerfil(data.user.id);
    if (!p || !p.activo) {
      await supabase.auth.signOut();
      throw new Error("SIN_PERFIL");
    }
    setPerfil(p);
    return p;
  };

  const signOut: AuthState["signOut"] = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        perfil,
        loading: !sessionReady || !perfilReady,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------
// Guardas de ruta (reemplazan a RequireAdmin / RequireVendor de routes.tsx)
// ---------------------------------------------------------------------

function Cargando() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Cargando…</p>
    </main>
  );
}

export function RequireAdmin() {
  const { perfil, loading } = useAuth();
  if (loading) return <Cargando />;
  return perfil?.rol === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}

export function RequireVendor() {
  const { vendedorId } = useParams();
  const { perfil, loading } = useAuth();
  if (loading) return <Cargando />;

  // El vendedor solo entra a su propio panel; el admin puede ver el de cualquiera.
  const autorizado = !!perfil && (perfil.rol === "admin" || perfil.id === vendedorId);
  return autorizado ? <Outlet /> : <Navigate to="/" replace />;
}

// Traduce los errores de Supabase a mensajes para el usuario.
export function mensajeDeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "SIN_PERFIL") {
    return "Tu usuario existe, pero no tiene acceso a la app. Pídele al administrador que lo active.";
  }
  if (msg.includes("Invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (msg.includes("Email not confirmed")) {
    return "Tu correo aún no está confirmado. Pídele al administrador que lo confirme.";
  }
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}