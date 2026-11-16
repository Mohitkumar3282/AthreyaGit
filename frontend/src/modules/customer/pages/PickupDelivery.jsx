import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  MapPin, 
  Navigation,
  Map,
  IndianRupee,
  Home,
  Store,
  Truck,
  Clock,
  Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import { useLocation } from "../context/LocationContext";
import { useSettings } from "@core/context/SettingsContext";
import { useAuth } from "@core/context/AuthContext";
import Card from "@/shared/components/ui/Card";
import MapPicker from "@/shared/components/MapPicker";
import Translated from "@shared/components/Translated";
import "./PickupDelivery.css";

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 1.5; // fallback default distance in km
  }
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

const CARGO_POINTS = [
  { id: "apsrtc_asw", name: "APSRTC Bus Stand Parcel Counter", loc: "Aswapuram Main Bus Stand" },
  { id: "tsrtc_asw", name: "TSRTC Cargo / Parcel Center", loc: "Aswapuram Bus Station" },
  { id: "navata", name: "Navata Road Transport", loc: "Manuguru Road / Aswapuram" },
  { id: "bmps", name: "BMPS Parcel Service", loc: "Market Area, Aswapuram" },
  { id: "kranti", name: "Kranti Transport Office", loc: "Main Road, Aswapuram" },
  { id: "travels_cargo", name: "Private Travels Cargo (Orange/Morning Star)", loc: "Bypass Junction, Aswapuram" },
  { id: "other_cargo", name: "Other Cargo / Bus Transport Point", loc: "Custom Location" },
];

const WEIGHT_OPTIONS = ["Up to 1 kg", "1-3 kg", "3-5 kg", "5-10 kg", "10-25 kg", "25 kg+"];

