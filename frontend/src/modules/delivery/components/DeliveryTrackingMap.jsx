import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Loader2, MapPin, Navigation } from "lucide-react";
import customerPin from "@/assets/customer-pin.png";
import { deliveryApi } from "../services/deliveryApi";
import deliveryIcon from "@/assets/deliveryIcon.png";
import storePin from "@/assets/store-pin.png";
import {
  getCachedDeliveryPartnerLocation,
  saveDeliveryPartnerLocation,
} from "../utils/deliveryLastLocation";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from "@/core/services/googleMapsLoader";

const ROUTE_REFRESH_THRESHOLD_M = 150;
const ROUTE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const ROUTE_REQUOTE_DRIFT_M = 400;
const ROUTE_REQUOTE_MIN_GAP_MS = 30 * 1000;
const RECENTER_INTERVAL_MS = 15000;
const RIDER_FOCUS_RADIUS_M = 500;
const LOCATION_POST_INTERVAL_MS = 5000;
// Rider counts as "on the route" within this distance of the drawn line.
const ON_ROUTE_TOLERANCE_M = 120;
// After the rider pans the map, stop auto-following for this long.
const USER_PAN_PAUSE_MS = 30 * 1000;

// Container style will be 100% to fill parent
const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "200px",
};

/** GeoJSON [lng, lat] → { lat, lng } */
function coordsToLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function distanceMeters(from, to) {
  if (!from || !to) return null;
  if (
    typeof from.lat !== "number" ||
    typeof from.lng !== "number" ||
    typeof to.lat !== "number" ||
    typeof to.lng !== "number" ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return null;
  }

  const r = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function destinationForPhase(order, phase) {
  const isReturn = order?.returnStatus && order.returnStatus !== "none";
  if (phase === "pickup") {
    if (isReturn) {
      const loc = order?.address?.location;
      if (
        loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        return { lat: loc.lat, lng: loc.lng };
      }
      return null;
    }
    // Athreya Express: go to the sender's address, not the anchor shop.
    if (order?.orderType === "custom_pickup") {
      const p = order?.pickupAddress?.location;
      return typeof p?.lat === "number" &&
        typeof p?.lng === "number" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng)
        ? { lat: p.lat, lng: p.lng }
        : null;
    }
    return coordsToLatLng(order?.seller?.location?.coordinates);
  }
  if (isReturn) {
    return coordsToLatLng(order?.seller?.location?.coordinates);
  }
  const loc = order?.address?.location;
  if (
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

/** Where the rider is heading in this phase, for the on-map address card. */
function destinationInfoForPhase(order, phase) {
  const isReturn = order?.returnStatus && order.returnStatus !== "none";
  const seller = order?.seller || {};
  const sellerAddress = [seller.shopName, seller.address].filter(Boolean).join(", ");
  const customer = order?.address || {};
  const customerAddress = [customer.address, customer.landmark].filter(Boolean).join(", ");

  if (phase === "pickup") {
    if (isReturn) return { title: "Pick up from customer", name: customer.name, address: customerAddress };
    if (order?.orderType === "custom_pickup") {
      const p = order?.pickupAddress || {};
      return {
        title: "Pick up from sender",
        name: p.name,
        address: [p.address, p.landmark].filter(Boolean).join(", "),
      };
    }
    return { title: "Pick up from store", name: seller.shopName, address: seller.address || sellerAddress };
  }
  if (isReturn) return { title: "Return to store", name: seller.shopName, address: seller.address || sellerAddress };
  return { title: "Deliver to customer", name: customer.name, address: customerAddress };
}

/** Index of the path vertex nearest to `point`, and its distance in meters. */
function nearestPathIndex(path, point) {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const d = distanceMeters({ lat: path[i].lat(), lng: path[i].lng() }, point);
    if (d != null && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return { index: best, distance: bestDist };
}

/**
 * Live tracking map: rider + one road route from GET /orders/workflow/:orderId/route.
 * Uses a single native google.maps.Polyline (ref) so the React wrapper cannot leave
 * duplicate overlays. No geodesic rider→dest line — that caused a second “straight” path.
 */
const DeliveryTrackingMapComponent = ({
  orderId,
  phase,
  order,
  onRouteStatsChange,
}) => {
  const mapRef = useRef(null);
  const routePolylineRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [rider, setRider] = useState(() => {
    const c = getCachedDeliveryPartnerLocation();
    return c ? { lat: c.lat, lng: c.lng } : null;
  });
  // Initialize riderRef from cache so fetchRoute works immediately on mount
  const riderRef = useRef((() => {
    const c = getCachedDeliveryPartnerLocation();
    return c ? { lat: c.lat, lng: c.lng } : null;
  })());
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const lastFetchRef = useRef({ at: 0, phase: null, orderId: null });
  const routeOriginRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastLocationPostRef = useRef(0);
  const locationInFlightRef = useRef(false);
  const locationAbortRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const heading = pos.coords.heading;
        const speed = pos.coords.speed;
        
        saveDeliveryPartnerLocation(lat, lng);
        setRider({ lat, lng });
        riderRef.current = { lat, lng };
        
        // Throttle location POSTs to once every 5s and skip if one is already in-flight
        const now = Date.now();
        if (now - lastLocationPostRef.current < LOCATION_POST_INTERVAL_MS) return;
        if (locationInFlightRef.current) return;
        lastLocationPostRef.current = now;
        locationInFlightRef.current = true;

        // Abort any previous stale request
        if (locationAbortRef.current) locationAbortRef.current.abort();
        const controller = new AbortController();
        locationAbortRef.current = controller;

        deliveryApi.postLocation(
          { lat, lng, accuracy, heading, speed, orderId: orderId || null },
          { signal: controller.signal, timeout: 8000 },
        ).catch(() => {}).finally(() => {
          locationInFlightRef.current = false;
          if (locationAbortRef.current === controller) locationAbortRef.current = null;
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationAbortRef.current) {
        locationAbortRef.current.abort();
        locationAbortRef.current = null;
      }
      locationInFlightRef.current = false;
    };
  }, [orderId]);

  const routeAbortRef = useRef(null);
  const routeInFlightRef = useRef(false);

  // `force` skips the "route is still fresh" check (used when the rider leaves the route).
  const fetchRoute = useCallback(async (force = false) => {
    const currentRider = riderRef.current;
    if (!orderId || !currentRider) return;
    if (routeInFlightRef.current) return;
    const now = Date.now();
    const sameRouteContext =
      lastFetchRef.current.phase === phase &&
      lastFetchRef.current.orderId === orderId;
    const originDrift =
      routeOriginRef.current && currentRider
        ? distanceMeters(routeOriginRef.current, currentRider)
        : null;

    if (
      force !== true &&
      sameRouteContext &&
      lastFetchRef.current.at &&
      now - lastFetchRef.current.at < ROUTE_REFRESH_INTERVAL_MS &&
      (originDrift === null || originDrift < ROUTE_REFRESH_THRESHOLD_M)
    ) {
      return;
    }

    lastFetchRef.current = { at: now, phase, orderId };
    routeInFlightRef.current = true;

    if (routeAbortRef.current) routeAbortRef.current.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;

    setRouteLoading(true);
    try {
      const res = await deliveryApi.getOrderRoute(orderId, {
        phase,
        originLat: currentRider.lat,
        originLng: currentRider.lng,
        _t: now,
      }, { signal: controller.signal });
      if (res.data?.success) {
        const nextRoute = res.data.result || res.data.data || null;
        setRouteData(nextRoute);
        routeOriginRef.current = { lat: currentRider.lat, lng: currentRider.lng };
      }
    } catch {
      setRouteData((prev) => prev || { degraded: true });
    } finally {
      routeInFlightRef.current = false;
      if (routeAbortRef.current === controller) routeAbortRef.current = null;
      setRouteLoading(false);
    }
  // Stable — uses riderRef so GPS ticks don't recreate this callback
  }, [orderId, phase]);

  useEffect(() => {
    setRouteData((prev) => (prev?.phase === phase ? prev : null));
    lastFetchRef.current = { at: 0, phase: null, orderId: null };
    routeOriginRef.current = null;
  }, [orderId, phase]);

  useEffect(() => {
    if (!rider) return undefined;
    fetchRoute();
    const iv = setInterval(fetchRoute, ROUTE_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(iv);
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
        routeAbortRef.current = null;
      }
      routeInFlightRef.current = false;
    };
  // rider in deps only to trigger initial fetch when location first becomes available
  // fetchRoute is stable (doesn't depend on rider state)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!rider, fetchRoute, phase, orderId]);

  // The ETA itself is kept live from GPS (see shared/utils/eta.js), so we only
  // pay for a fresh Directions quote when the rider has strayed far enough that
  // the drawn route + road ratio no longer describe where they are.
  useEffect(() => {
    if (!rider || !routeOriginRef.current) return;
    const drift = distanceMeters(routeOriginRef.current, rider);
    if (
      drift != null &&
      drift >= ROUTE_REQUOTE_DRIFT_M &&
      Date.now() - lastFetchRef.current.at > ROUTE_REQUOTE_MIN_GAP_MS
    ) {
      fetchRoute();
    }
  }, [rider, fetchRoute]);

  const isReturn = order?.returnStatus && order.returnStatus !== "none";
  // Use order address location, fall back to the destination resolved by the route API
  const dest = useMemo(() => {
    const fromOrder = destinationForPhase(order, phase);
    if (fromOrder) return fromOrder;
    // routeData may contain the resolved destination (set by backend geocode fallback)
    const rd = routeData?.destination;
    if (rd && typeof rd.lat === "number" && typeof rd.lng === "number") {
      return { lat: rd.lat, lng: rd.lng };
    }
    return null;
  }, [order, phase, routeData]);

  useEffect(() => {
    if (typeof onRouteStatsChange !== "function") return undefined;
    onRouteStatsChange({
      phase,
      rider,
      destination: dest,
      routeOrigin: routeData?.origin || routeOriginRef.current || null,
      routeDurationSeconds: Number(routeData?.duration) || null,
      routeDistanceMeters:
        Number(routeData?.distanceMeters ?? routeData?.distance) || null,
    });
    return undefined;
  }, [onRouteStatsChange, phase, rider, dest, routeData]);

  const decodedPath = useMemo(() => {
    const encoded = routeData?.polyline;
    if (!encoded || !isLoaded || !mapInstance) return null;
    try {
      const decode = window.google?.maps?.geometry?.encoding?.decodePath;
      if (!decode) return null;
      return decode(encoded);
    } catch {
      return null;
    }
  }, [routeData?.polyline, isLoaded, mapInstance]);

  /**
   * The part of the road route still ahead of the rider (Zomato-style: the line
   * shrinks as they ride). If the rider is off the route, the full route is
   * shown and a fresh one is requested (see effect below).
   */
  const { linePath, offRouteMeters } = useMemo(() => {
    if (!decodedPath?.length) return { linePath: [], offRouteMeters: null };
    if (!rider || !window.google?.maps) return { linePath: decodedPath, offRouteMeters: null };
    const { index, distance } = nearestPathIndex(decodedPath, rider);
    if (index < 0 || distance > ON_ROUTE_TOLERANCE_M) {
      return { linePath: decodedPath, offRouteMeters: distance };
    }
    const ahead = decodedPath.slice(index + 1);
    return {
      linePath: [new window.google.maps.LatLng(rider.lat, rider.lng), ...ahead],
      offRouteMeters: distance,
    };
  }, [decodedPath, rider]);

  // Re-route when the rider has clearly left the drawn route.
  useEffect(() => {
    if (offRouteMeters == null || offRouteMeters <= ON_ROUTE_TOLERANCE_M) return;
    if (Date.now() - lastFetchRef.current.at < ROUTE_REQUOTE_MIN_GAP_MS) return;
    fetchRoute(true);
  }, [offRouteMeters, fetchRoute]);

  const destinationInfo = useMemo(() => destinationInfoForPhase(order, phase), [order, phase]);
  const navigateUrl = dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=two-wheeler`
    : null;

  const riderMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: deliveryIcon,
      scaledSize: new window.google.maps.Size(44, 64),
      anchor: new window.google.maps.Point(22, 64),
    };
  }, [isLoaded]);

  const customerMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: customerPin,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 40),
    };
  }, [isLoaded]);

  const storeMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: storePin,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 40),
    };
  }, [isLoaded]);

  const mapCenter = useMemo(() => {
    if (rider) return rider;
    if (dest) return dest;
    return { lat: 20.5937, lng: 78.9629 };
  }, [rider, dest]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const focusOnRider500m = useCallback((map, riderLocation) => {
    if (!map || !window.google?.maps?.geometry?.spherical || !riderLocation) return;

    const center = new window.google.maps.LatLng(riderLocation.lat, riderLocation.lng);
    const bounds = new window.google.maps.LatLngBounds();
    [0, 90, 180, 270].forEach((heading) => {
      const edge = window.google.maps.geometry.spherical.computeOffset(
        center,
        RIDER_FOCUS_RADIUS_M,
        heading,
      );
      bounds.extend(edge);
    });
    map.fitBounds(bounds, 24);
  }, []);

  // Route line: a dark outline under a bright blue line (easier to see on a
  // phone in sunlight). Both overlays are created once and only their path is
  // updated as the rider moves, so there is never a second/stale line.
  const routeOutlineRef = useRef(null);
  useEffect(() => {
    if (!isLoaded || !mapInstance || !window.google?.maps) return undefined;
    routeOutlineRef.current = new window.google.maps.Polyline({
      strokeColor: "#1e3a8a",
      strokeOpacity: 0.9,
      strokeWeight: 9,
      map: mapInstance,
      zIndex: 9,
    });
    routePolylineRef.current = new window.google.maps.Polyline({
      strokeColor: "#2563eb",
      strokeOpacity: 1,
      strokeWeight: 5,
      map: mapInstance,
      zIndex: 10,
    });
    return () => {
      routeOutlineRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
      routeOutlineRef.current = null;
      routePolylineRef.current = null;
    };
  }, [isLoaded, mapInstance]);

  useEffect(() => {
    const path = linePath?.length ? linePath : [];
    routeOutlineRef.current?.setPath(path);
    routePolylineRef.current?.setPath(path);
  }, [linePath]);

  // Camera: keep the rider, the remaining route and the destination in view.
  // Pauses briefly after the rider drags the map so they can look around.
  const userPannedAtRef = useRef(0);
  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return undefined;
    const listener = mapInstance.addListener("dragstart", () => {
      userPannedAtRef.current = Date.now();
    });
    return () => listener.remove();
  }, [mapInstance]);

  const fitRouteInView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    if (Date.now() - userPannedAtRef.current < USER_PAN_PAUSE_MS) return;
    const points = [...(linePath || [])];
    if (rider) points.push(new window.google.maps.LatLng(rider.lat, rider.lng));
    if (dest) points.push(new window.google.maps.LatLng(dest.lat, dest.lng));
    if (points.length < 2) {
      if (rider) focusOnRider500m(map, rider);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    // Extra top padding leaves room for the address card.
    map.fitBounds(bounds, { top: 96, right: 40, bottom: 40, left: 40 });
  }, [linePath, rider, dest, focusOnRider500m]);

  const fitRouteInViewRef = useRef(fitRouteInView);
  fitRouteInViewRef.current = fitRouteInView;

  // Fit once when the route (or destination) first appears / changes.
  useEffect(() => {
    fitRouteInViewRef.current();
  }, [decodedPath, dest?.lat, dest?.lng, mapInstance]);

  // Then keep following the rider periodically.
  useEffect(() => {
    if (!isLoaded) return undefined;
    const id = setInterval(() => fitRouteInViewRef.current(), RECENTER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLoaded]);

  // Add resize observer to handle dynamic height changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return undefined;

    const handleResize = () => {
      window.google.maps.event.trigger(map, 'resize');
      // Re-fit rider + remaining route + destination after a size change.
      try {
        fitRouteInViewRef.current();
      } catch {
        /* ignore */
      }
    };

    // Listen for window resize events
    window.addEventListener('resize', handleResize);
    
    // Create a resize observer for the map container
    const mapContainer = map.getDiv()?.parentElement;
    let resizeObserver;
    
    if (mapContainer && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(mapContainer);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  // Only re-attach when the map changes; GPS ticks must not re-trigger a fit.
  }, [mapInstance]);

  if (!apiKey) {
    return (
      <div className="relative w-full h-48 bg-slate-100 rounded-2xl flex items-center justify-center text-center px-4">
        <p className="text-[14px] text-slate-700">
          Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to show live
          tracking.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative w-full h-48 bg-rose-50 rounded-2xl flex items-center justify-center text-[14px] text-rose-700 px-4">
        Map failed to load. Check the API key and billing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative w-full h-48 bg-slate-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {rider && (
          <Marker
            position={rider}
            title="Your location"
            icon={riderMarkerIcon}
          />
        )}
        {dest && (
          <Marker
            position={dest}
            title={
              phase === "pickup"
                ? isReturn
                  ? "Pickup (customer)"
                  : order?.orderType === "custom_pickup"
                    ? "Pickup (sender)"
                    : "Pickup (store)"
                : isReturn
                  ? "Drop (seller)"
                  : "Drop (customer)"
            }
            icon={
              phase === "pickup"
                ? isReturn || order?.orderType === "custom_pickup"
                  ? customerMarkerIcon
                  : storeMarkerIcon
                : isReturn
                  ? storeMarkerIcon
                  : customerMarkerIcon
            }
          />
        )}
      </GoogleMap>
      {/* Where the rider is heading (Zomato-style address card) */}
      {destinationInfo?.address && (
        <div className="absolute top-2 left-2 right-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-md backdrop-blur">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              {destinationInfo.title}
              {routeData?.distanceMeters && !routeData?.degraded
                ? ` · ${(Number(routeData.distanceMeters) / 1000).toFixed(1)} km`
                : ""}
            </p>
            {destinationInfo.name && (
              <p className="truncate text-sm font-bold text-slate-900">{destinationInfo.name}</p>
            )}
            <p className="line-clamp-2 text-xs leading-snug text-slate-600">{destinationInfo.address}</p>
          </div>
          {navigateUrl && (
            <a
              href={navigateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-bold text-white"
            >
              <Navigation className="h-3.5 w-3.5" /> Navigate
            </a>
          )}
        </div>
      )}
      <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-2 py-1 rounded-md text-[13.5px] text-slate-600 font-bold border border-slate-200 shadow-sm">
        {routeLoading ? "Updating route…" : "Tracking View"}
      </div>
      {routeData?.degraded && (
        <div className="absolute top-24 left-2 bg-amber-50/95 text-amber-900 text-[13.5px] px-2 py-1 rounded border border-amber-200 max-w-[85%] leading-snug">
          Route unavailable right now. Check that <strong>Routes API</strong> is
          enabled for the backend <span className="font-mono">GOOGLE_MAPS_API_KEY</span>{" "}
          (billing on). The server log shows Google&apos;s exact error.
        </div>
      )}
    </div>
  );
}


// Memoized export to prevent unnecessary re-renders and reduce Google Maps API costs
const DeliveryTrackingMap = memo(DeliveryTrackingMapComponent, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  const destPrev = destinationForPhase(prevProps.order, prevProps.phase);
  const destNext = destinationForPhase(nextProps.order, nextProps.phase);
  
  return (
    prevProps.orderId === nextProps.orderId &&
    prevProps.phase === nextProps.phase &&
    destPrev?.lat === destNext?.lat &&
    destPrev?.lng === destNext?.lng
  );
});

DeliveryTrackingMap.displayName = 'DeliveryTrackingMap';

export default DeliveryTrackingMap;
