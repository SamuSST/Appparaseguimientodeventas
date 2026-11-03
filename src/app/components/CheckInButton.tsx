import { MapPin, Camera, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface CheckInButtonProps {
  // Número en los datos de ejemplo; UUID de Supabase en el panel real.
  vendedorId: number | string;
  onCheckIn: (ubicacion: { lat: number; lng: number; direccion: string }, foto?: string, notas?: string) => void;
}

// Dirección legible (calle y barrio) con OpenStreetMap Nominatim, que es gratuito para poco volumen.
// Si no responde en unos segundos, se guardan las coordenadas.
async function obtenerDireccion(lat: number, lng: number) {
  const coordenadas = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=es`,
      { signal: controller.signal },
    );
    if (!response.ok) return coordenadas;
    const data = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    const calle = [a.road, a.house_number].filter(Boolean).join(" ");
    // En Bogotá OSM a veces trae "UPZs de Bogotá" como barrio; ahí es más útil la localidad.
    const barrio = a.neighbourhood && !/^UPZ/i.test(a.neighbourhood) ? a.neighbourhood : undefined;
    const zona = barrio || a.suburb || a.city_district;
    const ciudad = (a.city || a.town || a.village)?.replace(/ ciudad$/i, "");
    const partes = [calle, zona, ciudad].filter(Boolean);
    return partes.length ? partes.join(", ") : data.display_name || coordenadas;
  } catch (error) {
    console.error("No se pudo obtener la dirección de la visita:", error);
    return coordenadas;
  } finally {
    clearTimeout(timer);
  }
}

export function CheckInButton({ vendedorId, onCheckIn }: CheckInButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    const vendedorValido = typeof vendedorId === "number"
      ? Number.isFinite(vendedorId) && vendedorId > 0
      : vendedorId.length > 0;
    if (!vendedorValido) {
      toast.error("No se pudo identificar al vendedor. Vuelve a iniciar sesión.");
      return;
    }
    setIsCapturing(true);

    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      setIsCapturing(false);
      return;
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const direccion = await obtenerDireccion(latitude, longitude);

      onCheckIn(
        { lat: latitude, lng: longitude, direccion },
        capturedPhoto || undefined,
        notas || undefined
      );

      // Reset
      setCapturedPhoto(null);
      setNotas("");
      setIsCapturing(false);
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = "No se pudo obtener la ubicación";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Debes permitir el acceso a tu ubicación en la configuración del navegador";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "No se puede determinar tu ubicación en este momento";
          break;
        case error.TIMEOUT:
          errorMessage = "Se agotó el tiempo de espera para obtener la ubicación. Activa el GPS o la ubicación del equipo e inténtalo de nuevo.";
          break;
      }

      toast.error(errorMessage);
      setIsCapturing(false);
    };

    // Primero se intenta con GPS (alta precisión). Si no responde a tiempo, como pasa en
    // computadores o en interiores, se reintenta con la ubicación por red/Wi-Fi.
    navigator.geolocation.getCurrentPosition(
      (position) => void handleSuccess(position),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          handleError(error);
          return;
        }
        navigator.geolocation.getCurrentPosition((position) => void handleSuccess(position), handleError, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 5 * 60 * 1000,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen válido.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La foto debe pesar menos de 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast.error("No se pudo leer la foto seleccionada.");
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        toast.error("No se pudo procesar la foto seleccionada.");
        return;
      }

      const image = new Image();
      image.onerror = () => toast.error("El archivo seleccionado no es una imagen válida.");
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          toast.error("El navegador no pudo procesar la foto.");
          return;
        }
        try {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.75));
          toast.success("Foto adjunta a la visita.");
        } catch (error) {
          console.error("No se pudo comprimir la foto:", error);
          toast.error("No se pudo procesar la foto. Intenta con otra imagen.");
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className="p-5 bg-white border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">Nueva Visita</h3>
            <p className="text-sm text-gray-600">Registra ubicación GPS y evidencia fotográfica</p>
          </div>
        </div>

        {/* Botón para tomar foto */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex-1 gap-2"
            disabled={isCapturing}
          >
            <Camera className="w-4 h-4" />
            {capturedPhoto ? "Cambiar foto" : "Tomar foto"}
          </Button>
        </div>

        {/* Preview de la foto */}
        {capturedPhoto && (
          <div className="relative rounded-lg overflow-hidden">
            <img src={capturedPhoto} alt="Foto capturada" className="w-full h-40 object-cover" />
            <button
              onClick={() => setCapturedPhoto(null)}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Notas opcionales */}
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas de la visita (opcional)"
          className="w-full p-3 border rounded-lg resize-none"
          rows={2}
        />

        {/* Botón de check-in */}
        <Button
          onClick={handleGetLocation}
          disabled={isCapturing}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2 h-12 text-base font-semibold shadow-md"
        >
          <Upload className="w-5 h-5" />
          {isCapturing ? "Obteniendo ubicación..." : "Registrar Visita Ahora"}
        </Button>
      </div>
    </Card>
  );
}
