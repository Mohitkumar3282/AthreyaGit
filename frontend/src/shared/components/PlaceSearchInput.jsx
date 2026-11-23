import React, { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import Input from "./ui/Input";
import {
  createPlacesSessionToken,
  fetchPlaceLocation,
  fetchPlaceSuggestions,
} from "@/core/services/placesAutocomplete";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;

/**
 * Map search box backed by Places API (New). Replaces the legacy
 * @react-google-maps <Autocomplete> widget, which calls the legacy Places API
 * (not enabled for new projects -> "This page can't load Google Maps correctly").
 *
 * Calls onPlaceSelected({ lat, lng, name, address }) when a suggestion is picked.
 * `biasCenter` ({lat,lng}) ranks nearby places first.
 */
const PlaceSearchInput = ({ placeholder, inputClassName = "", biasCenter, onPlaceSelected }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const latestRequestRef = useRef(0);
  // Text shown after picking a result; don't search it again.
  const selectedTextRef = useRef(null);

  // Close the dropdown when tapping outside.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const biasLat = biasCenter?.lat;
  const biasLng = biasCenter?.lng;

  useEffect(() => {
    const input = query.trim();
    if (input.length < MIN_QUERY_LENGTH || input === selectedTextRef.current) {
      latestRequestRef.current += 1;
      setSuggestions([]);
      setIsSearching(false);
      setError("");
      return undefined;
    }

    const timer = setTimeout(async () => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;
      setIsSearching(true);
      setError("");
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = await createPlacesSessionToken();
        }
        const results = await fetchPlaceSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
          locationBias:
            Number.isFinite(biasLat) && Number.isFinite(biasLng)
              ? { center: { lat: biasLat, lng: biasLng }, radius: 15000 }
              : undefined,
          limit: 5,
        });
        if (requestId !== latestRequestRef.current) return; // stale keystroke
        setSuggestions(results);
      } catch (err) {
        if (requestId !== latestRequestRef.current) return;
        console.warn("Place suggestions failed:", err);
        setSuggestions([]);
        setError("Search is unavailable right now. Tap the map to pick a spot.");
      } finally {
        if (requestId === latestRequestRef.current) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, biasLat, biasLng]);

  const handleSelect = async (suggestion) => {
    setIsOpen(false);
    setSuggestions([]);
    const label = suggestion.structured_formatting?.main_text || suggestion.description;
    selectedTextRef.current = label.trim();
    setQuery(label);
    try {
      const place = await fetchPlaceLocation(suggestion);
      onPlaceSelected?.({
        ...place,
        address: place.address || suggestion.description,
      });
    } catch (err) {
      console.warn("Place details failed:", err);
      setError("Couldn't open that place. Try another result or tap the map.");
    } finally {
      // A selection ends the billing session; the next search starts a new one.
      sessionTokenRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
      <Input
        value={query}
        onChange={(e) => {
          selectedTextRef.current = null; // user is typing a new search
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`pl-10 ${inputClassName}`}
        autoComplete="off"
      />
      {isSearching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
      )}
      {isOpen && (suggestions.length > 0 || error) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {error && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">{error}</p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 border-gray-100 flex items-start gap-3">
                <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 truncate">
                    {s.structured_formatting?.main_text || s.description}
                  </p>
                  {s.structured_formatting?.secondary_text && (
                    <p className="text-xs text-gray-500 truncate">
                      {s.structured_formatting.secondary_text}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PlaceSearchInput;
