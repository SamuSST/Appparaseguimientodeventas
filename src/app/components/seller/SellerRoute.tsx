import { useCallback, useEffect, useState } from "react";
import { Clock, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { Card } from "../ui/card";
import { CheckInButton } from "../CheckInButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { toDateKey } from "../../data/metrics";

type Visita = {
  id: number;
  hora: string;
  lat: number | null;
  lng: number | null;
  direccion: string | null;
  foto_url: string | null;
  notas: string | null;
  fotoFirmada?: string;
};

// soloLectura: el admin ve el recorrido pero no registra visitas a nombre del vendedor.
export function SellerRoute({ vendedorId, soloLectura = false }: { vendedorId: string; soloLectura?: boolean }) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<Visita | null>(null);
  const hoy = toDateKey(new Date());
  const [dia, setDia] = useState(hoy);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, hora, lat, lng, direccion, foto_url, notas")
        .eq("vendedor_id", vendedorId)
        .eq("fecha", dia)
        .order("hora");
      if (error) throw error;

      const rutas = (data ?? []).map((v) => v.foto_url).filter((r): r is string => !!r);
      const firmadas = new Map<string, string>();
      if (rutas.length) {
        const { data: urls, error: urlError } = await supabase.storage.from("visitas").createSignedUrls(rutas, 3600);
        if (urlError) console.error("No se pudieron cargar las fotos de las visitas:", urlError);
        urls?.forEach((u) => u.path && u.signedUrl && firmadas.set(u.path, u.signedUrl));
      }
      setVisitas((data ?? []).map((v) => ({ ...v, fotoFirmada: v.foto_url ? firmadas.get(v.foto_url) : undefined })));
    } catch (error) {
      console.error("No se pudieron cargar las visitas:", error);
      toast.error("No se pudieron cargar tus visitas de hoy.");
    } finally {
      setLoading(false);
    }
  }, [vendedorId, dia]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleCheckIn = async (
    ubicacion: { lat: number; lng: number; direccion: string },
    foto?: string,
    notas?: string,
  ) => {
    setGuardando(true);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        const blob = await (await fetch(foto)).blob();
        const ruta = `${vendedorId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("visitas")
          .upload(ruta, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        fotoUrl = ruta;
      }

      const { error } = await supabase.from("visitas").insert({
        vendedor_id: vendedorId,
        fecha: hoy,
        hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        direccion: ubicacion.direccion,
        foto_url: fotoUrl,
        notas: notas ?? null,
      });
      if (error) throw error;

      toast.success("Visita registrada.");
      await cargar();
    } catch (error) {
      console.error("No se pudo registrar la visita:", error);
      toast.error("No se pudo registrar la visita. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {!soloLectura && dia === hoy && (
        <div className={guardando ? "pointer-events-none opacity-60" : undefined}>
          <CheckInButton vendedorId={vendedorId} onCheckIn={handleCheckIn} />
        </div>
      )}

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Recorrido del</h3>
            <input
              type="date"
              value={dia}
              max={hoy}
              onChange={(e) => setDia(e.target.value || hoy)}
              aria-label="Día del recorrido"
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            {visitas.length} {visitas.length === 1 ? "visita" : "visitas"}
          </span>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Cargando visitas...</p>
        ) : visitas.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            {dia === hoy ? "Aún no hay visitas registradas hoy." : "No hay visitas registradas ese día."}
          </p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-green-200 pl-6">
            {visitas.map((v) => (
              <li key={v.id} className="relative">
                <span className="absolute -left-[33px] top-3 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
                <button
                  type="button"
                  onClick={() => setSeleccionada(v)}
                  className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Clock className="h-4 w-4 text-gray-500" />
                    {v.hora.slice(0, 5)}
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {v.direccion || "Ubicación sin dirección"}
                  </p>
                  {v.notas && (
                    <p className="mt-1 flex items-center gap-2 truncate text-xs text-gray-600">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      {v.notas}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Dialog open={!!seleccionada} onOpenChange={(open) => !open && setSeleccionada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visita de las {seleccionada?.hora.slice(0, 5)}</DialogTitle>
          </DialogHeader>
          {seleccionada && (
            <div className="space-y-3 text-sm">
              {seleccionada.fotoFirmada && (
                <img src={seleccionada.fotoFirmada} alt="Foto de la visita" className="w-full rounded-lg object-cover" />
              )}
              <p className="text-gray-700">{seleccionada.direccion || "Ubicación sin dirección"}</p>
              {seleccionada.lat !== null && seleccionada.lng !== null && (
                <a
                  href={`https://www.google.com/maps?q=${seleccionada.lat},${seleccionada.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                >
                  <MapPin className="h-4 w-4" /> Ver en Google Maps
                </a>
              )}
              {seleccionada.notas && <p className="text-gray-600">{seleccionada.notas}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
