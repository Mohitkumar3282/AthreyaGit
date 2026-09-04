import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { useCart } from "../context/CartContext";
import { useAuth } from "../../../core/context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  Gift,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Heart,
  Truck,
  Tag,
  Sparkles,
  Plus,
  Minus,
  Search,
  X,
  Clipboard,
  Check,
  Contact2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import LogoTransparent from "../../../assets/LogoTransparent.png";
import SlideToPay from "../components/shared/SlideToPay";
import { AddressAutocompleteField } from "@/shared/components/AddressAutocompleteField";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";
import { createSocketTokenReader } from "@core/utils/authStorage";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


// Sub-components
import CheckoutAddressSection from "./checkout/components/CheckoutAddressSection";

import CheckoutCartSummary from "./checkout/components/CheckoutCartSummary";
import CheckoutPricingBreakdown from "./checkout/components/CheckoutPricingBreakdown";
import CheckoutPaymentSelector from "./checkout/components/CheckoutPaymentSelector";
import CheckoutRupeeWalletSection from "./checkout/components/CheckoutRupeeWalletSection";
import CheckoutCouponSection from "./checkout/components/CheckoutCouponSection";
import CheckoutCoinsSection from "./checkout/components/CheckoutCoinsSection";
import CheckoutRecommendedProducts from "./checkout/components/CheckoutRecommendedProducts";
import CheckoutWishlistSection from "./checkout/components/CheckoutWishlistSection";
import CheckoutOrderSuccess from "./checkout/components/CheckoutOrderSuccess";
import CoinsPromoBanner from "../components/CoinsPromoBanner";

