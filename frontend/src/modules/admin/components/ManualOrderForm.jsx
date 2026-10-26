import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
import MapPicker from '@shared/components/MapPicker';
import { Search, MapPin, X, Zap, Bike, Store, User } from 'lucide-react';

/**
 * Create WhatsApp Order - form body.
 *  - Customer and shop are searched by name / phone (server-side, not a 100-row dropdown)
 *  - Delivery charge is calculated automatically from the real road distance
 *  - Riders are suggested nearest-first, with a one-click "Auto-assign best rider"
 */

const labelCls = 'block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5';
const inputCls =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20';

const unwrap = (res) => res?.data?.result ?? res?.data?.results ?? [];

/** Search box + result list. `fetcher(q)` returns an array; `render(item)` draws a row. */
const SearchPick = ({ placeholder, fetcher, value, onPick, onClear, render, icon: Icon }) => {
    const [q, setQ] = useState('');
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const seq = useRef(0);

    useEffect(() => {
        if (value || !open) return undefined;
        const id = ++seq.current;
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const list = await fetcher(q.trim());
                if (id === seq.current) setItems(Array.isArray(list) ? list : []);
            } catch {
                if (id === seq.current) setItems([]);
            } finally {
                if (id === seq.current) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, open, value]);

    if (value) {
        return (
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-emerald-700 shrink-0" />
                    <div className="min-w-0 text-xs font-bold text-slate-800 truncate">{render(value)}</div>
                </div>
                <button type="button" onClick={onClear} className="p-1 rounded-lg hover:bg-emerald-100" aria-label="Change">
                    <X className="h-4 w-4 text-slate-500" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
                type="text"
                value={q}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(true);
                }}
                className={`${inputCls} pl-10`}
            />
            {open && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                    {loading && <p className="px-4 py-3 text-xs font-bold text-slate-400">Searching...</p>}
                    {!loading && items.length === 0 && (
                        <p className="px-4 py-3 text-xs font-bold text-slate-400">No match found</p>
                    )}
                    {items.map((it) => (
                        <button
                            key={it.id}
                            type="button"
                            onClick={() => {
                                onPick(it);
                                setOpen(false);
                                setQ('');
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0 text-xs font-bold text-slate-800"
                        >
                            {render(it)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ManualOrderForm = ({ onCreated, onCancel, showToast }) => {
    const [customer, setCustomer] = useState(null);
    const [seller, setSeller] = useState(null);
    const [addrChoice, setAddrChoice] = useState(0); // saved address index, or 'map'
    const [mapAddress, setMapAddress] = useState(null); // { address, location }
    const [mapOpen, setMapOpen] = useState(false);
    const [totalAmount, setTotalAmount] = useState('');
    const [feeOverride, setFeeOverride] = useState('');
    const [paymentMode, setPaymentMode] = useState('COD');
    const [notes, setNotes] = useState('');
    const [quote, setQuote] = useState(null);
    const [quoting, setQuoting] = useState(false);
    const [riders, setRiders] = useState([]);
    const [riderChoice, setRiderChoice] = useState('later'); // later | auto | <id>
    const [submitting, setSubmitting] = useState(false);

    const fetchCustomers = useCallback(
        async (q) => unwrap(await adminApi.lookupManualOrder({ type: 'customer', q })),
        [],
    );
    const fetchSellers = useCallback(
        async (q) => unwrap(await adminApi.lookupManualOrder({ type: 'seller', q })),
        [],
    );

    const addresses = customer?.addresses || [];
    useEffect(() => {
        setAddrChoice(addresses.length > 0 ? 0 : 'map');
        setMapAddress(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer?.id]);

    // Automatic delivery charge from the real distance shop -> customer.
    useEffect(() => {
        if (!customer || !seller) {
            setQuote(null);
            return undefined;
        }
        const body = { customerId: customer.id, sellerId: seller.id };
        if (addrChoice === 'map') {
            if (!mapAddress) {
                setQuote(null);
                return undefined;
            }
            body.address = mapAddress;
        } else {
            body.addressIndex = addrChoice;
        }
        let cancelled = false;
        setQuoting(true);
        const t = setTimeout(async () => {
            try {
                const res = await adminApi.quoteManualOrder(body);
                if (!cancelled) setQuote(res.data?.result || null);
            } catch {
                if (!cancelled) setQuote(null);
            } finally {
                if (!cancelled) setQuoting(false);
            }
        }, 200);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [customer, seller, addrChoice, mapAddress]);

    // Riders nearest to the shop, least busy first.
    useEffect(() => {
        if (!seller) {
            setRiders([]);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await adminApi.getManualRiderSuggestions({
                    sellerId: seller.id,
                    cod: paymentMode === 'COD' ? Number(totalAmount || 0) : 0,
                });
                if (!cancelled) setRiders(unwrap(res));
            } catch {
                if (!cancelled) setRiders([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [seller, paymentMode, totalAmount]);

    const autoFee = quote?.deliveryFee ?? 0;
    const finalFee = feeOverride !== '' ? Number(feeOverride) : autoFee;
    const subtotal = Number(totalAmount || 0);

    const submit = async (e) => {
        e.preventDefault();
        if (!customer) return showToast('Search and select a customer', 'warning');
        if (!seller) return showToast('Search and select a shop', 'warning');
        if (addrChoice === 'map' && !mapAddress) return showToast('Choose the delivery location on the map', 'warning');
        setSubmitting(true);
        try {
            const res = await adminApi.createManualOrder({
                customerId: customer.id,
                sellerId: seller.id,
                deliveryBoyId: riderChoice === 'later' ? undefined : riderChoice,
                ...(addrChoice === 'map' ? { address: mapAddress } : { addressIndex: addrChoice }),
                totalAmount: subtotal,
                deliveryFee: feeOverride !== '' ? Number(feeOverride) : undefined,
                paymentMode,
                notes: notes || 'WhatsApp Order',
            });
            if (res.data?.success || res.status === 201) {
                const auto = res.data?.result?.autoAssignedRider;
                const who = auto ? riders.find((r) => r.id === auto)?.name : null;
                showToast(
                    riderChoice === 'auto'
                        ? who
                            ? `Order created and assigned to ${who}`
                            : 'Order created. No rider was free, it will be broadcast.'
                        : 'WhatsApp Order created successfully!',
                    'success',
                );
                onCreated();
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to create order', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <form onSubmit={submit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Customer */}
            <div>
                <label className={labelCls}>Customer <span className="text-red-500">*</span></label>
                <SearchPick
                    icon={User}
                    placeholder="Search customer by name or phone..."
                    fetcher={fetchCustomers}
                    value={customer}
                    onPick={setCustomer}
                    onClear={() => setCustomer(null)}
                    render={(c) => `${c.name} (${c.phone || 'no phone'})`}
                />
            </div>

            {/* Delivery location */}
            {customer && (
                <div>
                    <label className={labelCls}>Delivery location</label>
                    <div className="space-y-2">
                        {addresses.map((a) => (
                            <label
                                key={a.index}
                                className={`flex items-start gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer text-xs font-bold ${
                                    addrChoice === a.index ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                                }`}
                            >
                                <input type="radio" checked={addrChoice === a.index} onChange={() => setAddrChoice(a.index)} className="mt-0.5" />
                                <span className="min-w-0">
                                    <span className="block text-slate-800 truncate">{a.label.toUpperCase()}: {a.address}</span>
                                    {!a.location && <span className="text-[10px] text-amber-600">No map point: distance charge not exact</span>}
                                </span>
                            </label>
                        ))}
                        <div
                            className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold ${
                                addrChoice === 'map' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                            <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                                <input type="radio" checked={addrChoice === 'map'} onChange={() => setAddrChoice('map')} />
                                <span className="truncate text-slate-800">
                                    {mapAddress ? mapAddress.address : 'Search / choose on map (Google)'}
                                </span>
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setAddrChoice('map');
                                    setMapOpen(true);
                                }}
                                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black"
                            >
                                <MapPin className="h-3.5 w-3.5" /> {mapAddress ? 'Change' : 'Open map'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shop */}
            <div>
                <label className={labelCls}>Seller / Shop <span className="text-red-500">*</span></label>
                <SearchPick
                    icon={Store}
                    placeholder="Search shop by name, area or phone..."
                    fetcher={fetchSellers}
                    value={seller}
                    onPick={setSeller}
                    onClear={() => setSeller(null)}
                    render={(s) => `${s.shopName} (${s.locality || s.phone || 'Local'})${s.isOpen ? '' : ' - CLOSED'}`}
                />
            </div>

            {/* Amount + automatic delivery charge */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Item subtotal (₹) <span className="text-red-500">*</span></label>
                    <input type="number" required placeholder="e.g. 450" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Delivery charge (₹)</label>
                    <input
                        type="number"
                        placeholder={quote ? `Auto: ₹${autoFee}` : 'Auto'}
                        value={feeOverride}
                        onChange={(e) => setFeeOverride(e.target.value)}
                        className={inputCls}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs font-bold text-slate-700 space-y-1">
                {!customer || !seller ? (
                    <p className="text-slate-500">Select a customer and a shop to see the delivery charge.</p>
                ) : quoting ? (
                    <p className="text-slate-500">Calculating distance...</p>
                ) : quote ? (
                    <>
                        <div className="flex justify-between">
                            <span>Distance {quote.distanceSource === 'road' ? '(by road)' : '(approx.)'}</span>
                            <span>{quote.hasLocation ? `${quote.distanceKm} km` : 'unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Delivery charge {feeOverride !== '' ? '(manual)' : '(automatic)'}</span>
                            <span>₹{finalFee}</span>
                        </div>
                        {quote.riderEarns != null && (
                            <div className="flex justify-between text-slate-500">
                                <span>Rider earns</span>
                                <span>₹{quote.riderEarns}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-emerald-800 pt-1 border-t border-emerald-200">
                            <span>Customer pays</span>
                            <span>₹{subtotal + finalFee}</span>
                        </div>
                        {quote.message && <p className="text-[11px] text-amber-700">{quote.message}</p>}
                    </>
                ) : (
                    <p className="text-slate-500">Choose the delivery location to calculate the charge.</p>
                )}
            </div>

            {/* Payment */}
            <div>
                <label className={labelCls}>Payment mode</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inputCls}>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="ONLINE">Paid Online / UPI</option>
                </select>
            </div>

            {/* Smart rider assignment */}
            <div>
                <label className={labelCls}>Assign rider</label>
                {!seller ? (
                    <p className="text-xs font-bold text-slate-400">Select a shop to see the nearest riders.</p>
                ) : (
                    <div className="space-y-2">
                        <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer text-xs font-black ${riderChoice === 'auto' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                            <input type="radio" checked={riderChoice === 'auto'} onChange={() => setRiderChoice('auto')} />
                            <Zap className="h-4 w-4 text-amber-500" />
                            Auto-assign the best rider (nearest, least busy)
                        </label>
                        <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer text-xs font-bold ${riderChoice === 'later' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                            <input type="radio" checked={riderChoice === 'later'} onChange={() => setRiderChoice('later')} />
                            Assign later / broadcast to nearby riders
                        </label>
                        {riders.length === 0 && <p className="text-[11px] font-bold text-amber-700 px-1">No rider is online right now.</p>}
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {riders.map((r) => (
                                <label
                                    key={r.id}
                                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer text-xs font-bold ${riderChoice === r.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'} ${r.cashLimitReached ? 'opacity-60' : ''}`}
                                >
                                    <input type="radio" checked={riderChoice === r.id} onChange={() => setRiderChoice(r.id)} />
                                    <Bike className="h-4 w-4 text-slate-500 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-slate-900 truncate">
                                            {r.name} {r.recommended && <span className="ml-1 text-[10px] bg-emerald-600 text-white rounded-full px-1.5 py-0.5">BEST</span>}
                                        </span>
                                        <span className="block text-[10px] text-slate-500">
                                            {r.distanceKm != null ? `${r.distanceKm} km from shop` : 'location unknown'} · {r.activeOrders} running order{r.activeOrders === 1 ? '' : 's'}
                                            {r.cashLimitReached ? ' · cash limit reached' : ''}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className={labelCls}>Order notes / items list</label>
                <textarea rows="2" placeholder="e.g. 1kg Mutton, 2 Packets Milk" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
            </div>

            <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                >
                    {submitting && <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {riderChoice === 'auto' ? 'CREATE & AUTO-ASSIGN' : riderChoice === 'later' ? 'CREATE ORDER' : 'CREATE & ASSIGN ORDER'}
                </button>
            </div>

        </form>
        <MapPicker
            isOpen={mapOpen}
            onClose={() => setMapOpen(false)}
            mode="point"
            title="Customer delivery location"
            searchPlaceholder="Search the customer's address..."
            confirmLabel="Use This Location"
            onConfirm={(r) => {
                setMapAddress({ address: r.address, city: r.city, location: { lat: r.lat, lng: r.lng } });
                setAddrChoice('map');
            }}
        />
        </>
    );
};

export default ManualOrderForm;
