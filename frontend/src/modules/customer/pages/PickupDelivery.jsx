import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Upload, FileText, Image as ImageIcon, CheckCircle, Info, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import { useLocation } from "../context/LocationContext";
import axiosInstance from "@core/api/axios";
import Card from "@/shared/components/ui/Card";

const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
  return R * c;
};

const getDeliveryFee = (distance) => {
  const baseDistance = 0.5;
  const baseFee = 30;
  const surchargePerKm = 10;
  if (distance <= baseDistance) return baseFee;
  return baseFee + Math.ceil(distance - baseDistance) * surchargePerKm;
};

const PickupDelivery = () => {
  const navigate = useNavigate();
  const { currentLocation } = useLocation();
  const [shops, setShops] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [selectedShopId, setSelectedShopId] = useState("");
  const [parcelDetails, setParcelDetails] = useState("");
  const [parcelImage, setParcelImage] = useState("");
  const [pickupType, setPickupType] = useState("prepaid"); // prepaid or pay_and_collect
  const [billAmount, setBillAmount] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMode, setPaymentMode] = useState("COD"); // COD or ONLINE

  const [showAddressList, setShowAddressList] = useState(false);

  const currentLocAddress = React.useMemo(() => {
    if (!currentLocation) return null;
    return {
      _id: "current_location_temp",
      id: "current_location_temp",
      label: "Current Location",
      fullAddress: currentLocation.name || "My Current Location",
      address: currentLocation.name || "My Current Location",
      name: "Current Location",
      city: currentLocation.city || "",
      landmark: "",
      location: {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      }
    };
  }, [currentLocation]);

  const allAddresses = React.useMemo(() => {
    const list = [...addresses];
    if (currentLocAddress) {
      if (!list.some(a => a._id === "current_location_temp")) {
        list.unshift(currentLocAddress);
      }
    }
    return list;
  }, [addresses, currentLocAddress]);

  const handleUseCurrentLocation = () => {
    if (currentLocAddress) {
      setSelectedAddressId("current_location_temp");
      toast.success("Using current location as delivery address");
    } else {
      toast.error("Could not fetch current location");
    }
  };

  // Derived calculations
  const selectedShop = shops.find((s) => s._id === selectedShopId || s.id === selectedShopId);
  const selectedAddress = allAddresses.find((a) => a._id === selectedAddressId || a.id === selectedAddressId);

  const distance =
    selectedShop?.location?.coordinates && selectedAddress?.location
      ? calculateDistance(
          selectedShop.location.coordinates[1],
          selectedShop.location.coordinates[0],
          selectedAddress.location.lat,
          selectedAddress.location.lng
        )
      : 0;

  const deliveryFee = getDeliveryFee(distance);
  const billAmtNum = pickupType === "pay_and_collect" ? Number(billAmount || 0) : 0;
  const totalAmount = deliveryFee + billAmtNum;

  useEffect(() => {
    const loadShopsAndAddresses = async () => {
      setLoadingShops(true);
      try {
        // Load nearby shops
        const shopsRes = await customerApi.getNearbySellers({
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });
        const fetchedShops =
          shopsRes?.data?.results || shopsRes?.data?.result || shopsRes?.data || [];
        setShops(fetchedShops);

        // Load saved addresses
        const profileRes = await customerApi.getProfile();
        const profile = profileRes?.data?.result || profileRes?.data?.data || profileRes?.data;
        const fetchedAddresses = profile?.addresses || [];
        setAddresses(fetchedAddresses);
        if (fetchedAddresses.length > 0) {
          setSelectedAddressId(fetchedAddresses[0]._id || fetchedAddresses[0].id);
        }
      } catch (err) {
        console.error("Failed to load shops or addresses", err);
        toast.error("Failed to load initial shops list or profile addresses.");
      } finally {
        setLoadingShops(false);
      }
    };

    loadShopsAndAddresses();
  }, [currentLocation]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadForm = new FormData();
    uploadForm.append("file", file);

    setUploading(true);
    try {
      const uploadRes = await axiosInstance.post("/media/upload", uploadForm, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url =
        uploadRes.data?.result?.url ||
        uploadRes.data?.data?.url ||
        uploadRes.data?.url ||
        "";
      if (url) {
        setParcelImage(url);
        toast.success("Image uploaded successfully");
      } else {
        throw new Error("Upload response missing URL");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedShopId) {
      toast.error("Please select a shop");
      return;
    }
    if (!parcelDetails.trim() && !parcelImage) {
      toast.error("Please provide parcel details or upload a photo/screenshot");
      return;
    }
    if (pickupType === "pay_and_collect" && !billAmount) {
      toast.error("Please specify the shop bill amount");
      return;
    }
    if (!selectedAddressId) {
      toast.error("Please select a delivery address");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sellerId: selectedShopId,
        parcelDetails: parcelDetails.trim(),
        parcelImage,
        pickupType,
        billAmount: billAmtNum,
        address: {
          name: selectedAddress.name || "Default Address",
          address: selectedAddress.fullAddress || selectedAddress.address || "",
          city: selectedAddress.city || "",
          phone: selectedAddress.phone || "",
          landmark: selectedAddress.landmark || "",
          location: selectedAddress.location,
        },
        paymentMode,
      };

      const res = await customerApi.placeCustomPickupOrder(payload);
      toast.success("Booking confirmed successfully!");
      navigate("/orders");
    } catch (err) {
      console.error("Booking Error", err);
      toast.error(err?.response?.data?.message || "Failed to place booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-32 min-h-screen font-outfit">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/")}
          className="p-2 bg-white ring-1 ring-slate-100 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Direct Parcel Pickup</h1>
          <p className="text-xs text-slate-500">Book custom delivery from local shops</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Step 1: Shop Selection */}
        <Card className="p-4 border-none shadow-md ring-1 ring-slate-100 bg-white">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">1</span>
            Select Shop
          </h2>
          {loadingShops ? (
            <p className="text-xs text-slate-400">Loading nearby stores...</p>
          ) : (
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none ring-1 ring-slate-200/50 focus:ring-slate-400"
            >
              <option value="">Choose a nearby shop...</option>
              {shops.map((shop) => (
                <option key={shop._id} value={shop._id}>
                  {shop.shopName} - {shop.location?.name || "Indore"}
                </option>
              ))}
            </select>
          )}
        </Card>

        {/* Step 2: Parcel details */}
        <Card className="p-4 border-none shadow-md ring-1 ring-slate-100 bg-white">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">2</span>
            Parcel details / Grocery list
          </h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-slate-500">Description / Written list</Label>
              <Textarea
                placeholder="E.g., 2kg potatoes, 1 packet milk, or 'Pickup ready clothes parcel from store'"
                value={parcelDetails}
                onChange={(e) => setParcelDetails(e.target.value)}
                className="mt-1 text-xs font-medium bg-slate-50 border-none rounded-xl focus:ring-1 focus:ring-slate-400"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500">Upload Photo or Screenshot (Optional)</Label>
              <div className="mt-1 flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 transition-colors">
                  <Upload className="h-4 w-4 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-400">
                    {uploading ? "Uploading..." : "Select File"}
                  </span>
                  <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                </label>
                {parcelImage && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden ring-1 ring-slate-100">
                    <img src={parcelImage} alt="Parcel proof" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Step 3: Collection Type */}
        <Card className="p-4 border-none shadow-md ring-1 ring-slate-100 bg-white">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">3</span>
            Rider Instructions & Bill Payment
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPickupType("prepaid")}
                className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                  pickupType === "prepaid"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                }`}
              >
                Prepaid Parcel
              </button>
              <button
                type="button"
                onClick={() => setPickupType("pay_and_collect")}
                className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                  pickupType === "pay_and_collect"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                }`}
              >
                Rider Pays Shop Bill
              </button>
            </div>

            {pickupType === "pay_and_collect" && (
              <div className="animate-in fade-in duration-200">
                <Label className="text-xs font-bold text-slate-500">Bill Amount to pay at Shop</Label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">₹</span>
                  <Input
                    type="number"
                    placeholder="Enter bill amount"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="pl-8 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-slate-400"
                  />
                </div>
                <div className="mt-2 flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100/50">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                    The rider will pay this amount in cash at the store, and collect it from you upon delivery.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Step 4: Delivery Address */}
        <Card className="p-4 border-none shadow-md ring-1 ring-slate-100 bg-white">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">4</span>
              Delivery Address
            </h2>
            {selectedAddressId && addresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddressList(!showAddressList)}
                className="text-xs text-brand-600 font-bold hover:underline"
              >
                {showAddressList ? "Cancel" : "Change Address"}
              </button>
            )}
          </div>

          {showAddressList ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 animate-in fade-in duration-200">
              <p className="text-[10px] text-slate-400 font-bold mb-2">SELECT AN ADDRESS</p>
              {allAddresses.map((addr) => (
                <div
                  key={addr._id}
                  onClick={() => {
                    setSelectedAddressId(addr._id);
                    setShowAddressList(false);
                  }}
                  className={`p-3 rounded-xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                    selectedAddressId === addr._id ? "border-slate-900 bg-slate-50" : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">
                      {addr.label?.toUpperCase()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold line-clamp-1">
                      {addr.fullAddress || [addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : selectedAddress ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border-2 border-slate-900 bg-slate-50 flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedAddress.label?.toUpperCase()}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {selectedAddress.fullAddress || [selectedAddress.landmark, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Navigation className="h-3 w-3 text-slate-500" />
                  Use Current Location
                </button>
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddressList(true)}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Change Address
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400 mb-2">No address selected</p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="py-2 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Navigation className="h-3 w-3 text-slate-500" />
                  Use Current Location
                </button>
                <Button size="sm" onClick={() => navigate("/addresses?add=1")} className="bg-slate-900 hover:bg-slate-800 rounded-xl text-xs">
                  Add Address
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Step 5: Billing & Payment mode */}
        {selectedShopId && selectedAddressId && (
          <Card className="p-4 border-none shadow-md ring-1 ring-slate-100 bg-white animate-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">5</span>
              Payment & Checkout Preview
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode("COD")}
                  className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    paymentMode === "COD"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  Pay on Delivery (COD)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("ONLINE")}
                  className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    paymentMode === "ONLINE"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  Online Payment
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Distance</span>
                  <span>{distance.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Delivery Fee</span>
                  <span>₹{deliveryFee}</span>
                </div>
                {pickupType === "pay_and_collect" && (
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Shop Bill (reimbursable)</span>
                    <span>₹{billAmtNum}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-2">
                  <span>Total Amount</span>
                  <span>₹{totalAmount}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Place Order Button */}
        <Button
          onClick={handleBook}
          disabled={submitting}
          className="w-full py-6 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl text-xs font-bold tracking-widest shadow-lg flex items-center justify-center gap-2"
        >
          {submitting ? "CONFIRMING BOOKING..." : "BOOK PARCEL DELIVERY"}
        </Button>
      </div>
    </div>
  );
};

export default PickupDelivery;
