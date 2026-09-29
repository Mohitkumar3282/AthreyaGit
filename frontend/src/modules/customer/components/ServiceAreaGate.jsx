import React, { useMemo, useState } from 'react';
import { useSettings } from '@core/context/SettingsContext';
import { useLocation as useCustomerLocation } from '../context/LocationContext';
import { haversineMeters } from '@shared/utils/eta';
import { MapPin, Rocket, RefreshCw, Search } from 'lucide-react';
import LocationDrawer from './shared/LocationDrawer';

/**
 * ServiceAreaGate
 *
 * Wraps customer pages and blocks access for users outside admin-enabled
 * service areas/pincodes.
 *
 * Rules:
 *  - If serviceAreas array is empty OR no area is enabled → OPEN (allow all).
 *  - If at least one area is enabled AND customer location is known → check.
 *  - If customer location is unknown → ALLOW through (don't block on loading).
 *  - Match, in order:
 *      1. Radius: customer's live coordinates within `radiusKm` of the area's
 *         geocoded center (lat/long) — this is what the admin's "Max Range"
 *         setting actually controls.
 *      2. Exact pincode match.
 *      3. Area name substring match against customer city/suburb (fallback
 *         for areas saved without a geocoded center).
 */
const ServiceAreaGate = ({ children }) => {
    const { settings, loading: settingsLoading } = useSettings();
    const { currentLocation, isFetchingLocation, refreshLocation } = useCustomerLocation();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const { isServiced } = useMemo(() => {
        const areas = settings?.serviceAreas || [];
        const activeAreas = areas.filter(a => a.enabled !== false);

        // No areas configured or all disabled → open platform
        if (!activeAreas.length) {
            return { isServiced: true, hasActiveAreas: false };
        }

        // Location not yet resolved → allow through (avoid false blocks)
        const pincode = currentLocation?.pincode?.trim() || '';
        const city = (
            currentLocation?.city ||
            currentLocation?.area ||
            currentLocation?.suburb ||
            ''
        ).trim().toLowerCase();
        const customerLat = Number(currentLocation?.latitude);
        const customerLng = Number(currentLocation?.longitude);
        const hasCustomerCoords = Number.isFinite(customerLat) && Number.isFinite(customerLng);

        if (!pincode && !city && !hasCustomerCoords) {
            return { isServiced: true, hasActiveAreas: true };
        }

        const matched = activeAreas.some(area => {
            // Radius match — what the admin's "Max Range" setting controls.
            const areaLat = Number(area.latitude);
            const areaLng = Number(area.longitude);
            const radiusKm = Number(area.radiusKm) || 0;
            if (hasCustomerCoords && radiusKm > 0 && Number.isFinite(areaLat) && Number.isFinite(areaLng)) {
                const distanceMeters = haversineMeters(
                    { lat: customerLat, lng: customerLng },
                    { lat: areaLat, lng: areaLng },
                );
                if (distanceMeters != null && distanceMeters <= radiusKm * 1000) return true;
            }
            // Pincode match
            if (pincode && area.pincode && area.pincode.trim() === pincode) return true;
            // Name match (case-insensitive substring both ways)
            if (city && area.name) {
                const areaLower = area.name.toLowerCase();
                if (city.includes(areaLower) || areaLower.includes(city)) return true;
            }
            return false;
        });

        return { isServiced: matched, hasActiveAreas: true };
    }, [settings?.serviceAreas, currentLocation]);

    // While settings are loading, don't block
    if (settingsLoading) return children;

    // Serviced area → render normally
    if (isServiced) return children;

    // Outside coverage → show "Coming Soon" screen
    const detectedLocation = [
        currentLocation?.area || currentLocation?.suburb,
        currentLocation?.city,
        currentLocation?.pincode ? `- ${currentLocation.pincode}` : '',
    ].filter(Boolean).join(', ');

    return (
        <div className="min-h-screen bg-[#042A0F] flex items-center justify-center p-6">
            <div className="max-w-sm w-full text-center space-y-8">

                {/* Animated Map Pin */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center animate-bounce">
                                <MapPin className="h-10 w-10 text-[#A3E635]" />
                            </div>
                        </div>
                        {/* Ripple rings */}
                        <span className="absolute inset-0 rounded-full border-2 border-[#A3E635]/40 animate-ping" />
                    </div>
                </div>

                {/* Main Message */}
                <div className="space-y-3">
                    <p className="text-[#A3E635] text-[10px] font-black uppercase tracking-widest">
                        Service Unavailable
                    </p>
                    <h1 className="text-white text-xl font-black leading-tight">
                        📍 Athreya Delivery is not available at this location yet.
                    </h1>
                    <p className="text-white/80 text-base font-bold">
                        🚀 Coming Soon to your area!
                    </p>
                    {/* Telugu sub-text */}
                    <p className="text-white/50 text-xs font-medium">
                        మీ ప్రాంతంలో త్వరలో అందుబాటులోకి వస్తాం!
                    </p>
                </div>

                {/* Detected Location */}
                {detectedLocation && (
                    <div className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-left space-y-1">
                        <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                            Your detected location
                        </p>
                        <p className="text-white text-sm font-bold">{detectedLocation}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={() => refreshLocation?.()}
                        disabled={isFetchingLocation}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#A3E635] text-[#042A0F] rounded-2xl text-sm font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetchingLocation ? 'animate-spin' : ''}`} />
                        {isFetchingLocation ? 'Detecting...' : 'Refresh My Location'}
                    </button>
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 border border-white/20 text-white rounded-2xl text-sm font-black uppercase tracking-wider active:scale-95 transition-all hover:bg-white/15"
                    >
                        <Search className="h-4 w-4" />
                        Enter Pincode / Address
                    </button>
                    <p className="text-white/40 text-xs font-semibold">
                        We are expanding fast — check back soon!
                    </p>
                </div>

                <LocationDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

                {/* Rocket decoration */}
                <div className="flex justify-center opacity-20 mt-4">
                    <Rocket className="h-8 w-8 text-white" />
                </div>
            </div>
        </div>
    );
};

export default ServiceAreaGate;
