import React, { useCallback, useMemo, useState } from "react";
import {
  DirectionsRenderer,
  DirectionsService,
  GoogleMap,
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from "@/core/services/googleMapsLoader";
import Translated from "@shared/components/Translated";

const mapContainerStyle = { width: "100%", height: "220px" };

const ExpressRouteMap = ({ origin, destination }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [directions, setDirections] = useState(null);
  const midpoint = useMemo(() => ({
    lat: (Number(origin.lat) + Number(destination.lat)) / 2,
    lng: (Number(origin.lng) + Number(destination.lng)) / 2,
  }), [origin.lat, origin.lng, destination.lat, destination.lng]);
  const directionsOptions = useMemo(() => ({
    origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
    destination: { lat: Number(destination.lat), lng: Number(destination.lng) },
    travelMode: "DRIVING",
  }), [origin.lat, origin.lng, destination.lat, destination.lng]);
  const handleDirections = useCallback((result, status) => {
    if (status === "OK" && result) setDirections(result);
  }, []);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}&destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&travelmode=driving`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {isLoaded && !loadError ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={midpoint}
          zoom={12}
          options={{
            clickableIcons: false,
            fullscreenControl: false,
            mapTypeControl: false,
            streetViewControl: false,
          }}
        >
          {!directions && (
            <DirectionsService options={directionsOptions} callback={handleDirections} />
          )}
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      ) : (
        <div className="flex h-[220px] items-center justify-center px-4 text-center text-sm font-semibold text-slate-500">
          <Translated text={loadError || !apiKey ? "Map preview is unavailable. Open the route in Google Maps." : "Loading map…"} />
        </div>
      )}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="block border-t border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-emerald-800 hover:bg-emerald-50"
      >
        <Translated text="Open route in Google Maps" />
      </a>
    </div>
  );
};

export default ExpressRouteMap;