const CheckoutPage = () => {
  const {
    cart,
    addToCart,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { wishlist, addToWishlist, fetchFullWishlist, isFullDataFetched } =
    useWishlist();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const wishlistSectionRef = useRef(null);
  const wishlistFetchedRef = useRef(false);

  // useInViewAnimation for floating/particle animation containers
  const { ref: emptyCartAnimRef, isVisible: emptyCartVisible } = useInViewAnimation();

  // Lazy-load wishlist via IntersectionObserver
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("IntersectionObserver" in window)) {
      if (!wishlistFetchedRef.current) {
        wishlistFetchedRef.current = true;
        fetchFullWishlist();
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wishlistFetchedRef.current) {
          wishlistFetchedRef.current = true;
          fetchFullWishlist();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (wishlistSectionRef.current) observer.observe(wishlistSectionRef.current);
    return () => observer.disconnect();
  }, [isAuthenticated]);

  const appName = settings?.appName || "App";
  const {
    savedAddresses: locationSavedAddresses,
    currentLocation,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
  } = useAppLocation();
  const navigate = useNavigate();

  // State management
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("now");
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [selectedTip, setSelectedTip] = useState(0);
  const [showAllCartItems, setShowAllCartItems] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);
  // Canonical wallet balance. Read from the wallet endpoint rather than the
  // cached auth profile, so cashback credited by a just-delivered order is
  // spendable straight away.
  const [walletBalance, setWalletBalance] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  // Athreya Coins. `coinsToRedeem` is what the customer asked for; `coinsResult`
  // is what the server actually accepted after clamping (balance, minimum
  // redemption, and the per-order percentage cap), and is the only number the
  // UI renders as a discount.
  const [useCoins, setUseCoins] = useState(false);
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  const [coinsResult, setCoinsResult] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  // Coins this order will grant, shown on the success screen.
  const [coinsEarned, setCoinsEarned] = useState(0);
  // Wallet cashback this order will return on delivery.
  const [cashbackEarned, setCashbackEarned] = useState(0);
  // Savings this order realised, shown next to the coins earned.
  const [savingsTotal, setSavingsTotal] = useState(0);
  const postOrderNavigateRef = useRef(null);
  const previewDebounceRef = useRef(null);
  const [currentAddress, setCurrentAddress] = useState({
    type: "Home",
    name: "Harshvardhan Panchal",
    address: "81 Pipliyahana Road, Near 214",
    landmark: "",
    city: "Indore - 452018",
    phone: "6268423925",
  });
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState({
    type: "Home",
    name: "Harshvardhan Panchal",
    address: "81 Pipliyahana Road, Near 214",
    landmark: "",
    city: "Indore - 452018",
    phone: "6268423925",
  });
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientData, setRecipientData] = useState({
    completeAddress: "",
    landmark: "",
    pincode: "",
    name: "",
    phone: "",
  });
  const [savedRecipient, setSavedRecipient] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [emptyBoxData, setEmptyBoxData] = useState(null);

  // Dynamically load empty-box Lottie only when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      import("../../../assets/lottie/Empty box.json")
        .then((m) => setEmptyBoxData(m.default))
        .catch(() => { });
    }
  }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMethods = [
    ...(settings?.onlineEnabled === false
      ? []
      : [
        {
          id: "online",
          label: "Pay Online",
          icon: CreditCard,
          sublabel: "UPI / Cards / NetBanking",
        },
      ]),
    ...(settings?.codEnabled === false
      ? []
      : [
        {
          id: "cash",
          label: "Cash on Delivery",
          icon: Banknote,
          sublabel: "Pay after delivery",
        },
      ]),
  ];

  const tipAmounts = [
    { value: 0, label: "No Tip" },
    { value: 10, label: "Rs.10" },
    { value: 20, label: "Rs.20" },
    { value: 30, label: "Rs.30" },
  ];

  const discountAmount = selectedCoupon
    ? selectedCoupon.discountAmount || selectedCoupon.discount || 0
    : 0;

  const RECIPIENT_STORAGE_KEY = STORAGE_KEYS.RECIPIENT_ADDRESS;

  // Derived display values for primary delivery card
  const displayName = savedRecipient?.name || currentAddress.name;
  const displayPhone =
    savedRecipient?.phone || currentAddress.phone || "6268423925";
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : `${currentAddress.address}${currentAddress.landmark ? `, ${currentAddress.landmark}` : ""}, ${currentAddress.city}`;

  useEffect(() => {
    if (!paymentMethods.length) return;
    const exists = paymentMethods.some((method) => method.id === selectedPayment);
    if (!exists) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  // How much wallet balance to REQUEST. Clamped against the pre-redemption
  // bill (`grossTotal` + tip) rather than `grandTotal`, because `grandTotal`
  // shrinks once the redemption is applied — clamping against it would make
  // the request oscillate on every preview.
  const preRedemptionTotal =
    Number(pricingPreview?.grossTotal || pricingPreview?.grandTotal || 0) +
    Number(pricingPreview?.tipTotal || 0);

  useEffect(() => {
    if (useWallet && walletBalance > 0 && preRedemptionTotal > 0) {
      setWalletAmountToUse(Math.min(walletBalance, preRedemptionTotal));
    } else {
      setWalletAmountToUse(0);
    }
  }, [useWallet, walletBalance, preRedemptionTotal]);

  // The server is the single source of truth for what the customer owes:
  // `payableAmount` is already net of the wallet redemption it accepted (and
  // of any coins). We render that rather than doing the subtraction here, so
  // the figure on the pay button can never drift from what is charged.
  const walletApplied = Number(
    pricingPreview?.walletAmount ?? (useWallet ? walletAmountToUse : 0),
  );
  const finalAmountToPay = Math.max(
    0,
    Number(pricingPreview?.payableAmount ?? pricingPreview?.grandTotal ?? 0),
  );

  const coinSettings = coinsResult?.settings || {};
  const appliedCoins = coinsResult?.redeemed || 0;
  const appliedCoinsDiscount = coinsResult?.discount || 0;
  // Ceiling for this order: the percentage cap applies to the pre-coins total,
  // which is `grandTotal + discount already granted`.
  const coinsOrderBase =
    Number(pricingPreview?.grandTotal || 0) + Number(appliedCoinsDiscount || 0);
  const maxRedeemableCoins = useMemo(() => {
    const perCoin = Number(coinSettings.rupeeValuePerCoin || 1);
    const percent = Number(coinSettings.maxRedeemPercentOfOrder ?? 100);
    if (!coinBalance || coinsOrderBase <= 0 || perCoin <= 0) return 0;
    const capRupees = Math.min((coinsOrderBase * percent) / 100, coinsOrderBase);
    return Math.max(0, Math.min(coinBalance, Math.floor(capRupees / perCoin)));
  }, [coinBalance, coinsOrderBase, coinSettings.rupeeValuePerCoin, coinSettings.maxRedeemPercentOfOrder]);

  // Delivery promise for the currently selected address. Falls back to the
  // location context only until the first preview lands.
  const deliveryEtaLabel =
    pricingPreview?.deliveryEta?.label || currentLocation?.time || null;

  const buildAddressForOrder = () => {
    if (savedRecipient) {
      return {
        type: "Other",
        name: savedRecipient.name,
        address: savedRecipient.completeAddress,
        landmark: savedRecipient.landmark || "",
        city: savedRecipient.pincode ? `${savedRecipient.pincode}` : "",
        phone: savedRecipient.phone,
        location:
          currentLocation?.latitude && currentLocation?.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
      };
    }

    const addrLoc = currentAddress?.location;
    const hasAddrLoc =
      addrLoc &&
      typeof addrLoc.lat === "number" &&
      typeof addrLoc.lng === "number" &&
      Number.isFinite(addrLoc.lat) &&
      Number.isFinite(addrLoc.lng);

    return {
      ...currentAddress,
      location: hasAddrLoc ? { lat: addrLoc.lat, lng: addrLoc.lng } : undefined,
    };
  };

  const handleSaveRecipient = () => {
    if (
      !recipientData.completeAddress ||
      !recipientData.name ||
      recipientData.phone.length !== 10
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    setJSON(RECIPIENT_STORAGE_KEY, recipientData);
    showToast("Recipient details saved!", "success");
  };

  const handleMoveToWishlist = (item) => {
    addToWishlist(item);
    removeFromCart(item.id, item.variantSku);
    showToast(`${item.name} moved to wishlist`, "success");
  };

  const handleOpenEditAddress = () => {
    setEditAddressForm(currentAddress);
    setIsEditAddressOpen(true);
  };

  const isValidLatLng = (loc) =>
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const resolveAddressCoords = async (addressText) => {
    const q = String(addressText || "").trim();
    if (!q) return null;

    const cacheKey = `addr:${q}`;
    const cached = getCachedGeocode(cacheKey);
    if (cached?.location?.lat && cached?.location?.lng) {
      return cached.location;
    }

    try {
      const resp = await customerApi.geocodeAddress(q);
      const loc = resp.data?.result?.location;
      if (isValidLatLng(loc)) {
        setCachedGeocode(cacheKey, { location: { lat: loc.lat, lng: loc.lng } });
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch (e) {
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.message ||
        null;
      const err = new Error(serverMsg || "Could not geocode address");
      err.__serverMsg = serverMsg;
      throw err;
    }

    return null;
  };

  const handleSelectSavedAddress = async (addr) => {
    const rawText = addr?.address || "";
    const addrLoc = addr?.location;
    const hasLoc = isValidLatLng(addrLoc);
    const pid = typeof addr?.placeId === "string" ? addr.placeId.trim() : "";

    setIsResolvingAddressCoords(true);
    try {
      let resolvedLoc = null;
      try {
        if (hasLoc) {
          resolvedLoc = addrLoc;
        } else if (pid) {
          const cacheKey = `pid:${pid}`;
          const cached = getCachedGeocode(cacheKey);
          if (cached?.location?.lat && cached?.location?.lng) {
            resolvedLoc = cached.location;
          } else {
            const resp = await customerApi.geocodePlaceId(pid);
            const loc = resp.data?.result?.location;
            if (isValidLatLng(loc)) {
              resolvedLoc = { lat: loc.lat, lng: loc.lng };
              setCachedGeocode(cacheKey, { location: resolvedLoc });
            }
          }
        } else {
          resolvedLoc = await resolveAddressCoords(rawText);
        }
      } catch (e) {
        showToast(
          e?.__serverMsg ||
          e?.message ||
          "Could not fetch coordinates for this address. Delivery charges may not update.",
          "error",
        );
      }

      if (!resolvedLoc) {
        showToast(
          "Could not fetch coordinates for this address. Please edit the address or choose a different one.",
          "error",
        );
        return;
      }

      setCurrentAddress({
        type: addr.label,
        name: user?.name || currentAddress.name,
        address: rawText,
        city: "",
        phone: addr.phone || currentAddress.phone,
        landmark: "",
        ...(pid ? { placeId: pid } : {}),
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      });

      if (resolvedLoc) {
        updateLocation(
          {
            name: rawText,
            time: currentLocation?.time || "12-15 mins",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: resolvedLoc.lat,
            longitude: resolvedLoc.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }

      setIsAddressModalOpen(false);
    } finally {
      setIsResolvingAddressCoords(false);
    }
  };

  const handleSaveEditedAddress = async () => {
    if (
      !editAddressForm.name.trim() ||
      !editAddressForm.address.trim() ||
      !editAddressForm.city.trim()
    ) {
      showToast("Please fill name, address and city", "error");
      return;
    }

    let location = null;
    let placeId = null;
    let formattedAddress = null;
    try {
      const query = [
        editAddressForm.address,
        editAddressForm.landmark,
        editAddressForm.city,
      ]
        .filter(Boolean)
        .join(", ");
      const resp = await customerApi.geocodeAddress(query);
      const loc = resp.data?.result?.location;
      if (
        loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        location = { lat: loc.lat, lng: loc.lng };
        placeId = resp.data?.result?.placeId || null;
        formattedAddress = resp.data?.result?.formattedAddress || null;
        updateLocation(
          {
            name: resp.data?.result?.formattedAddress || query,
            time: currentLocation?.time || "12-15 mins",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: loc.lat,
            longitude: loc.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }
    } catch (e) {
      showToast(
        e.response?.data?.message ||
        "Could not fetch coordinates for this address. Delivery charges may be inaccurate.",
        "error",
      );
    }

    setCurrentAddress({
      ...editAddressForm,
      ...(location ? { location } : {}),
      ...(placeId ? { placeId } : {}),
      ...(formattedAddress ? { formattedAddress } : {}),
    });
    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");
  };

  const handleUseCurrentLiveLocation = async () => {
    const result = await refreshLocation();

    if (result?.ok && result.location) {
      const liveLocation = result.location;
      setCurrentAddress((prev) => ({
        ...prev,
        address: liveLocation.name,
        landmark: "",
        city: [liveLocation.city, liveLocation.state, liveLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof liveLocation.latitude === "number" &&
          typeof liveLocation.longitude === "number"
          ? { location: { lat: liveLocation.latitude, lng: liveLocation.longitude } }
          : {}),
      }));
      showToast("Using your current live location", "success");
      return;
    }

    if (currentLocation?.name) {
      setCurrentAddress((prev) => ({
        ...prev,
        address: currentLocation.name,
        landmark: "",
        city: [currentLocation.city, currentLocation.state, currentLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof currentLocation.latitude === "number" &&
          typeof currentLocation.longitude === "number"
          ? { location: { lat: currentLocation.latitude, lng: currentLocation.longitude } }
          : {}),
      }));
      showToast("Using your last detected location", "success");
      return;
    }

    showToast(result?.error || "Unable to detect current location", "error");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${appName} Checkout`,
          text: `Hey! I am ordering some goodies from ${appName}.`,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!", "success");
    }
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validateCoupon(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error",
      );
    }
  };

  const handleApplyManualCode = async () => {
    if (!manualCode.trim()) {
      showToast("Please enter a coupon code", "error");
      return;
    }
    try {
      const res = await customerApi.validateCoupon({
        code: manualCode.trim(),
        cartTotal,
        items: cart,
        customerId: user?._id,
      });
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          code: manualCode.trim(),
          description: "Applied manually",
          ...data,
        });
        showToast(`Coupon ${manualCode.trim()} applied!`, "success");
      } else {
        showToast(res.data.message || "Invalid coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Invalid coupon",
        "error",
      );
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.name} added to cart!`, "success");
  };

  const getCartItem = (productId) => cart.find((item) => item.id === productId);

  // Stable key for recommended products effect — only changes when product IDs change
  const cartProductIdKey = useMemo(
    () =>
      cart
        .map((i) => i.id || i._id)
        .sort()
        .join(","),
    [cart]
  );

  // Load recipient from localStorage + fetch coupons on mount
  useEffect(() => {
    const parsed = getJSON(RECIPIENT_STORAGE_KEY, null);
    if (parsed && parsed.completeAddress && parsed.name && parsed.phone) {
      setRecipientData(parsed);
      setSavedRecipient(parsed);
    }

    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActiveCoupons();
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];
          setCoupons(list);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, []);

  // Debounced checkoutPreview — fires 400 ms after last dependency change
  useEffect(() => {
    if (!isAuthenticated || cart.length === 0) {
      setPricingPreview(null);
      return;
    }

    const buildPreviewPayload = () => ({
      items: cart.map((item) => ({
        product: item.id || item._id,
        name: item.name,
        variantSku: String(item.variantSku || "").trim(),
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      address: buildAddressForOrder(),
      discountTotal: discountAmount,
      taxTotal: 0,
      tipAmount: selectedTip,
      paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
      timeSlot: selectedTimeSlot,
      coinsRedeem: useCoins ? coinsToRedeem : 0,
      // Send the wallet request so the server returns a `payableAmount`
      // already net of it — no client-side subtraction, no drift.
      walletAmount: useWallet ? walletAmountToUse : 0,
    });

    const fetchPreview = async () => {
      try {
        setIsPreviewLoading(true);
        const res = await customerApi.checkoutPreview(buildPreviewPayload());
        if (res.data?.success) {
          setPricingPreview(res.data.result?.breakdown ?? null);
          const coins = res.data.result?.coins ?? null;
          setCoinsResult(coins);
          if (coins && typeof coins.balance === "number") {
            setCoinBalance(Number(coins.balance));
          }
        }
      } catch (error) {
        console.error("Checkout preview failed", error);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(fetchPreview, 400);

    return () => clearTimeout(previewDebounceRef.current);
  }, [
    isAuthenticated,
    cart,
    selectedPayment,
    selectedTip,
    selectedTimeSlot,
    discountAmount,
    savedRecipient,
    currentAddress,
    currentLocation,
    useCoins,
    coinsToRedeem,
    useWallet,
    walletAmountToUse,
  ]);

  // Canonical wallet balance for this customer.
  useEffect(() => {
    if (!isAuthenticated) {
      setWalletBalance(0);
      return;
    }
    customerApi
      .getWallet()
      .then((res) => {
        if (!res.data?.success) return;
        setWalletBalance(Number(res.data.result?.balance || 0));
      })
      .catch(() => { });
  }, [isAuthenticated]);

  // Athreya Coins balance — fetched once so the checkout can show the wallet
  // even before the customer chooses to spend anything.
  useEffect(() => {
    if (!isAuthenticated) {
      setCoinBalance(0);
      return;
    }
    customerApi
      .getCoins()
      .then((res) => {
        if (!res.data?.success) return;
        const summary = res.data.result || {};
        setCoinBalance(Number(summary.balance || 0));
        setCoinsResult((prev) => prev || { settings: summary.settings, redeemed: 0, discount: 0 });
      })
      .catch(() => { });
  }, [isAuthenticated]);

  // Keep the requested redemption inside what this order can actually absorb —
  // e.g. after removing an item the previous request may now exceed the cap.
  // Ticking the box with nothing typed yet defaults to spending the maximum,
  // which is what a customer opting in almost always wants.
  useEffect(() => {
    if (!useCoins) return;
    if (maxRedeemableCoins <= 0) {
      setUseCoins(false);
      setCoinsToRedeem(0);
      return;
    }
    setCoinsToRedeem((current) => {
      if (current <= 0) return maxRedeemableCoins;
      return Math.min(current, maxRedeemableCoins);
    });
  }, [useCoins, maxRedeemableCoins]);

  // Recommended products — only re-fetches when the set of product IDs changes
  useEffect(() => {
    if (cart.length === 0) {
      setRecommendedProducts([]);
      return;
    }
    const categoryId = cart[0]?.categoryId?._id || cart[0]?.categoryId;
    if (!categoryId) return;

    const cartIds = new Set(cart.map((i) => i.id || i._id));
    const params = { categoryId, limit: 10 };
    if (currentLocation?.latitude && currentLocation?.longitude) {
      params.lat = currentLocation.latitude;
      params.lng = currentLocation.longitude;
    }
    customerApi
      .getProducts(params)
      .then((res) => {
        if (res.data?.success) {
          const items = (res.data.result?.items || [])
            .map((p) => ({ ...p, id: p._id }))
            .filter((p) => !cartIds.has(p.id));
          setRecommendedProducts(items.slice(0, 8));
        }
      })
      .catch(() => { });
  }, [cartProductIdKey, currentLocation?.latitude, currentLocation?.longitude]);

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      const taxAmount = pricingPreview?.taxTotal || 0;
      const orderData = {
        address: buildAddressForOrder(),
        paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
        discountTotal: discountAmount,
        taxTotal: taxAmount,
        tipAmount: selectedTip,
        timeSlot: selectedTimeSlot,
        walletAmount: walletAmountToUse,
        // Athreya Coins: send the request, not a computed discount. The server
        // re-clamps it against the live balance and the per-order cap.
        coinsRedeem: useCoins ? coinsToRedeem : 0,
        items: cart.map((item) => ({
          product: item.id || item._id,
          name: item.name,
          variantSku: String(item.variantSku || "").trim(),
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
      };

      const response = await customerApi.createOrder(orderData);

      if (response.data.success) {
        const result = response.data.result;
        const mainOrder =
          result.order ||
          (Array.isArray(result.orders) ? result.orders[0] : null);
        const mainOrderId = mainOrder?.orderId || result.orderId;
        const paymentRef =
          result.paymentRef || result.checkoutGroupId || mainOrderId;

        if (!mainOrderId) {
          setIsPlacingOrder(false);
          showToast(
            "Order placed but ID not received. Checking order history...",
            "warning"
          );
          navigate("/orders");
          return;
        }

        if (selectedPayment === "online") {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: paymentRef,
              orderId: mainOrderId,
            });
            if (paymentRes.data.success && paymentRes.data.result?.redirectUrl) {
              clearCart();
              window.location.href = paymentRes.data.result.redirectUrl;
              return;
            } else {
              throw new Error(
                paymentRes.data.message || "Failed to initiate payment gateway"
              );
            }
          } catch (payError) {
            setIsPlacingOrder(false);
            showToast(
              payError.message ||
              "Order created but payment gateway failed. Please pay from order details.",
              "error"
            );
            navigate(`/orders/${mainOrderId}`);
            return;
          }
        }

        // COD flow
        clearCart();
        showToast("Order placed — waiting for seller to accept.", "success");
        setOrderId(mainOrderId);
        setCoinsEarned(Number(mainOrder?.coins?.earned ?? pricingPreview?.coinsEarned ?? 0));
        setSavingsTotal(Number(pricingPreview?.savingsTotal ?? 0));
        setCashbackEarned(
          Number(mainOrder?.cashback?.amount ?? pricingPreview?.cashbackEarned ?? 0),
        );
        setShowSuccess(true);

        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
        }
        postOrderNavigateRef.current = setTimeout(() => {
          postOrderNavigateRef.current = null;
          setIsPlacingOrder(false);
          navigate(`/orders/${mainOrderId}`);
        }, 3000);
      } else {
        setIsPlacingOrder(false);
        showToast(response.data.message || "Could not place order.", "error");
      }
    } catch (error) {
      setIsPlacingOrder(false);
      showToast(
        error.response?.data?.message ||
        "Failed to place order. Please try again.",
        "error"
      );
    }
  };

  // After order placement: WebSocket listener + single fallback fetch
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    const applyCancelled = (order) => {
      if (order.workflowStatus === "CANCELLED" || order.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        setShowSuccess(false);
        showToast("Order cancelled — seller did not accept in time.", "error");
        navigate(`/orders/${orderId}`, { replace: true });
        return true;
      }
      return false;
    };

    // Single immediate check (covers WebSocket-unavailable case)
    customerApi
      .getOrderDetails(orderId)
      .then((r) => {
        if (r.data?.result) applyCancelled(r.data.result);
      })
      .catch(() => { });

    const off = onOrderStatusUpdate(getToken, (order) => applyCancelled(order));

    return () => {
      off();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess]);

  // ─── Empty cart state ────────────────────────────────────────────────────────
  if (cart.length === 0 && !showSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto">
          <div ref={emptyCartAnimRef} className="relative w-56 h-56 md:w-64 md:h-64 mb-8 flex items-center justify-center">
            <motion.div
              animate={emptyCartVisible ? { y: [-8, 8, -8] } : { y: 0 }}
              transition={emptyCartVisible ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              className="relative z-10 rounded-[2rem] bg-white/90 p-6  border border-[#1a6e2e]/20">
              {emptyBoxData ? (
                <Lottie animationData={emptyBoxData} loop className="h-36 w-36 md:h-44 md:w-44" />
              ) : (
                <div className="w-56 h-56" />
              )}
            </motion.div>
            <motion.div
              animate={emptyCartVisible ? { rotate: 360 } : { rotate: 0 }}
              transition={emptyCartVisible ? { duration: 20, repeat: Infinity, ease: "linear" } : { duration: 0 }}
              className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-full"
            />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Your Cart is Empty</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">
            It feels lighter than air! <br />
            Explore our aisles and fill it with goodies.
          </p>
          <Link
            to="/"
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-[#1a6e2e] text-white font-bold rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto border border-transparent">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2 text-lg">
              Start Shopping <ChevronRight size={20} />
            </span>
          </Link>
          <div className="mt-8 flex gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Clock size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fast Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Tag size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Daily Deals</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Sparkles size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fresh Items</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main checkout return ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white pb-32 font-sans">
      {/* Order Success Overlay */}
      <CheckoutOrderSuccess
        orderId={orderId}
        show={showSuccess}
        coinsEarned={coinsEarned}
        cashbackEarned={cashbackEarned}
        savingsTotal={savingsTotal}
        coinValue={coinSettings.rupeeValuePerCoin}
      />

      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go Back"
            className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0d4d29] flex items-center justify-center hover:bg-emerald-100 active:scale-95 transition-all shrink-0">
            <ChevronLeft size={24} />
          </button>

          <div className="flex flex-col items-center cursor-pointer" onClick={() => navigate("/")}>
            <div className="flex items-center gap-1.5">
              <img
                src={settings?.logoUrl || LogoTransparent}
                alt="Athreya Delivery"
                className="h-8 md:h-9 w-auto object-contain"
                style={{ filter: "url(#logo-yellow-watch-green-rider)" }}
              />
              <div className="flex flex-col items-start leading-none font-sans">
                <span className="text-xs md:text-sm font-[1000] text-[#0d4d29] tracking-wide uppercase">ATHREYA</span>
                <span className="text-[8px] md:text-[9px] font-bold text-[#0d4d29] tracking-[0.12em] uppercase">DELIVERY</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-sm md:text-base font-[1000] text-slate-800 uppercase tracking-wide">Checkout</h1>
              <span className="text-[10px] font-bold text-[#0d4d29] bg-[#edf8f0] px-2 py-0.5 rounded-full border border-emerald-200">
                {cartCount} {cartCount === 1 ? "Item" : "Items"}
              </span>
            </div>
          </div>

          <button
            onClick={handleShare}
            aria-label="Share"
            className="h-10 px-3 md:px-4 rounded-2xl bg-emerald-50 text-[#0d4d29] flex items-center gap-1.5 hover:bg-emerald-100 active:scale-95 transition-all shrink-0">
            <Share2 size={18} />
            <span className="text-xs font-[1000] uppercase tracking-wider hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* Main Checkout Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 pb-20 lg:pb-8 font-sans">
        {/* Promotional Earn Coins & Save Money Banner */}
        <CoinsPromoBanner variant="compact" />

        <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-4 lg:space-y-0">

          {/* Left Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Delivery Time Banner */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 border border-emerald-100 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-[#0d4d29] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Clock size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-[1000] text-slate-900 leading-tight">
                    {isPreviewLoading && !deliveryEtaLabel
                      ? "Estimating delivery time…"
                      : deliveryEtaLabel
                        ? `Arriving in ${deliveryEtaLabel}`
                        : "Delivery time will update once you pick an address"}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Shipment of {cartCount} {cartCount === 1 ? "item" : "items"}
                    {pricingPreview?.deliveryEta?.distanceKm > 0 && (
                      <> · {pricingPreview.deliveryEta.distanceKm.toFixed(1)} km away</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Address Section */}
            <CheckoutAddressSection
              currentAddress={currentAddress}
              savedRecipient={savedRecipient}
              savedAddresses={locationSavedAddresses}
              onSelectAddress={() => setIsAddressModalOpen(true)}
              onEditAddress={handleOpenEditAddress}
              onUseCurrentLocation={handleUseCurrentLiveLocation}
              isFetchingLocation={isFetchingLocation}
              showRecipientForm={showRecipientForm}
              onToggleRecipientForm={() => setShowRecipientForm((v) => !v)}
              recipientData={recipientData}
              onRecipientDataChange={setRecipientData}
              onSaveRecipient={handleSaveRecipient}
              onRemoveRecipient={() => setSavedRecipient(null)}
              displayName={displayName}
              displayPhone={displayPhone}
              displayAddress={displayAddress}
            />

            {/* Cart Summary */}
            <CheckoutCartSummary
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              onMoveToWishlist={handleMoveToWishlist}
              showAll={showAllCartItems}
              onToggleShowAll={() => setShowAllCartItems((v) => !v)}
            />

            {/* Wishlist Section */}
            <CheckoutWishlistSection
              wishlist={wishlist}
              sectionRef={wishlistSectionRef}
            />

            {/* Recommended Products */}
            <CheckoutRecommendedProducts
              products={recommendedProducts}
              cart={cart}
              onAddToCart={handleAddToCart}
              onGetCartItem={getCartItem}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
            {/* Coupon Section */}
            <CheckoutCouponSection
              coupons={coupons}
              selectedCoupon={selectedCoupon}
              manualCode={manualCode}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={() => setSelectedCoupon(null)}
              onManualCodeChange={setManualCode}
              isOpen={isCouponModalOpen}
              onOpenChange={setIsCouponModalOpen}
              onApplyManualCode={handleApplyManualCode}
            />

            {/* Rupee Wallet (Cashback & Refunds) */}
            <CheckoutRupeeWalletSection
              walletBalance={walletBalance}
              useWallet={useWallet}
              onToggleWallet={() => setUseWallet((v) => !v)}
              walletAmountToUse={walletApplied}
            />

            {/* Athreya Coins */}
            <CheckoutCoinsSection
              balance={coinBalance}
              settings={coinSettings}
              maxRedeemable={maxRedeemableCoins}
              coinsToRedeem={coinsToRedeem}
              onChangeCoins={setCoinsToRedeem}
              isApplied={useCoins}
              onToggle={() => setUseCoins((value) => !value)}
              appliedCoins={appliedCoins}
              appliedDiscount={appliedCoinsDiscount}
              payableAfter={finalAmountToPay}
              cappedBy={coinsResult?.cappedBy}
            />

            {/* Pricing Breakdown */}
            <CheckoutPricingBreakdown
              pricingPreview={pricingPreview}
              isPreviewLoading={isPreviewLoading}
              selectedTip={selectedTip}
              onSelectTip={setSelectedTip}
              tipAmounts={tipAmounts}
              walletAmountToUse={walletApplied}
              cashback={pricingPreview?.cashbackEarned || 0}
              coinsDiscount={appliedCoinsDiscount}
              coinsRedeemed={appliedCoins}
              finalAmountToPay={finalAmountToPay}
              cartTotal={cartTotal}
              selectedCoupon={selectedCoupon}
              discountAmount={discountAmount}
            />

            {/* Payment Selector */}
            <CheckoutPaymentSelector
              paymentMethods={paymentMethods}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
            />

            {/* Desktop Slide to Pay */}
            <div className="hidden lg:block pt-1">
              <SlideToPay
                amount={finalAmountToPay}
                onSuccess={handlePlaceOrder}
                isLoading={isPlacingOrder || isPreviewLoading || !pricingPreview}
                text={finalAmountToPay === 0 ? "Place Free Order" : "Order Now"}
              />
              <p className="text-center text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-[0.1em]">
                🔒 SSL encrypted secure checkout
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Explainer Banner */}
        <CoinsPromoBanner variant="footer" className="mt-4" />
      </main>

      {/* Sticky Footer — Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 p-2.5 sm:p-3 z-50 shadow-2xl">
        <div className="max-w-md mx-auto">
          <SlideToPay
            amount={finalAmountToPay}
            onSuccess={handlePlaceOrder}
            isLoading={isPlacingOrder || isPreviewLoading || !pricingPreview}
            text={finalAmountToPay === 0 ? "Place Free Order" : "Slide to Order"}
          />
        </div>
      </div>

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>Choose where you want your order delivered.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {locationSavedAddresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => handleSelectSavedAddress(addr)}
                disabled={isResolvingAddressCoords}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${currentAddress.id === addr.id
                  ? "border-primary bg-[#1a6e2e]/10 border border-[#1a6e2e]/20"
                  : "border-slate-100 bg-white hover:border-slate-200"
                  }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full ${currentAddress.id === addr.id ? "bg-[#1a6e2e] text-[#1a6e2e]-foreground" : "bg-slate-100 text-slate-500"}`}>
                    <MapPin size={16} />
                  </div>
                  <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">{addr.label}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{user?.name || currentAddress.name}</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-1">{addr.address}</p>
                {addr.phone && (
                  <p className="text-[11px] text-slate-400 font-medium">Phone: {addr.phone}</p>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full border-[#1a6e2e]/20 text-[#1a6e2e] hover:bg-[#1a6e2e]/10"
              onClick={() => navigate("/addresses")}>
              <Plus size={16} className="mr-2" /> Add New Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Current Address Modal */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="sm:max-w-[425px] overflow-hidden p-0">
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="p-6">
            <DialogHeader>
              <DialogTitle>Edit Delivery Address</DialogTitle>
              <DialogDescription>Update the details of your current delivery address.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-address" className="text-xs font-semibold text-slate-700">Address</Label>
                <AddressAutocompleteField
                  id="edit-address"
                  value={editAddressForm.address}
                  onChange={(val) => setEditAddressForm((prev) => ({ ...prev, address: val }))}
                  onSelect={(details) => {
                    setEditAddressForm((prev) => ({
                      ...prev,
                      address: details.address,
                      city: [details.city, details.state, details.pincode].filter(Boolean).join(", ") || prev.city,
                      location: { lat: details.lat, lng: details.lng },
                      placeId: details.placeId,
                      formattedAddress: details.address,
                    }));
                  }}
                  className="h-10"
                  placeholder="House, street, area"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-landmark" className="text-xs font-semibold text-slate-700">Nearest Landmark (optional)</Label>
                <Input
                  id="edit-landmark"
                  value={editAddressForm.landmark || ""}
                  onChange={(e) => setEditAddressForm((prev) => ({ ...prev, landmark: e.target.value }))}
                  className="h-10"
                  placeholder="e.g. Near City Mall, Opp. Temple"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-city" className="text-xs font-semibold text-slate-700">City / Pincode</Label>
                <Input
                  id="edit-city"
                  value={editAddressForm.city}
                  onChange={(e) => setEditAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="h-10"
                  placeholder="City - Pincode"
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditAddressOpen(false)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditedAddress}
                className="bg-[#1a6e2e] hover:bg-[#0b721b] text-white font-bold">
                Save changes
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
        }}
      />
    </div>
  );
};

export default CheckoutPage;
