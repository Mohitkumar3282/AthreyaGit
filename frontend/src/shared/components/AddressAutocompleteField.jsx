import React, { useState, useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "../../core/services/googleMapsLoader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const AddressAutocompleteField = ({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  textarea = false,
}) => {
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const containerRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // Initialize AutocompleteService
  const initPlaces = async () => {
    if (autocompleteServiceRef.current) return true;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return false;

    try {
      await loadGoogleMaps(apiKey);
      if (window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        geocoderRef.current = new window.google.maps.Geocoder();
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        return true;
      }
    } catch (err) {
      console.warn("Failed to initialize Google Places Autocomplete:", err);
    }
    return false;
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch predictions when input changes
  useEffect(() => {
    const query = (value || "").trim();
    if (query.length < 3 || !isOpen) {
      setPredictions([]);
      return;
    }

    const fetchPredictions = async () => {
      const ready = await initPlaces();
      if (!ready || !autocompleteServiceRef.current) return;

      setIsSearching(true);
      const request = {
        input: query,
        componentRestrictions: { country: "in" },
        sessionToken: sessionTokenRef.current,
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (results, status) => {
          setIsSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results.slice(0, 5));
          } else {
            setPredictions([]);
          }
        }
      );
    };

    const timer = setTimeout(fetchPredictions, 300);
    return () => clearTimeout(timer);
  }, [value, isOpen]);

  const handleSelectPrediction = (prediction) => {
    setIsOpen(false);
    setPredictions([]);
    onChange(prediction.description);

    if (!geocoderRef.current) return;

    geocoderRef.current.geocode(
      { placeId: prediction.place_id },
      (results, status) => {
        if (status === "OK" && results && results[0]) {
          const result = results[0];
          const geometry = result.geometry?.location;
          const components = result.address_components || [];

          const getComponent = (types) =>
            components.find((c) => types.every((t) => c.types.includes(t)))?.long_name || "";

          const city = getComponent(["locality"]);
          const state = getComponent(["administrative_area_level_1"]);
          const pincode = getComponent(["postal_code"]);

          if (onSelect && geometry) {
            onSelect({
              address: result.formatted_address || prediction.description,
              lat: geometry.lat(),
              lng: geometry.lng(),
              city: city,
              state: state,
              pincode: pincode,
              placeId: prediction.place_id,
            });
          }
        }
      }
    );

    // Refresh session token for subsequent searches
    if (window.google?.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };

  const InputComponent = textarea ? Textarea : Input;

  return (
    <div ref={containerRef} className="relative w-full">
      <InputComponent
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          initPlaces();
          setIsOpen(true);
        }}
        placeholder={placeholder}
        className={className}
      />
      {isOpen && (predictions.length > 0 || isSearching) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar">
          {isSearching && predictions.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">
              Searching locations...
            </div>
          )}
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => handleSelectPrediction(p)}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b last:border-b-0 border-slate-100 flex items-start gap-3 transition-colors"
            >
              <MapPin size={16} className="text-[#1a6e2e] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">
                  {p.structured_formatting?.main_text || p.description}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {p.structured_formatting?.secondary_text || p.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
