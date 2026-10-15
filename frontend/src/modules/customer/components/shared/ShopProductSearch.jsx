import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useLocation as useAppLocation } from "../../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import ProductCard from "./ProductCard";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400";

const listOf = (res) => {
  const raw = res?.data?.result;
  return Array.isArray(res?.data?.results)
    ? res.data.results
    : Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw)
    ? raw
    : [];
};

/**
 * "Search a product -> see only the SHOPS that sell it -> pick a shop -> order."
 * Products are never shown mixed together: each result is a shop card with the
 * matching product(s) from that shop, an ADD button, and a button to open the
 * shop.
 */
const ShopProductSearch = ({ query }) => {
  const navigate = useNavigate();
  const { currentLocation } = useAppLocation();
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);

  const q = String(query || "").trim();

  useEffect(() => {
    if (!q) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const geo =
          Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : {};
        const [prodRes, sellerRes] = await Promise.all([
          customerApi.getProducts({ search: q, limit: 100, ...geo }),
          customerApi.getNearbySellers(geo),
        ]);
        let items = listOf(prodRes);
        let shopList = listOf(sellerRes);
        // Outside every delivery radius: still show where the product is sold.
        if (items.length === 0 && geo.lat !== undefined) {
          items = listOf(await customerApi.getProducts({ search: q, limit: 100 }));
        }
        if (shopList.length === 0 && geo.lat !== undefined) {
          shopList = listOf(await customerApi.getNearbySellers({}));
        }
        if (!cancelled) {
          setProducts(items);
          setSellers(shopList);
        }
      } catch (e) {
        console.error("Product search failed:", e);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, currentLocation?.latitude, currentLocation?.longitude]);

  // One entry per shop, holding only that shop's matching products.
  const shops = useMemo(() => {
    const byShop = new Map();
    products.forEach((p) => {
      const sid = String(p.sellerId?._id || p.sellerId || "");
      if (!sid) return;
      if (!byShop.has(sid)) {
        const s = sellers.find((x) => String(x._id || x.id) === sid) || {};
        byShop.set(sid, {
          id: sid,
          name: s.shopName || p.sellerId?.shopName || "Store",
          logo: s.shopLogo || s.storeFrontImage || "",
          rating: s.rating || "4.5",
          hours: s.storeTimings || "",
          isOpen: s.isOpen,
          closedMessage: s.closedMessage || "",
          distance: typeof s.distance === "number" ? s.distance : null,
          items: [],
        });
      }
      byShop.get(sid).items.push({
        ...p,
        id: p._id,
        image: p.mainImage || p.image || FALLBACK_IMG,
        price: p.salePrice || p.price,
        originalPrice: p.price,
        weight: p.weight || "1 unit",
        deliveryTime: "8-15 mins",
      });
    });
    return Array.from(byShop.values()).sort((a, b) => {
      const ao = a.isOpen === false ? 1 : 0;
      const bo = b.isOpen === false ? 1 : 0;
      if (ao !== bo) return ao - bo; // open shops first
      return (a.distance ?? 1e9) - (b.distance ?? 1e9);
    });
  }, [products, sellers]);

  if (!q) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-[12.5px] font-black text-[#1a6e2e] tracking-wide uppercase">
        {loading ? "Searching shops..." : `${shops.length} shop${shops.length === 1 ? "" : "s"} selling "${q}"`}
      </h3>

      {!loading && shops.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm font-black text-slate-800 mt-2">No shop has "{q}" right now</p>
          <p className="text-xs text-slate-500 mt-1">Check the spelling or try another product name.</p>
        </div>
      )}

      {shops.map((shop) => {
        const closed = shop.isOpen === false;
        return (
          <div key={shop.id} className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                  {shop.logo && (
                    <img src={applyCloudinaryTransform(shop.logo)} alt={shop.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[14px] font-black text-slate-900 truncate">{shop.name}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500 font-bold flex-wrap">
                    <span className="text-amber-500">{shop.rating} ★</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        closed ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {closed ? "Closed" : "Open"}
                    </span>
                    {shop.hours && <span>{shop.hours}</span>}
                    {shop.distance !== null && <span>· {shop.distance.toFixed(1)} km</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/shops/${shop.id}`)}
                className="shrink-0 flex items-center gap-0.5 rounded-full bg-[#1a6e2e] text-white text-[11px] font-black px-3 py-2 border-0 cursor-pointer active:scale-95"
              >
                Open shop <ChevronRight size={14} />
              </button>
            </div>

            {closed && (
              <p className="text-[11px] font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2">
                {shop.closedMessage || "This shop is closed right now."} You can order once it opens.
              </p>
            )}

            <div
              className={`grid grid-cols-3 gap-2.5 ${closed ? "pointer-events-none opacity-50 grayscale" : ""}`}
            >
              {shop.items.map((item) => (
                <ProductCard key={item.id} product={item} compact={true} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ShopProductSearch;
