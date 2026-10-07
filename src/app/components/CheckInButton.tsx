import { MapPin, Camera, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface CheckInButtonProps {
  vendedorId: number;
  onCheckIn: (ubicacion: { lat: number; lng: number; direccion: string }, foto?: string, notas?: string) => void;
}

export function CheckInButton({ vendedorId, onCheckIn }: CheckInButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    if (!Number.isFinite(vendedorId) || vendedorId <= 0) {
      toast.error("No se pudo identificar al vendedor. Vuelve a iniciar sesión.");
      return;
    }
    setIsCapturing(true);

    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      setIsCapturing(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Simulamos la geocodificación inversa (en producción usar una API real)
        const direccion = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;

        onCheckIn(
          { lat: latitude, lng: longitude, direccion },
          capturedPhoto || undefined,
          notas || undefined
        );

        // Reset
        setCapturedPhoto(null);
        setNotas("");
        setIsCapturing(false);
      },
      (error) => {
        let errorMessage = "No se pudo obtener la ubicación";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Debes permitir el acceso a tu ubicación en la configuración del navegador";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "No se puede determinar tu ubicación en este momento";
            break;
          case error.TIMEOUT:
            errorMessage = "Se agotó el tiempo de espera para obtener la ubicación";
            break;
        }

        toast.error(errorMessage);
        setIsCapturing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
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