const AddressDropdown = ({
  options = [],
  value,
  onChange,
  allowCustom = false,
  customValue = "custom_drop",
  customLabel = "Other / Custom Drop Address...",
  placeholder = "Select Address",
  label = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    if (allowCustom && value === customValue) {
      return { _id: customValue, label: customLabel, fullAddress: "Enter manual address below" };
    }
    return options.find((opt) => opt._id === value || opt.id === value) || options[0] || null;
  }, [options, value, allowCustom, customValue, customLabel]);

  const getItemIcon = (opt) => {
    if (opt?._id === customValue || opt?.id === customValue) return <Plus size={14} className="text-emerald-700" />;
    const lbl = (opt?.label || opt?.name || "").toLowerCase();
    if (lbl.includes("current") || opt?._id === "current_location_temp") return <Navigation size={13} className="text-emerald-600" />;
    if (lbl.includes("map") || opt?._id?.includes("map")) return <MapPin size={13} className="text-sky-600" />;
    if (lbl.includes("home") || lbl.includes("ఇంటి")) return <Home size={13} className="text-emerald-600" />;
    return <MapPin size={13} className="text-emerald-600" />;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full mt-1 px-3 py-2.5 bg-slate-50 hover:bg-slate-100/90 active:bg-slate-100 border border-slate-200/90 hover:border-emerald-500/60 rounded-xl text-left transition flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0">
            {getItemIcon(selectedOption)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold text-slate-800 truncate">
              {selectedOption ? (selectedOption.label || selectedOption.name || "Selected Address") : placeholder}
            </div>
            {selectedOption && (selectedOption.fullAddress || selectedOption.address) && (
              <div className="text-[13px] font-medium text-slate-700 truncate max-w-full">
                {selectedOption.fullAddress || selectedOption.address}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-600 group-hover:text-slate-600 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-700" : ""
          }`}
        />
      </button>

      {/* Dropdown Options Popup */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[13px] font-black text-slate-700 uppercase tracking-wider">
            {label || "Choose an Address"}
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {options.map((addr) => {
              const addrId = addr._id || addr.id;
              const isSelected = value === addrId;
              const addrTitle = addr.label || addr.name || "Address";
              const addrDetails = addr.fullAddress || addr.address;

              return (
                <button
                  key={addrId}
                  type="button"
                  onClick={() => {
                    onChange(addrId);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 sm:p-3 text-left flex items-start gap-2.5 hover:bg-emerald-50/50 transition cursor-pointer ${
                    isSelected ? "bg-emerald-50/80 font-bold" : "bg-white"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {getItemIcon(addr)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13.5px] font-black text-slate-900 leading-snug">
                        {addrTitle}
                      </span>
                      {addr._id === "current_location_temp" && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[12px] font-bold rounded-md">
                          Live GPS
                        </span>
                      )}
                      {addr._id?.includes("map") && (
                        <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 text-[12px] font-bold rounded-md">
                          Map Pin
                        </span>
                      )}
                    </div>
                    {addrDetails && (
                      <p className="text-[13.5px] text-slate-700 font-normal leading-relaxed mt-0.5 line-clamp-2 break-words">
                        {addrDetails}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-1 mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}

            {allowCustom && (
              <button
                type="button"
                onClick={() => {
                  onChange(customValue);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 sm:p-3 text-left flex items-center gap-2.5 hover:bg-slate-50 transition cursor-pointer border-t border-dashed border-slate-200 ${
                  value === customValue ? "bg-emerald-50/80 font-bold" : "bg-white"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    value === customValue
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-emerald-700"
                  }`}
                >
                  <Plus size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[13.5px] font-black text-emerald-800">
                    {customLabel}
                  </span>
                  <p className="text-[13px] text-slate-600 leading-tight">
                    Type a manual landmark or doorstep address
                  </p>
                </div>
                {value === customValue && (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-1">
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ShopDropdown = ({
  shops = [],
  value,
  onChange,
  allowCustom = true,
  customValue = "custom_shop",
  customLabel = "Other Local Shop in Aswapuram (ఇతర షాప్)...",
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedShop = useMemo(() => {
    if (value === customValue) {
      return { _id: customValue, shopName: "Other Local Store", locality: "Enter name & location below" };
    }
    return shops.find((s) => s._id === value || s.id === value) || null;
  }, [shops, value, customValue]);

  if (loading) {
    return <p className="text-[13.5px] text-slate-600 py-2">Loading nearby stores in Aswapuram...</p>;
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full mt-1 px-3 py-2.5 bg-slate-50 hover:bg-slate-100/90 active:bg-slate-100 border border-slate-200/90 hover:border-emerald-500/60 rounded-xl text-left transition flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0">
            <Store size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold text-slate-800 truncate">
              {selectedShop ? selectedShop.shopName : "-- Choose Store --"}
            </div>
            {selectedShop && selectedShop.locality && (
              <div className="text-[13px] font-medium text-slate-700 truncate max-w-full">
                {selectedShop.locality}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-600 group-hover:text-slate-600 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-700" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[13px] font-black text-slate-700 uppercase tracking-wider">
            Choose Store in Aswapuram
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {shops.map((s) => {
              const shopId = s._id || s.id;
              const isSelected = value === shopId;
              return (
                <button
                  key={shopId}
                  type="button"
                  onClick={() => {
                    onChange(shopId);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 sm:p-3 text-left flex items-start gap-2.5 hover:bg-emerald-50/50 transition cursor-pointer ${
                    isSelected ? "bg-emerald-50/80 font-bold" : "bg-white"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Store size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13.5px] font-black text-slate-900 leading-snug flex items-center gap-1.5 flex-wrap">
                      {s.shopName}
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[12px] font-black uppercase ${
                          s.isOpen === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {s.isOpen === false ? "Closed" : "Open"}
                      </span>
                    </span>
                    <p className="text-[13.5px] text-slate-700 font-normal mt-0.5 truncate">
                      {s.locality || s.address || "Aswapuram"}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-1 mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}

            {allowCustom && (
              <button
                type="button"
                onClick={() => {
                  onChange(customValue);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 sm:p-3 text-left flex items-center gap-2.5 hover:bg-slate-50 transition cursor-pointer border-t border-dashed border-slate-200 ${
                  value === customValue ? "bg-emerald-50/80 font-bold" : "bg-white"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    value === customValue ? "bg-emerald-600 text-white" : "bg-slate-100 text-emerald-700"
                  }`}
                >
                  <Plus size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[13.5px] font-black text-emerald-800">
                    {customLabel}
                  </span>
                  <p className="text-[13px] text-slate-600 leading-tight">
                    Type any unlisted local shop name & street
                  </p>
                </div>
                {value === customValue && (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-1">
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CargoPointDropdown = ({
  points = CARGO_POINTS,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedPoint = useMemo(() => {
    return points.find((p) => p.id === value) || points[0];
  }, [points, value]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full mt-1 px-3 py-2.5 bg-slate-50 hover:bg-slate-100/90 active:bg-slate-100 border border-slate-200/90 hover:border-emerald-500/60 rounded-xl text-left transition flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0">
            <Truck size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold text-slate-800 truncate">
              {selectedPoint?.name || "Select Transport Point"}
            </div>
            {selectedPoint?.loc && (
              <div className="text-[13px] font-medium text-slate-700 truncate max-w-full">
                {selectedPoint.loc}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-600 group-hover:text-slate-600 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-700" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[13px] font-black text-slate-700 uppercase tracking-wider">
            Select Cargo or Bus Stand Counter
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {points.map((p) => {
              const isSelected = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 sm:p-3 text-left flex items-start gap-2.5 hover:bg-emerald-50/50 transition cursor-pointer ${
                    isSelected ? "bg-emerald-50/80 font-bold" : "bg-white"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Truck size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13.5px] font-black text-slate-900 leading-snug">
                      {p.name}
                    </span>
                    <p className="text-[13.5px] text-slate-700 font-normal mt-0.5 truncate">
                      {p.loc}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-1 mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PickupDelivery = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentLocation, refreshLocation } = useLocation();
  const { settings } = useSettings();
  const { user } = useAuth();

  // Active Service Tab
  const requestedService = searchParams.get("service");
  const initialService = ["home_to_home", "shop_to_home", "cargo_to_home", "rider_delivery"].includes(requestedService)
    ? requestedService
    : "home_to_home";
  const [activeTab, setActiveTab] = useState(initialService);

  // Sync tab with URL search param changes
  useEffect(() => {
    const serviceFromUrl = searchParams.get("service");
    if (serviceFromUrl && ["home_to_home", "shop_to_home", "cargo_to_home", "rider_delivery"].includes(serviceFromUrl)) {
      setActiveTab(serviceFromUrl);
    }
  }, [searchParams]);

  const [shops, setShops] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Admin-managed cargo / bus-stand points; falls back to the built-in list.
  const cargoPoints = useMemo(() => {
    if (Array.isArray(settings?.cargoPoints) && settings.cargoPoints.length > 0) {
      const enabled = settings.cargoPoints.filter((p) => p.enabled !== false);
      if (enabled.length > 0) return enabled;
    }
    return CARGO_POINTS;
  }, [settings?.cargoPoints]);

  // Common Form States
  const [paymentMode, setPaymentMode] = useState("COD"); // COD or ONLINE

  // 1. Home to Home State
  const [h2hSenderName, setH2hSenderName] = useState(user?.name || user?.fullName || "");
  const [h2hSenderPhone, setH2hSenderPhone] = useState(user?.phone || user?.phoneNumber || "");
  const [h2hPickupAddress, setH2hPickupAddress] = useState("");
  const [h2hReceiverName, setH2hReceiverName] = useState("");
  const [h2hReceiverPhone, setH2hReceiverPhone] = useState("");
  const [h2hDropAddress, setH2hDropAddress] = useState("");
  const [h2hSelectedDropAddressId, setH2hSelectedDropAddressId] = useState("");
  const [h2hParcelDetails, setH2hParcelDetails] = useState("");
  const [h2hInstructions, setH2hInstructions] = useState("");
  const [h2hWeight, setH2hWeight] = useState("Up to 1 kg");
  const [h2hItemsCount, setH2hItemsCount] = useState("1");
  // Drop point chosen via GPS / map pin (Rapido-style) instead of a saved address.
  const [h2hMapDropAddress, setH2hMapDropAddress] = useState(null);
  const [isH2hMapOpen, setIsH2hMapOpen] = useState(false);
  const [isH2hPickupMapOpen, setIsH2hPickupMapOpen] = useState(false);

  // 2. Shop to Home State
  const [selectedShopId, setSelectedShopId] = useState("");
  const [customShopName, setCustomShopName] = useState("");
  const [customShopLocation, setCustomShopLocation] = useState("");
  const [shopParcelDetails, setShopParcelDetails] = useState("");
  const [shopInstructions, setShopInstructions] = useState("");
  const [shopSelectedAddressId, setShopSelectedAddressId] = useState("");
  const [shopItemsCount, setShopItemsCount] = useState("");
  const [shopWeight, setShopWeight] = useState("Up to 1 kg");

  // 3. Cargo to Home State
  const [selectedCargoPointId, setSelectedCargoPointId] = useState(CARGO_POINTS[0].id);
  const [customCargoName, setCustomCargoName] = useState("");
  const [cargoLrNumber, setCargoLrNumber] = useState("");
  const [cargoOriginCity, setCargoOriginCity] = useState("");
  const [cargoSelectedAddressId, setCargoSelectedAddressId] = useState("");
  const [cargoItemsCount, setCargoItemsCount] = useState("1");
  const [cargoWeight, setCargoWeight] = useState("Up to 1 kg");
  const [cargoReceiverName, setCargoReceiverName] = useState("");
  const [cargoReceiverPhone, setCargoReceiverPhone] = useState("");
  const [cargoParcelDetails, setCargoParcelDetails] = useState("");
  const [cargoInstructions, setCargoInstructions] = useState("");
  const [cargoMapDropAddress, setCargoMapDropAddress] = useState(null);
  const [cargoDropAddress, setCargoDropAddress] = useState("");
  const [cargoPickupCoords, setCargoPickupCoords] = useState(null);
  const [isCargoMapOpen, setIsCargoMapOpen] = useState(false);
  const [isCargoDropMapOpen, setIsCargoDropMapOpen] = useState(false);

  // 4. Rider Delivery Request State
  const [riderPickupLoc, setRiderPickupLoc] = useState("");
  // Real coordinates of the typed / GPS pickup. Without these the distance was
  // always measured from the app's saved location, not from the pickup typed.
  const [h2hPickupCoords, setH2hPickupCoords] = useState(null);
  const [h2hPickupCoordsAddress, setH2hPickupCoordsAddress] = useState("");
  const [riderPickupCoords, setRiderPickupCoords] = useState(null);
  const lastGeocodedRef = useRef({});
  const [riderSenderPhone, setRiderSenderPhone] = useState(user?.phone || user?.phoneNumber || "");
  const [riderDropLoc, setRiderDropLoc] = useState("");
  const [riderReceiverPhone, setRiderReceiverPhone] = useState("");
  const [riderSelectedAddressId, setRiderSelectedAddressId] = useState("");
  const [riderInstructions, setRiderInstructions] = useState("");
  const [riderTiming, setRiderTiming] = useState("instant"); // instant or scheduled
  const [riderScheduleTime, setRiderScheduleTime] = useState("");
  const [riderScheduleDay, setRiderScheduleDay] = useState(0); // 0 = today
  // Drop point chosen via GPS / map pin (Rapido-style) instead of a saved address.
  const [riderMapDropAddress, setRiderMapDropAddress] = useState(null);
  const [isRiderMapOpen, setIsRiderMapOpen] = useState(false);
  const [isRiderPickupMapOpen, setIsRiderPickupMapOpen] = useState(false);

  // Auth/profile data can arrive after the form's first render; fill sender
  // fields once it does, while preserving anything the customer already typed.
  useEffect(() => {
    if (!h2hSenderName.trim()) setH2hSenderName(user?.name || user?.fullName || "");
    if (!h2hSenderPhone.trim()) setH2hSenderPhone(user?.phone || user?.phoneNumber || "");
  }, [user?.name, user?.fullName, user?.phone, user?.phoneNumber]);

  // Auth/profile data can arrive after the form's first render; fill sender
  // fields once it does, while preserving anything the customer already typed.
  useEffect(() => {
    if (!h2hSenderName.trim()) setH2hSenderName(user?.name || user?.fullName || "");
    if (!h2hSenderPhone.trim()) setH2hSenderPhone(user?.phone || user?.phoneNumber || "");
  }, [user?.name, user?.fullName, user?.phone, user?.phoneNumber]);

  // Format Current Location into an address object
  const currentLocAddress = useMemo(() => {
    if (!currentLocation) return null;
    return {
      _id: "current_location_temp",
      id: "current_location_temp",
      label: "Current Location (ప్రస్తుత స్థానం)",
      fullAddress: currentLocation.name || currentLocation.address || "My Current Location, Aswapuram",
      address: currentLocation.name || currentLocation.address || "My Current Location, Aswapuram",
      name: user?.name || "Current Location",
      city: currentLocation.city || "Aswapuram",
      landmark: "",
      location: {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      }
    };
  }, [currentLocation, user]);

  const allAddresses = useMemo(() => {
    const list = [...addresses];
    if (currentLocAddress && !list.some(a => a._id === "current_location_temp")) {
      list.unshift(currentLocAddress);
    }
    return list;
  }, [addresses, currentLocAddress]);

  // Turn a confirmed MapPicker pin into an address-shaped object so every
  // distance/fare/submit lookup that already searches by _id "just works"
  // without needing a separate code path for a map-picked drop point.
  const buildMapAddress = (id, result, fallbackName) => result ? {
    _id: id,
    id,
    label: "📍 Selected on Map",
    name: fallbackName || "Selected on Map",
    fullAddress: result.address,
    address: result.address,
    city: result.city || "Aswapuram",
    location: { lat: result.lat, lng: result.lng },
  } : null;

  const h2hDropAddressOptions = useMemo(() => {
    const mapAddr = buildMapAddress("h2h_map_drop", h2hMapDropAddress, h2hReceiverName || "Receiver");
    return mapAddr ? [mapAddr, ...allAddresses] : allAddresses;
  }, [allAddresses, h2hMapDropAddress, h2hReceiverName]);

  const riderDropAddressOptions = useMemo(() => {
    const mapAddr = buildMapAddress("rider_map_drop", riderMapDropAddress, "Drop Contact");
    return mapAddr ? [mapAddr, ...allAddresses] : allAddresses;
  }, [allAddresses, riderMapDropAddress]);

  const cargoDropAddressOptions = useMemo(() => {
    const mapAddr = buildMapAddress("cargo_map_drop", cargoMapDropAddress, cargoReceiverName || "Receiver");
    return mapAddr ? [mapAddr, ...allAddresses] : allAddresses;
  }, [allAddresses, cargoMapDropAddress, cargoReceiverName]);

  // Set default addresses on load
  useEffect(() => {
    if (allAddresses.length > 0) {
      const defaultId = allAddresses[0]._id || allAddresses[0].id;
      if (!h2hSelectedDropAddressId) setH2hSelectedDropAddressId(defaultId);
      if (!shopSelectedAddressId) setShopSelectedAddressId(defaultId);
      if (!cargoSelectedAddressId) setCargoSelectedAddressId(defaultId);
      if (!riderSelectedAddressId) setRiderSelectedAddressId(defaultId);
      if (!h2hPickupAddress && currentLocAddress) {
        setH2hPickupAddress(currentLocAddress.fullAddress);
        setH2hPickupCoords(currentLocAddress.location);
        setH2hPickupCoordsAddress(currentLocAddress.fullAddress.trim());
      }
      if (!riderPickupLoc && currentLocAddress) setRiderPickupLoc(currentLocAddress.fullAddress);
    }
  }, [allAddresses, currentLocAddress, h2hPickupAddress]);
<<<<<<< HEAD

  useEffect(() => {
    const selected = allAddresses.find((address) => address._id === cargoSelectedAddressId || address.id === cargoSelectedAddressId);
    if (selected) {
      setCargoReceiverName((name) => name || selected.name || user?.name || "");
      setCargoReceiverPhone((phone) => phone || selected.phone || user?.phone || user?.phoneNumber || "");
    }
  }, [allAddresses, cargoSelectedAddressId, user?.name, user?.phone, user?.phoneNumber]);
=======
>>>>>>> 39610c25a20d3d7cf499734140effe26dca0fc41

  // Load saved profile addresses
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const profileRes = await customerApi.getProfile();
        const profile = profileRes?.data?.result || profileRes?.data?.data || profileRes?.data;
        const fetchedAddresses = profile?.addresses || [];
        setAddresses(fetchedAddresses);
      } catch (err) {
        console.error("Failed to load profile addresses", err);
      }
    };
    loadAddresses();
  }, []);

  // Load nearby shops
  useEffect(() => {
    const loadShops = async () => {
      setLoadingShops(true);
      try {
        const shopsRes = await customerApi.getNearbySellers({
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });
        let fetchedShops =
          shopsRes?.data?.results || shopsRes?.data?.result || shopsRes?.data || [];
        // Outside every shop's delivery radius the nearby list is empty; list
        // all registered shops so the customer can still pick one.
        if (!Array.isArray(fetchedShops) || fetchedShops.length === 0) {
          const allRes = await customerApi.getNearbySellers({});
          fetchedShops = allRes?.data?.results || allRes?.data?.result || allRes?.data || [];
        }
        if (!Array.isArray(fetchedShops)) fetchedShops = [];
        setShops(fetchedShops);
        if (fetchedShops.length > 0 && !selectedShopId) {
          setSelectedShopId(fetchedShops[0]._id || fetchedShops[0].id);
        }
      } catch (err) {
        console.error("Failed to load shops", err);
      } finally {
        setLoadingShops(false);
      }
    };
    loadShops();
  }, [currentLocation?.latitude, currentLocation?.longitude]);


  // Helper to use current location
  // Turn a typed pickup address into coordinates (Google Geocoder), biased to
  // the customer's area. Silent on failure: the previous point is kept.
  const geocodePickup = async (text, key, setCoords, setResolvedAddress) => {
    const q = String(text || "").trim();
    if (!q || lastGeocodedRef.current[key] === q) return;
    if (!window.google?.maps?.Geocoder) return;
    lastGeocodedRef.current[key] = q;
    try {
      const geocoder = new window.google.maps.Geocoder();
      const results = await new Promise((resolve) => {
        geocoder.geocode({ address: q, region: "in", componentRestrictions: { country: "IN" } }, (r, status) =>
          resolve(status === "OK" ? r : null),
        );
      });
      const loc = results?.[0]?.geometry?.location;
      if (loc) {
        setCoords({ lat: loc.lat(), lng: loc.lng() });
        setResolvedAddress?.(q);
      }
    } catch {
      /* keep previous coordinates */
    }
  };

  const handleUseCurrentLocationFor = async (setter, setCoords) => {
    const toastId = toast.loading("Fetching your GPS location...");
    try {
      const result = await refreshLocation();
      if (result?.ok && result.location) {
        const locName = result.location.name || result.location.address || "My Current Location, Aswapuram";
        setter(locName);
        if (setCoords && Number.isFinite(result.location.latitude) && Number.isFinite(result.location.longitude)) {
          setCoords({ lat: result.location.latitude, lng: result.location.longitude });
          if (setCoords === setH2hPickupCoords) setH2hPickupCoordsAddress(locName.trim());
        }
        toast.success("Location updated successfully", { id: toastId });
      } else if (currentLocAddress) {
        setter(currentLocAddress.fullAddress);
        if (setCoords) setCoords(currentLocAddress.location);
        if (setCoords === setH2hPickupCoords) {
          setH2hPickupCoordsAddress(currentLocAddress.fullAddress.trim());
        }
        toast.success("Using current location", { id: toastId });
      } else {
        toast.error("Could not fetch GPS coordinates", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to get location", { id: toastId });
    }
  };

  // Dynamic Distance & Fare Calculations
  // Local estimate only — used until the server quote arrives (or if it fails).
  const localDistance = useMemo(() => {
    if (activeTab === "shop_to_home") {
      const selectedShop = shops.find(s => s._id === selectedShopId || s.id === selectedShopId);
      const selectedAddress = allAddresses.find(a => a._id === shopSelectedAddressId || a.id === shopSelectedAddressId);
      if (selectedShop?.location?.coordinates && selectedAddress?.location) {
        return calculateDistance(
          selectedShop.location.coordinates[1],
          selectedShop.location.coordinates[0],
          selectedAddress.location.lat,
          selectedAddress.location.lng
        );
      }
      return 2.0;
    }

    if (activeTab === "home_to_home") {
      const selectedDrop = h2hDropAddressOptions.find(a => a._id === h2hSelectedDropAddressId || a.id === h2hSelectedDropAddressId);
      if (h2hPickupCoords && selectedDrop?.location) {
        return calculateDistance(
          h2hPickupCoords.lat,
          h2hPickupCoords.lng,
          selectedDrop.location.lat,
          selectedDrop.location.lng
        );
      }
      return null;
    }

    if (activeTab === "rider_delivery") {
      const selectedDrop = riderDropAddressOptions.find(a => a._id === riderSelectedAddressId || a.id === riderSelectedAddressId);
      if (currentLocation?.latitude && selectedDrop?.location) {
        return calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          selectedDrop.location.lat,
          selectedDrop.location.lng
        );
      }
      return 2.5;
    }

    if (activeTab === "cargo_to_home") {
      const selectedAddress = cargoDropAddressOptions.find(a => a._id === cargoSelectedAddressId || a.id === cargoSelectedAddressId) ||
        (cargoSelectedAddressId === "cargo_custom_drop" && cargoDropAddress.trim()
          ? { name: cargoReceiverName, phone: cargoReceiverPhone, fullAddress: cargoDropAddress, address: cargoDropAddress, city: "Aswapuram", location: currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 } }
          : null);
      const pickupCoords = cargoPickupCoords || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null);
      if (pickupCoords && selectedAddress?.location) {
        return calculateDistance(
          pickupCoords.lat,
          pickupCoords.lng,
          selectedAddress.location.lat,
          selectedAddress.location.lng
        );
      }
      return 2.5;
    }

    // Default estimated local trip in Aswapuram
    return 2.5;
  }, [
    activeTab,
    selectedShopId,
    shopSelectedAddressId,
    shops,
    allAddresses,
    h2hDropAddressOptions,
    riderDropAddressOptions,
    h2hSelectedDropAddressId,
    h2hPickupCoords,
    riderSelectedAddressId,
    cargoSelectedAddressId,
    cargoDropAddressOptions,
    cargoPickupCoords,
    cargoDropAddress,
    currentLocation,
  ]);

  // ---- Server fare quote -------------------------------------------------
  // The server quote remains available for booking validation and payment.
  const quoteInput = useMemo(() => {
    const DEFAULT_POINT = { lat: 17.7833, lng: 80.8500 };
    const cur = currentLocation?.latitude
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : DEFAULT_POINT;
    const findAddr = (id) => allAddresses.find((a) => a._id === id || a.id === id);

    if (activeTab === "home_to_home") {
      const d = h2hDropAddressOptions.find((a) => a._id === h2hSelectedDropAddressId || a.id === h2hSelectedDropAddressId);
      const pickupMatchesText = h2hPickupCoords && h2hPickupCoordsAddress === h2hPickupAddress.trim();
      const isCurrentLocation = currentLocAddress && h2hPickupAddress.trim() === currentLocAddress.fullAddress.trim();
      if ((!pickupMatchesText && !isCurrentLocation) || !d?.location) return null;
      return { pickup: pickupMatchesText ? h2hPickupCoords : cur, drop: d.location, weight: h2hWeight };
    }
    if (activeTab === "shop_to_home") {
      const shop = shops.find((x) => x._id === selectedShopId || x.id === selectedShopId);
      const a = findAddr(shopSelectedAddressId);
      if (!a) return null;
      const c = shop?.location?.coordinates;
      const pickup = Array.isArray(c) && c.length === 2 ? { lat: c[1], lng: c[0] } : cur;
      return { pickup, drop: a.location || DEFAULT_POINT, weight: shopWeight, sellerId: shop?._id || shop?.id };
    }
    if (activeTab === "cargo_to_home") {
      const a = cargoDropAddressOptions.find((item) => item._id === cargoSelectedAddressId || item.id === cargoSelectedAddressId);
      if (!a && !(cargoSelectedAddressId === "cargo_custom_drop" && cargoDropAddress.trim())) return null;
      return { pickup: cargoPickupCoords || cur, drop: a?.location || cur || DEFAULT_POINT, weight: cargoWeight };
    }
    if (activeTab === "rider_delivery") {
      const d = riderDropAddressOptions.find((a) => a._id === riderSelectedAddressId || a.id === riderSelectedAddressId);
      return { pickup: riderPickupCoords || cur, drop: d ? d.location || DEFAULT_POINT : cur, timing: riderTiming };
    }
    return null;
  }, [
    activeTab, currentLocation, allAddresses, shops, selectedShopId,
    h2hDropAddressOptions, riderDropAddressOptions,
    h2hSelectedDropAddressId, h2hWeight, shopSelectedAddressId, shopWeight,
<<<<<<< HEAD
    cargoSelectedAddressId, cargoDropAddressOptions, cargoDropAddress, cargoWeight, cargoPickupCoords, riderSelectedAddressId, riderTiming,
=======
    cargoSelectedAddressId, cargoWeight, riderSelectedAddressId, riderTiming,
>>>>>>> 39610c25a20d3d7cf499734140effe26dca0fc41
    h2hPickupCoords, h2hPickupCoordsAddress, h2hPickupAddress, currentLocAddress, riderPickupCoords,
  ]);

  const [fareQuote, setFareQuote] = useState(null);
  const quoteKey = quoteInput ? activeTab + "|" + JSON.stringify(quoteInput) : "";
  useEffect(() => {
    if (!quoteInput) {
      setFareQuote(null);
      return undefined;
    }
    setFareQuote(null);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await customerApi.quoteExpressFare({
          service: activeTab,
          pickupAddress: { location: quoteInput.pickup },
          address: { location: quoteInput.drop },
          sellerId: quoteInput.sellerId,
          weight: quoteInput.weight,
          timing: quoteInput.timing,
        });
        if (!cancelled && res.data?.success) setFareQuote(res.data.result);
      } catch {
        // Keep the local fallback; placement still prices it server-side.
        if (!cancelled) setFareQuote(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // quoteKey captures every input that changes the quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const serviceUnavailable = fareQuote?.serviceEnabled === false;
  const outsideRadius = fareQuote?.withinRadius === false;
  // Admin switch (Fees & Charges): online payment hidden, cash on delivery only.
  const onlinePaymentOn = settings?.onlineEnabled !== false;
  useEffect(() => {
    if (!onlinePaymentOn && paymentMode === "ONLINE") setPaymentMode("COD");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlinePaymentOn]);
  // Booking-time rules set by admin (Admin > Athreya Express > Fare Management).
  const timingRules = {
    instantEnabled: true,
    scheduleEnabled: true,
    minLeadMinutes: 30,
    maxDaysAhead: 0,
    windowStart: "07:00",
    windowEnd: "22:00",
    ...(fareQuote?.schedule || {}),
  };
  // If admin turned a mode off, start on the one that is available.
  useEffect(() => {
    if (!timingRules.instantEnabled && timingRules.scheduleEnabled && riderTiming === "instant") setRiderTiming("scheduled");
    if (!timingRules.scheduleEnabled && riderTiming === "scheduled") setRiderTiming("instant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timingRules.instantEnabled, timingRules.scheduleEnabled]);
  const fmtClock = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const scheduleDayOptions = Array.from({ length: timingRules.maxDaysAhead + 1 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: i,
      label:
        i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    };
  });
  const calculatedDistance = fareQuote?.distanceKm ?? localDistance;
  const routeSummaryReady = Boolean(
    quoteInput &&
      Number.isFinite(Number(quoteInput.pickup?.lat)) &&
      Number.isFinite(Number(quoteInput.pickup?.lng)) &&
      Number.isFinite(Number(quoteInput.drop?.lat)) &&
      Number.isFinite(Number(quoteInput.drop?.lng)) &&
      ((activeTab === "home_to_home" && h2hSelectedDropAddressId && h2hSelectedDropAddressId !== "custom_drop") ||
        (activeTab === "shop_to_home" && selectedShopId && selectedShopId !== "custom_shop" && shopSelectedAddressId) ||
        (activeTab === "cargo_to_home" && cargoSelectedAddressId) ||
        (activeTab === "rider_delivery" && riderPickupLoc.trim() && riderSelectedAddressId && riderSelectedAddressId !== "custom_rider_drop")),
  );
  const rideFareAmount = Number(fareQuote?.fare?.total);
  const estimatedTotalBill = Number.isFinite(rideFareAmount) ? rideFareAmount : null;
  const moneyLabel = (amount) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
  // Submit Handler for all 4 flows
  const handleBookingSubmit = async () => {
    let parcelDetailsText = "";
    let pickupLocationData = null;
    let dropAddressData = null;
    let finalPickupType = "prepaid";
    let finalBillAmount = 0;
    let targetSellerId = undefined;
    let expressMetaData = {};

    // 1. HOME TO HOME
    if (activeTab === "home_to_home") {
      if (!h2hPickupAddress.trim()) {
        toast.error("Please enter or select pickup address");
        return;
      }
      const pickupIsResolved = h2hPickupCoords && h2hPickupCoordsAddress === h2hPickupAddress.trim();
      const pickupIsCurrent = currentLocAddress && h2hPickupAddress.trim() === currentLocAddress.fullAddress.trim();
      if (!pickupIsResolved && !pickupIsCurrent) {
        toast.error("Please wait for the pickup address to be verified, or use GPS location");
        return;
      }
      const selectedDrop = h2hDropAddressOptions.find(a => a._id === h2hSelectedDropAddressId || a.id === h2hSelectedDropAddressId);
      if (!selectedDrop?.location) {
        toast.error("Please select a saved or map location with a valid address");
        return;
      }
      const dropAddrStr = selectedDrop ? (selectedDrop.fullAddress || selectedDrop.address) : h2hDropAddress;
      if (!dropAddrStr.trim()) {
        toast.error("Please specify drop address");
        return;
      }
      if (!h2hParcelDetails.trim()) {
        toast.error("Please describe the parcel contents");
        return;
      }

      dropAddressData = selectedDrop ? {
        name: h2hReceiverName || selectedDrop.name || "Receiver",
        phone: h2hReceiverPhone || selectedDrop.phone || "",
        address: dropAddrStr,
        city: selectedDrop.city || "Aswapuram",
        location: selectedDrop.location || { lat: 17.7833, lng: 80.8500 }
      } : {
        name: h2hReceiverName || "Receiver",
        phone: h2hReceiverPhone || "",
        address: h2hDropAddress,
        city: "Aswapuram",
        location: currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 }
      };

      pickupLocationData = {
        name: h2hSenderName || user?.name || "Sender",
        phone: h2hSenderPhone || user?.phone || "",
        address: h2hPickupAddress,
        location: h2hPickupCoords || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 })
      };

      parcelDetailsText = `🏠 [HOME TO HOME PICKUP]\n` +
        `🔢 Items: ${h2hItemsCount || 1} | ⚖️ Weight: ${h2hWeight}\n` +
        `📝 Details: ${h2hParcelDetails}${h2hInstructions ? ` | Instructions: ${h2hInstructions}` : ""}\n` +
        `📤 Pickup From: ${h2hPickupAddress} (Sender: ${h2hSenderName} - ${h2hSenderPhone})\n` +
        `📥 Drop To: ${dropAddrStr} (Receiver: ${h2hReceiverName} - ${h2hReceiverPhone})`;

      expressMetaData = {
        parcelWeight: h2hWeight,
        weight: h2hWeight,
        itemsCount: h2hItemsCount,
        senderName: h2hSenderName,
        senderPhone: h2hSenderPhone,
        receiverName: h2hReceiverName,
        receiverPhone: h2hReceiverPhone,
      };
    }

    // 2. SHOP TO HOME
    else if (activeTab === "shop_to_home") {
      const selectedShop = shops.find(s => s._id === selectedShopId || s.id === selectedShopId);
      const shopTitle = selectedShop ? selectedShop.shopName : customShopName;
      if (!shopTitle.trim()) {
        toast.error("Please select a store or enter shop name");
        return;
      }
      if (!shopParcelDetails.trim()) {
        toast.error("Please enter the shopping items");
        return;
      }

      const selectedAddress = allAddresses.find(a => a._id === shopSelectedAddressId || a.id === shopSelectedAddressId);
      if (!selectedAddress) {
        toast.error("Please select your delivery address");
        return;
      }

      targetSellerId = selectedShop?._id || selectedShop?.id;
      finalPickupType = "prepaid";
      finalBillAmount = 0;

      dropAddressData = {
        name: selectedAddress.name || user?.name || "Customer",
        phone: selectedAddress.phone || user?.phone || "",
        address: selectedAddress.fullAddress || selectedAddress.address,
        city: selectedAddress.city || "Aswapuram",
        location: selectedAddress.location || { lat: 17.7833, lng: 80.8500 }
      };

      parcelDetailsText = `🏪 [SHOP TO HOME PICKUP]\n` +
        `🏪 Shop: ${shopTitle} (${customShopLocation || selectedShop?.locality || "Aswapuram"})\n` +
        `🛒 Items List: ${shopParcelDetails}${shopInstructions ? ` | Instructions: ${shopInstructions}` : ""}\n` +
        `🔢 Items: ${shopItemsCount || "—"} | ⚖️ Weight: ${shopWeight}\n` +
        `📥 Deliver to: ${dropAddressData.address}`;

      const shopCoords = selectedShop?.location?.coordinates;
      const shopLatLng = Array.isArray(shopCoords) && shopCoords.length === 2
        ? { lat: shopCoords[1], lng: shopCoords[0] }
        : (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 });

      pickupLocationData = {
        name: shopTitle,
        phone: selectedShop?.phone || "",
        address: customShopLocation || selectedShop?.locality || selectedShop?.address || "Aswapuram",
        location: shopLatLng,
      };

      expressMetaData = {
        shopName: shopTitle,
        shopLocality: customShopLocation || selectedShop?.locality || "",
        weight: shopWeight,
        itemsCount: shopItemsCount,
      };
    }

    // 3. CARGO TO HOME
    else if (activeTab === "cargo_to_home") {
      const selectedCargoPoint = cargoPoints.find(c => c.id === selectedCargoPointId) || cargoPoints[0];
      const cargoPointName = selectedCargoPoint?.id === "other_cargo" ? customCargoName : selectedCargoPoint?.name;
      if (!cargoPointName.trim()) {
        toast.error("Please select cargo office or specify transport point");
        return;
      }
      if (!cargoLrNumber.trim()) {
        toast.error("Please enter LR / Booking / Waybill number");
        return;
      }
      if (!cargoOriginCity.trim()) {
        toast.error("Please select the cargo pickup location");
        return;
      }
      if (!cargoParcelDetails.trim()) {
        toast.error("Please describe the parcel contents");
        return;
      }

      const selectedAddress = cargoDropAddressOptions.find(a => a._id === cargoSelectedAddressId || a.id === cargoSelectedAddressId) ||
        (cargoSelectedAddressId === "cargo_custom_drop" && cargoDropAddress.trim()
          ? { name: cargoReceiverName, phone: cargoReceiverPhone, fullAddress: cargoDropAddress, address: cargoDropAddress, city: "Aswapuram", location: currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 } }
          : null);
      if (!selectedAddress) {
        toast.error("Please select your delivery address");
        return;
      }
      if (!cargoReceiverName.trim() || !cargoReceiverPhone.trim()) {
        toast.error("Please enter the receiver name and mobile number");
        return;
      }

      finalPickupType = "prepaid";
      finalBillAmount = 0;

      dropAddressData = {
        name: cargoReceiverName || selectedAddress.name || user?.name || "Customer",
        phone: cargoReceiverPhone || selectedAddress.phone || user?.phone || "",
        address: selectedAddress.fullAddress || selectedAddress.address,
        city: selectedAddress.city || "Aswapuram",
        location: selectedAddress.location || { lat: 17.7833, lng: 80.8500 }
      };

      parcelDetailsText = `🚚 [CARGO / BUS TO HOME PICKUP]\n` +
        `🏢 Cargo Point: ${cargoPointName}\n` +
        `📄 LR / Booking No: ${cargoLrNumber}\n` +
        `📍 Pickup: ${cargoOriginCity}\n` +
        `🔢 Parcels: ${cargoItemsCount || 1} | ⚖️ Weight: ${cargoWeight}\n` +
        `📝 Details: ${cargoParcelDetails}${cargoInstructions ? ` | Instructions: ${cargoInstructions}` : ""}\n` +
        `📥 Deliver to: ${dropAddressData.address}`;

      pickupLocationData = {
        name: cargoPointName,
        phone: "",
        address: cargoOriginCity || selectedCargoPoint?.loc || cargoPointName,
        location: cargoPickupCoords || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 }),
      };

      expressMetaData = {
        cargoPointName,
        lrNumber: cargoLrNumber,
        originCity: cargoOriginCity,
        senderContact: "",
        weight: cargoWeight,
        itemsCount: cargoItemsCount,
        parcelDescription: cargoParcelDetails,
        instructions: cargoInstructions,
        receiverName: cargoReceiverName,
        receiverPhone: cargoReceiverPhone,
      };
    }

    // 4. RIDER DELIVERY REQUEST
    else if (activeTab === "rider_delivery") {
      if (!riderPickupLoc.trim()) {
        toast.error("Please specify pickup location");
        return;
      }
      const selectedAddress = riderDropAddressOptions.find(a => a._id === riderSelectedAddressId || a.id === riderSelectedAddressId);
      const dropAddrStr = selectedAddress ? (selectedAddress.fullAddress || selectedAddress.address) : riderDropLoc;
      if (!dropAddrStr.trim()) {
        toast.error("Please specify drop location");
        return;
      }
      // Timing rules come from the admin panel (checked again on the server).
      let riderScheduledAtIso;
      if (riderTiming === "instant" && !timingRules.instantEnabled) {
        toast.error("Instant rider is currently unavailable. Please schedule a time.");
        return;
      }
      if (riderTiming === "scheduled") {
        if (!timingRules.scheduleEnabled) {
          toast.error("Scheduling is currently unavailable. Please choose Instant Rider.");
          return;
        }
        if (!riderScheduleTime) {
          toast.error("Please choose your preferred pickup time");
          return;
        }
        const [hh, mm] = riderScheduleTime.split(":").map(Number);
        const when = new Date();
        when.setDate(when.getDate() + Number(riderScheduleDay || 0));
        when.setHours(hh, mm, 0, 0);
        if (when.getTime() < Date.now() + timingRules.minLeadMinutes * 60 * 1000) {
          toast.error(`Pick a time at least ${timingRules.minLeadMinutes} minutes from now`);
          return;
        }
        if (riderScheduleTime < timingRules.windowStart || riderScheduleTime > timingRules.windowEnd) {
          toast.error(`Pickups are available between ${fmtClock(timingRules.windowStart)} and ${fmtClock(timingRules.windowEnd)}`);
          return;
        }
        riderScheduledAtIso = when.toISOString();
      }

      dropAddressData = selectedAddress ? {
        name: selectedAddress.name || user?.name || "Drop Contact",
        phone: riderReceiverPhone || selectedAddress.phone || user?.phone || "",
        address: dropAddrStr,
        city: selectedAddress.city || "Aswapuram",
        location: selectedAddress.location || { lat: 17.7833, lng: 80.8500 }
      } : {
        name: "Drop Contact",
        phone: riderReceiverPhone || "",
        address: riderDropLoc,
        city: "Aswapuram",
        location: currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 }
      };

      pickupLocationData = {
        name: user?.name || "Pickup Contact",
        phone: riderSenderPhone || user?.phone || "",
        address: riderPickupLoc,
        location: riderPickupCoords || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 17.7833, lng: 80.8500 })
      };

      parcelDetailsText = `🛵 [RIDER PICKUP REQUEST]\n` +
        `📝 Instructions: ${riderInstructions}\n` +
        `📏 Estimated Distance: ${calculatedDistance} km\n` +
        `⏱️ Schedule: ${riderTiming === "instant" ? "Immediate Instant Pickup" : `Scheduled: ${riderScheduleTime}`}\n` +
        `📤 Pickup: ${riderPickupLoc} (Phone: ${riderSenderPhone})\n` +
        `📥 Drop: ${dropAddrStr} (Phone: ${riderReceiverPhone})`;

      expressMetaData = {
        instructions: riderInstructions,
        timing: riderTiming,
        // Full date-time: a bare "14:30" is not a valid date on the server and was dropped.
        scheduledAt: riderScheduledAtIso,
        distanceKm: calculatedDistance,
      };
    }

    setSubmitting(true);
    const toastId = toast.loading("Confirming your Athreya Express booking...");

    try {
      const payload = {
        sellerId: targetSellerId,
        pickupAddress: pickupLocationData,
        parcelDetails: parcelDetailsText.trim(),
        
        pickupType: finalPickupType,
        billAmount: finalBillAmount,
        address: dropAddressData,
        paymentMode,
        expressService: activeTab,
        expressMeta: expressMetaData,
      };

      const res = await customerApi.placeCustomPickupOrder(payload);
      if (res.data.success) {
        const orderObj = res.data.result?.order;
        const orderId = orderObj?.orderId;

        if (paymentMode === "ONLINE" && orderId) {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: orderId,
              orderId: orderId,
            });
            if (paymentRes.data.success && paymentRes.data.result?.redirectUrl) {
              window.location.href = paymentRes.data.result.redirectUrl;
              return;
            }
          } catch (payError) {
            toast.error("Order created. Please pay from order details page.", { id: toastId });
            navigate(`/orders/${orderId}`);
            return;
          }
        }

        toast.success("⚡ Athreya Express order placed! Rider being assigned...", { id: toastId });
        navigate(`/orders/${orderId || ""}`);
      } else {
        throw new Error(res.data.message || "Failed to place order");
      }
    } catch (err) {
      console.error("Express Booking Error:", err);
      toast.error(err?.response?.data?.message || err.message || "Failed to place booking. Please try again.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="express-booking-page max-w-xl mx-auto p-3.5 sm:p-4 pb-6 min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500 font-black text-[15px]">⚡</span>
              <h1 className="text-base sm:text-lg font-black text-[#042A0F] tracking-tight">ATHREYA EXPRESS</h1>
            </div>
            <p className="text-[13px] sm:text-[13.5px] font-bold text-slate-700">
              {activeTab === "cargo_to_home" ? "Cargo to Home Pickup" : activeTab === "rider_delivery" ? "Fast & Easy Rider Booking" : activeTab === "shop_to_home" ? "Fast & Easy Shop Delivery" : "Fast & Easy Home Delivery"}
            </p>
          </div>
        </div>

        <span className="express-service-badge">
          {activeTab === "cargo_to_home" ? "CARGO" : activeTab === "rider_delivery" ? "RIDER" : activeTab === "shop_to_home" ? "SHOP" : "HOME TO HOME"}
        </span>
      </div>

      {/* ========================================================
          FLOW 1: HOME TO HOME PICKUP
      ======================================================== */}
      {activeTab === "home_to_home" && (
        <div className="space-y-4">
          {/* Step 1: Pickup Details */}
          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">1</span>
              Pickup Details
            </h3>

            <div className="express-h2h-pickup-fields">
              <div className="express-h2h-pickup-address">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[13.5px] font-bold text-slate-700">Sender Pickup Address</Label>
                  <button 
                    type="button"
                    onClick={() => handleUseCurrentLocationFor(setH2hPickupAddress, setH2hPickupCoords)}
                    className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    <Navigation size={10} /> Use GPS Location
                  </button>
                  <button type="button" onClick={() => setIsH2hPickupMapOpen(true)} className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5">
                    <MapPin size={10} /> Choose on Map
                  </button>
                </div>
                <Input
                  placeholder="E.g., House No 4-22, Near Ganesh Temple, Aswapuram"
                  value={h2hPickupAddress}
                  onChange={(e) => {
                    const value = e.target.value;
                    setH2hPickupAddress(value);
                    delete lastGeocodedRef.current.h2h;
                    if (value.trim() !== h2hPickupCoordsAddress) {
                      setH2hPickupCoords(null);
                      setH2hPickupCoordsAddress("");
                    }
                  }}
                  onBlur={() => geocodePickup(h2hPickupAddress, "h2h", setH2hPickupCoords, setH2hPickupCoordsAddress)}
                  className="text-[13.5px] font-semibold rounded-xl bg-slate-50"
                />
              </div>

              <div className="express-h2h-sender grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">Sender Name</Label>
                  <Input
                    placeholder="Your Name"
                    value={h2hSenderName}
                    onChange={(e) => setH2hSenderName(e.target.value)}
                    className="text-[13.5px] rounded-xl bg-slate-50 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">Sender Mobile</Label>
                  <Input
                    placeholder="10-digit mobile"
                    value={h2hSenderPhone}
                    onChange={(e) => setH2hSenderPhone(e.target.value)}
                    className="text-[13.5px] rounded-xl bg-slate-50 mt-1"
                  />
                </div>
              </div>

            </div>
          </Card>

          {/* Step 2: Drop Details */}
          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">2</span>
              Delivery Details
            </h3>

            <div className="express-h2h-drop-fields">
              <div className="express-h2h-drop-address">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[13.5px] font-bold text-slate-700">Select Saved Address or Type Custom</Label>
                  <button
                    type="button"
                    onClick={() => setIsH2hMapOpen(true)}
                    className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <MapPin size={10} /> GPS / Select on Map
                  </button>
                </div>
                {h2hDropAddressOptions.length > 0 && (
                  <AddressDropdown
                    options={h2hDropAddressOptions}
                    value={h2hSelectedDropAddressId}
                    onChange={setH2hSelectedDropAddressId}
                    allowCustom={true}
                    customValue="custom_drop"
                    customLabel="Other / Custom Drop Address..."
                    label="Select Drop Address in Aswapuram"
                  />
                )}
                {h2hSelectedDropAddressId === "custom_drop" && (
                  <Input
                    placeholder="Enter recipient's full address in Aswapuram"
                    value={h2hDropAddress}
                    onChange={(e) => setH2hDropAddress(e.target.value)}
                    className="text-[13.5px] font-semibold rounded-xl bg-slate-50 mt-2"
                  />
                )}
              </div>

              {/* Live estimated distance for the selected drop point */}
              <div className="express-h2h-receiver grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">Receiver Name</Label>
                  <Input
                    placeholder="Receiver's Name"
                    value={h2hReceiverName || h2hDropAddressOptions.find((address) => address._id === h2hSelectedDropAddressId || address.id === h2hSelectedDropAddressId)?.name || ""}
                    onChange={(e) => setH2hReceiverName(e.target.value)}
                    className="text-[13.5px] rounded-xl bg-slate-50 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">Mobile Number</Label>
                  <Input
                    placeholder="Receiver Mobile"
                    value={h2hReceiverPhone || h2hDropAddressOptions.find((address) => address._id === h2hSelectedDropAddressId || address.id === h2hSelectedDropAddressId)?.phone || ""}
                    onChange={(e) => setH2hReceiverPhone(e.target.value)}
                    className="text-[13.5px] rounded-xl bg-slate-50 mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Step 3: Parcel Details */}
          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">3</span>
              Parcel Details (పార్సెల్ వివరాలు)
            </h3>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Parcel Description *</Label>
              <Textarea
                placeholder="E.g., 2 shirts & 1 pant in sealed plastic bag, handle with care"
                value={h2hParcelDetails}
                onChange={(e) => setH2hParcelDetails(e.target.value)}
                className="mt-1 text-[13.5px] bg-slate-50 rounded-xl"
                rows={2}
              />
            </div>

            {/* Items count + Weight */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">No. of Items (వస్తువుల సంఖ్య)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={h2hItemsCount}
                  onChange={(e) => setH2hItemsCount(e.target.value)}
                  className="text-[13.5px] font-bold bg-slate-50 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">Approx. Weight (బరువు)</Label>
                <select
                  value={h2hWeight}
                  onChange={(e) => setH2hWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] font-bold text-slate-800 outline-none"
                >
                  {WEIGHT_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Instructions (Optional)</Label>
              <Textarea value={h2hInstructions} onChange={(e) => setH2hInstructions(e.target.value)} placeholder="Enter instructions..." className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" rows={2} />
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================
          FLOW 2: SHOP TO HOME PICKUP
      ======================================================== */}
      {activeTab === "shop_to_home" && (
        <div className="express-shop-flow">
          {/* Step 1: Select Shop */}
          <Card className="express-shop-company p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">1</span>
              Select Shop in Aswapuram (షాప్ ఎంచుకోండి)
            </h3>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Choose Registered Store or Enter Custom</Label>
              <ShopDropdown
                shops={shops}
                value={selectedShopId}
                onChange={setSelectedShopId}
                loading={loadingShops}
                allowCustom={true}
                customValue="custom_shop"
              />

              {selectedShopId === "custom_shop" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input
                    placeholder="Shop Name (e.g. Sri Balaji Kirana)"
                    value={customShopName}
                    onChange={(e) => setCustomShopName(e.target.value)}
                    className="text-[13.5px] bg-slate-50 rounded-xl"
                  />
                  <Input
                    placeholder="Shop Location/Street"
                    value={customShopLocation}
                    onChange={(e) => setCustomShopLocation(e.target.value)}
                    className="text-[13.5px] bg-slate-50 rounded-xl"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Shopping Details */}
          <Card className="express-shop-items p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">3</span>
              Items List / Bill (వస్తువుల వివరాలు)
            </h3>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Write Items List or Instructions</Label>
              <Textarea
                placeholder="E.g.&#10;1. Sugar 2kg&#10;2. Fortune Sunflower Oil 1L&#10;3. Ashirvad Atta 5kg"
                value={shopParcelDetails}
                onChange={(e) => setShopParcelDetails(e.target.value)}
                className="mt-1 text-[13.5px] bg-slate-50 rounded-xl"
                rows={3}
              />
            </div>

            {/* Items count + Weight (helps the rider carry the right bag) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">No. of Items (వస్తువుల సంఖ్య)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="E.g. 5"
                  value={shopItemsCount}
                  onChange={(e) => setShopItemsCount(e.target.value)}
                  className="text-[13.5px] font-bold bg-slate-50 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">Approx. Weight (బరువు)</Label>
                <select
                  value={shopWeight}
                  onChange={(e) => setShopWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] font-bold text-slate-800 outline-none"
                >
                  {WEIGHT_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Instructions (Optional)</Label>
              <Textarea value={shopInstructions} onChange={(e) => setShopInstructions(e.target.value)} placeholder="Enter item instructions..." className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" rows={2} />
            </div>

          </Card>

          {/* Step 2: Delivery Address */}
          <Card className="express-shop-address p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">2</span>
              Delivery Address
            </h3>

            <AddressDropdown
              options={allAddresses}
              value={shopSelectedAddressId}
              onChange={setShopSelectedAddressId}
              allowCustom={false}
              label="Select Delivery Address"
            />
          </Card>
        </div>
      )}

      {/* ========================================================
          FLOW 3: CARGO TO HOME PICKUP
      ======================================================== */}
      {activeTab === "cargo_to_home" && (
        <div className="express-cargo-flow">
          {/* Step 1: Select Cargo Point */}
          <Card className="express-cargo-pickup p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">1</span>
              Cargo Pickup Details
            </h3>

            <div>
              <Label className="text-[13.5px] font-bold text-slate-700">Cargo Company Name *</Label>
              <CargoPointDropdown
                points={cargoPoints}
                value={selectedCargoPointId}
                onChange={setSelectedCargoPointId}
              />

              {selectedCargoPointId === "other_cargo" && (
                <Input
                  placeholder="Enter Cargo Office name / location"
                  value={customCargoName}
                  onChange={(e) => setCustomCargoName(e.target.value)}
                  className="text-[13.5px] bg-slate-50 rounded-xl mt-2"
                />
              )}
              <div className="mt-3">
                <Label className="text-[13.5px] font-bold text-slate-700">LR Number *</Label>
                <Input placeholder="Enter LR number" value={cargoLrNumber} onChange={(e) => setCargoLrNumber(e.target.value)} className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[13.5px] font-bold text-slate-700">Pickup Location *</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setCargoOriginCity(currentLocation?.name || currentLocation?.address || "Current Location"); setCargoPickupCoords(currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null); }} className="text-xs font-bold text-emerald-600">Current Location</button>
                    <button type="button" onClick={() => setIsCargoMapOpen(true)} className="text-xs font-bold text-emerald-600">Choose on Map</button>
                  </div>
                </div>
                <Input placeholder="Select pickup location" value={cargoOriginCity} onChange={(e) => { setCargoOriginCity(e.target.value); setCargoPickupCoords(null); }} className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" />
              </div>
            </div>
          </Card>

          {/* Step 3: Parcel Details */}
          <Card className="express-cargo-parcel p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">3</span>
              Parcel Details
            </h3>

            <div className="space-y-2.5">
              {/* Items count + Weight — helps the rider judge the bike load */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">No. of Parcels (పార్సెళ్ల సంఖ్య)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={cargoItemsCount}
                    onChange={(e) => setCargoItemsCount(e.target.value)}
                    className="text-[13.5px] font-bold bg-slate-50 rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-bold text-slate-700">Approx. Weight (బరువు)</Label>
                  <select
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] font-bold text-slate-800 outline-none"
                  >
                    {WEIGHT_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">Parcel Description</Label>
                <Textarea value={cargoParcelDetails} onChange={(e) => setCargoParcelDetails(e.target.value)} placeholder="Enter parcel details" className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" rows={2} />
              </div>
              <div>
                <Label className="text-[13.5px] font-bold text-slate-700">Special Instructions (Optional)</Label>
                <Textarea value={cargoInstructions} onChange={(e) => setCargoInstructions(e.target.value)} placeholder="Enter instructions..." className="mt-1 text-[13.5px] bg-slate-50 rounded-xl" rows={2} />
              </div>

            </div>
          </Card>

          {/* Step 2: Customer Details */}
          <Card className="express-cargo-customer p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">2</span>
              Customer Details
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Receiver Name *" value={cargoReceiverName} onChange={(e) => setCargoReceiverName(e.target.value)} className="text-[13.5px] bg-slate-50 rounded-xl" />
              <Input placeholder="Mobile Number *" value={cargoReceiverPhone} onChange={(e) => setCargoReceiverPhone(e.target.value)} className="text-[13.5px] bg-slate-50 rounded-xl" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[13.5px] font-bold text-slate-700">Home Delivery Address *</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCargoSelectedAddressId("current_location_temp")} className="text-xs font-bold text-emerald-600">Current Location</button>
                <button type="button" onClick={() => setIsCargoDropMapOpen(true)} className="text-xs font-bold text-emerald-600">Choose on Map</button>
              </div>
            </div>
            <AddressDropdown
              options={cargoDropAddressOptions}
              value={cargoSelectedAddressId}
              onChange={(id) => {
                setCargoSelectedAddressId(id);
                const address = allAddresses.find((item) => item._id === id || item.id === id);
                if (address) {
                  setCargoReceiverName(address.name || "");
                  setCargoReceiverPhone(address.phone || "");
                }
              }}
              allowCustom={true}
              customValue="cargo_custom_drop"
              customLabel="Other / Custom Delivery Address"
              label="Select Delivery Address"
            />
            {cargoSelectedAddressId === "cargo_custom_drop" && <Input placeholder="Enter delivery address" value={cargoDropAddress} onChange={(e) => setCargoDropAddress(e.target.value)} className="text-[13.5px] bg-slate-50 rounded-xl" />}
          </Card>
        </div>
      )}

      {/* ========================================================
          FLOW 4: RIDER DELIVERY REQUEST
      ======================================================== */}
      {activeTab === "rider_delivery" && (
        <div className="express-rider-flow">
          {/* Step 2: Rider Instructions */}
          <Card className="express-rider-instructions p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">2</span>
              Rider Instructions (Optional)
            </h3>

            <div>
              <Textarea
                placeholder="Enter instructions for rider..."
                value={riderInstructions}
                onChange={(e) => setRiderInstructions(e.target.value)}
                className="mt-1 text-[13.5px] bg-slate-50 rounded-xl"
                rows={2}
              />
            </div>
          </Card>

          {/* Step 2: Pickup & Drop Points */}
          <Card className="express-rider-route p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 overflow-visible">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">1</span>
              Pickup & Drop Location
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[13.5px] font-bold text-slate-700">Pickup Location (ఎక్కడికి వెళ్ళాలి)</Label>
                  <button 
                    type="button"
                    onClick={() => handleUseCurrentLocationFor(setRiderPickupLoc, setRiderPickupCoords)}
                    className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    <Navigation size={10} /> Use GPS
                  </button>
                  <button type="button" onClick={() => setIsRiderPickupMapOpen(true)} className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5">
                    <MapPin size={10} /> Choose on Map
                  </button>
                </div>
                <Input
                  placeholder="Where should rider pick up?"
                  value={riderPickupLoc}
                  onChange={(e) => setRiderPickupLoc(e.target.value)}
                  onBlur={() => geocodePickup(riderPickupLoc, "rider", setRiderPickupCoords)}
                  className="text-[13.5px] rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[13.5px] font-bold text-slate-700">Drop Destination (ఎక్కడికి ఇవ్వాలి)</Label>
                  <button
                    type="button"
                    onClick={() => setIsRiderMapOpen(true)}
                    className="text-[13px] font-black text-emerald-700 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <MapPin size={10} /> GPS / Select on Map
                  </button>
                </div>
                <AddressDropdown
                  options={riderDropAddressOptions}
                  value={riderSelectedAddressId}
                  onChange={setRiderSelectedAddressId}
                  allowCustom={true}
                  customValue="custom_rider_drop"
                  customLabel="Other / Custom Drop Address..."
                  label="Select Drop Destination"
                />
                {riderSelectedAddressId === "custom_rider_drop" && (
                  <Input
                    placeholder="Enter destination in Aswapuram"
                    value={riderDropLoc}
                    onChange={(e) => setRiderDropLoc(e.target.value)}
                    className="text-[13.5px] rounded-xl bg-slate-50 mt-2"
                  />
                )}
              </div>

              {/* Live estimated trip distance + fare for this rider request —
                  updates automatically the moment a drop point is picked. */}
              {riderSelectedAddressId !== "custom_rider_drop" && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <Navigation size={14} className="text-emerald-700 shrink-0" />
                  <span className="text-[13.5px] font-bold text-emerald-900">
                    Trip distance by road: <span className="font-black">{calculatedDistance} km</span>
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Timing */}
          <Card className="express-rider-timing p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#042A0F] text-white flex items-center justify-center text-[13px]">3</span>
              When do you need it?
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!timingRules.instantEnabled}
                onClick={() => setRiderTiming("instant")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  riderTiming === "instant"
                    ? "bg-emerald-50 border-[#16a34a] text-[#042A0F] font-black ring-1 ring-[#16a34a]"
                    : "bg-slate-50 border-slate-200 text-slate-600 font-bold"
                }`}
              >
                <div className="text-[13.5px] font-black">⚡ Instant Rider</div>
                <div className="text-[12px] text-slate-700 mt-0.5">
                  {timingRules.instantEnabled ? "Assign rider immediately for fast delivery." : "Currently unavailable."}
                </div>
              </button>

              <button
                type="button"
                disabled={!timingRules.scheduleEnabled}
                onClick={() => setRiderTiming("scheduled")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  riderTiming === "scheduled"
                    ? "bg-emerald-50 border-[#16a34a] text-[#042A0F] font-black ring-1 ring-[#16a34a]"
                    : "bg-slate-50 border-slate-200 text-slate-600 font-bold"
                }`}
              >
                <div className="text-[13.5px] font-black">🕒 Schedule for Later</div>
                <div className="text-[12px] text-slate-700 mt-0.5">
                  {timingRules.scheduleEnabled
                    ? `Pick a time between ${fmtClock(timingRules.windowStart)} and ${fmtClock(timingRules.windowEnd)}.`
                    : "Currently unavailable."}
                </div>
              </button>
            </div>

            {riderTiming === "scheduled" && (
              <div className="mt-2">
                {scheduleDayOptions.length > 1 && (
                  <div className="mb-2">
                    <Label className="text-[13.5px] font-bold text-slate-700">Day</Label>
                    <select
                      value={riderScheduleDay}
                      onChange={(e) => setRiderScheduleDay(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13.5px] font-bold text-slate-800"
                    >
                      {scheduleDayOptions.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Label className="text-[13.5px] font-bold text-slate-700">Preferred Time</Label>
                <Input
                  type="time"
                  min={timingRules.windowStart}
                  max={timingRules.windowEnd}
                  value={riderScheduleTime}
                  onChange={(e) => setRiderScheduleTime(e.target.value)}
                  className="mt-1 text-[13.5px] bg-slate-50 rounded-xl"
                />
                <p className="mt-1 text-[12px] font-semibold text-slate-600">
                  Available {fmtClock(timingRules.windowStart)} - {fmtClock(timingRules.windowEnd)}, at least {timingRules.minLeadMinutes} minutes from now
                  {timingRules.maxDaysAhead === 0 ? " (today only)" : ""}.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================
          BILLING & BOOKING ACTION
      ======================================================== */}
      <div className="mt-5 space-y-4">
          {routeSummaryReady && (
            <Card className="overflow-hidden border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
              <div>
                  <Translated as="h2" text="Delivery Details" className="text-sm font-black uppercase tracking-wide text-slate-900" />
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                    <Navigation size={13} /> <Translated text="Distance" />
                  </div>
                  <div className="mt-1 text-base font-black text-slate-900">
                    {fareQuote ? `${Number(fareQuote.distanceKm).toFixed(1)} km` : "Calculating…"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                    <Clock size={13} /> <Translated text="Time" />
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    {activeTab === "rider_delivery" && riderTiming === "scheduled"
                      ? (riderScheduleTime ? `Scheduled · ${fmtClock(riderScheduleTime)}` : "Scheduled")
                      : fareQuote?.eta?.label || "Calculating…"}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-800">
                    <IndianRupee size={13} /> <Translated text="Fee" />
                  </div>
                  <div className="mt-1 text-base font-black text-emerald-950">
                    {estimatedTotalBill === null ? "Calculating…" : moneyLabel(estimatedTotalBill)}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${quoteInput.pickup.lat},${quoteInput.pickup.lng}`)}&destination=${encodeURIComponent(`${quoteInput.drop.lat},${quoteInput.drop.lng}`)}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-3 flex flex-row items-center justify-start gap-2 rounded-xl border-0 bg-transparent p-0 text-emerald-500 hover:bg-transparent sm:col-span-1"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                    <Map size={14} /> <Translated text="Map" />
                  </div>
                  <Translated as="div" text="View route" className="mt-1 text-sm font-black" />
                </a>
              </div>
            </Card>
          )}

          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-[13.5px] font-black text-slate-900 uppercase tracking-wide">
              {activeTab === "cargo_to_home" ? "Delivery Fee Payment" : "Payment Method"}
            </h3>

            <div className="divide-y divide-slate-100 text-[13.5px]">
              {serviceUnavailable && (
                <div className="my-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[13.5px] font-bold text-rose-700">
                  This service is temporarily unavailable. Please try another Athreya Express service.
                </div>
              )}

              {outsideRadius && (
                <div className="my-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[13.5px] font-bold text-rose-700">
                  This location is outside the Athreya Express service area (maximum {fareQuote?.maxDistanceKm} km). Please choose a closer location.
                </div>
              )}
            </div>

            {/* Payment Mode Selector */}
            <div className="pt-2 border-t border-slate-100">
              <Label className="text-[13.5px] font-bold text-slate-700 mb-1.5 block">Payment Mode</Label>
              <div className={`grid gap-2 ${onlinePaymentOn ? "grid-cols-2" : "grid-cols-1"}`}>
                <button
                  type="button"
                  onClick={() => setPaymentMode("COD")}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === "COD"
                      ? "bg-emerald-50 border-[#16a34a] text-[#042A0F] font-black ring-1 ring-[#16a34a]"
                      : "bg-slate-50 border-slate-200 text-slate-600 font-bold"
                  }`}
                >
                  💵 Cash to Rider (COD)
                </button>

                {onlinePaymentOn && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("ONLINE")}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === "ONLINE"
                      ? "bg-emerald-50 border-[#16a34a] text-[#042A0F] font-black ring-1 ring-[#16a34a]"
                      : "bg-slate-50 border-slate-200 text-slate-600 font-bold"
                  }`}
                >
                  💳 Online Payment
                </button>
                )}
              </div>
            </div>
          </Card>

          {/* Confirm & Book CTA */}
          <button
            type="button"
            disabled={submitting || serviceUnavailable || outsideRadius}
            onClick={handleBookingSubmit}
            className="w-full py-3.5 bg-[#042A0F] hover:bg-[#063A16] disabled:opacity-70 text-white rounded-2xl font-black text-[15px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
          >
            <span>
              {submitting ? "Confirming booking..." : `⚡ Confirm ${activeTab === "cargo_to_home" ? "Cargo Order" : activeTab === "rider_delivery" ? "Rider Booking" : activeTab === "shop_to_home" ? "Shop Order" : "Express Order"}`}
            </span>
          </button>

          <p className="text-center text-[13px] text-slate-700 font-medium">
            Safe & reliable delivery by verified Athreya delivery partners
          </p>
      </div>

      {/* Drop location pickers — GPS / drag-pin, Rapido-style. Confirming turns
          the pin into an address entry the distance/fare/submit logic already
          knows how to read (see h2hDropAddressOptions / riderDropAddressOptions). */}
      <MapPicker
        isOpen={isH2hMapOpen}
        onClose={() => setIsH2hMapOpen(false)}
        mode="point"
        title="Select Drop Location"
        searchPlaceholder="Search drop address in Aswapuram..."
        confirmLabel="Use This Location"
        initialLocation={
          currentLocation?.latitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : null
        }
        onConfirm={(result) => {
          setH2hMapDropAddress(result);
          setH2hSelectedDropAddressId("h2h_map_drop");
        }}
      />
      <MapPicker
        isOpen={isH2hPickupMapOpen}
        onClose={() => setIsH2hPickupMapOpen(false)}
        mode="point"
        title="Select Pickup Location"
        searchPlaceholder="Search pickup address in Aswapuram..."
        confirmLabel="Use This Location"
        initialLocation={currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
        onConfirm={(result) => {
          setH2hPickupAddress(result.address || "Selected pickup location");
          setH2hPickupCoords({ lat: result.lat, lng: result.lng });
          setH2hPickupCoordsAddress((result.address || "Selected pickup location").trim());
        }}
      />
      <MapPicker
        isOpen={isRiderMapOpen}
        onClose={() => setIsRiderMapOpen(false)}
        mode="point"
        title="Select Drop Location"
        searchPlaceholder="Search drop address in Aswapuram..."
        confirmLabel="Use This Location"
        initialLocation={
          currentLocation?.latitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : null
        }
        onConfirm={(result) => {
          setRiderMapDropAddress(result);
          setRiderSelectedAddressId("rider_map_drop");
        }}
      />
      <MapPicker
        isOpen={isCargoMapOpen}
        onClose={() => setIsCargoMapOpen(false)}
        mode="point"
        title="Select Cargo Pickup Location"
        searchPlaceholder="Search cargo pickup address..."
        confirmLabel="Use This Location"
        initialLocation={currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
        onConfirm={(result) => {
          setCargoOriginCity(result.address || result.name || "Selected pickup location");
          setCargoPickupCoords({ lat: result.lat, lng: result.lng });
        }}
      />
      <MapPicker
        isOpen={isCargoDropMapOpen}
        onClose={() => setIsCargoDropMapOpen(false)}
        mode="point"
        title="Select Delivery Location"
        searchPlaceholder="Search delivery address..."
        confirmLabel="Use This Location"
        initialLocation={currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
        onConfirm={(result) => {
          setCargoMapDropAddress(result);
          setCargoSelectedAddressId("cargo_map_drop");
        }}
      />
      <MapPicker
        isOpen={isRiderPickupMapOpen}
        onClose={() => setIsRiderPickupMapOpen(false)}
        mode="point"
        title="Select Pickup Location"
        searchPlaceholder="Search pickup address..."
        confirmLabel="Use This Location"
        initialLocation={currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
        onConfirm={(result) => {
          setRiderPickupLoc(result.address || result.name || "Selected pickup location");
          setRiderPickupCoords({ lat: result.lat, lng: result.lng });
        }}
      />
    </div>
  );
};

export default PickupDelivery;
