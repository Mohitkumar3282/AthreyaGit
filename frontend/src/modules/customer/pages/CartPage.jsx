import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import { useCart } from '../context/CartContext';
import {
    Minus,
    Plus,
    Trash2,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@shared/components/ui/Toast';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import CoinsPromoBanner from '../components/CoinsPromoBanner';
import piggyBankImg from '@/assets/coins/piggy_bank.jpg';

const CartPage = () => {
    const { cart, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
    const { showToast } = useToast();
    const itemCount = cart.reduce((count, item) => count + (Number(item.quantity) || 1), 0);
    const [emptyBoxData, setEmptyBoxData] = useState(null);

    // Dynamically load empty-box Lottie when cart is empty
    useEffect(() => {
        if (cart.length === 0) {
            import('../../../assets/lottie/Empty box.json')
                .then((m) => setEmptyBoxData(m.default))
                .catch(() => {});
        }
    }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRemove = (id, name, variantSku = "") => {
        removeFromCart(id, variantSku);
        showToast(`${name} removed from cart`, 'info');
    };

    const totalCartSavings = cart.reduce((acc, item) => {
        const mrp = Number(item.price || item.mrp || 0);
        const sale = Number(item.salePrice || item.price || 0);
        const unitSaving = Math.max(0, mrp - sale);
        return acc + unitSaving * (Number(item.quantity) || 1);
    }, 0);

    return (
        <div className="relative isolate w-full overflow-hidden bg-[#f9fafb] animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-screen">
            <div className="relative mx-auto w-full max-w-[1440px] px-4 md:px-8 lg:px-12 py-6 md:py-8 space-y-6">
                {/* Promotional Coins & Savings Banner matching Reference Image */}
                {cart.length > 0 && (
                    <CoinsPromoBanner variant="full" />
                )}

                {cart.length > 0 ? (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] items-start">
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-lg md:text-xl font-[1000] text-slate-900 tracking-tight uppercase">
                                    Your Cart Items
                                </h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0d4d29] border border-emerald-200 shadow-2xs">
                                    {itemCount} total items
                                </span>
                            </div>

                            <div className="space-y-3">
                                {cart.map((item) => {
                                    const qty = Math.max(1, Number(item.quantity || 1));
                                    const rawMrp = Number(item.price || item.mrp || 0);
                                    const rawSale = Number(item.salePrice || item.price || 0);
                                    const unitMrp = rawMrp > 0 ? rawMrp : rawSale;
                                    const unitPrice = (rawSale > 0 && rawSale < unitMrp) ? rawSale : unitMrp;
                                    const unitSaving = Math.max(0, unitMrp - unitPrice);
                                    const totalMrp = (unitMrp * qty).toFixed(2);
                                    const totalPrice = (unitPrice * qty).toFixed(2);
                                    const totalSaving = (unitSaving * qty).toFixed(2);

                                    return (
                                        <article
                                            key={`${item.id}::${String(item.variantSku || "").trim()}`}
                                            className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 md:p-5 shadow-xs transition-all hover:border-emerald-200"
                                        >
                                            <div className="flex gap-4 items-center">
                                                <div className="h-20 w-20 md:h-24 md:w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-50 border border-slate-100">
                                                    <img
                                                        src={applyCloudinaryTransform(item.image)}
                                                        alt={item.name}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0d4d29]">
                                                                {item.category || "Grocery"}
                                                            </span>
                                                            <h3 className="mt-1 truncate text-base md:text-lg font-[1000] tracking-tight text-slate-900">
                                                                {item.name}
                                                            </h3>
                                                            {item.unit && (
                                                                <p className="text-xs font-semibold text-slate-400">
                                                                    {item.unit}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={() => handleRemove(item.id, item.name, item.variantSku)}
                                                            className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:border-rose-200 hover:text-rose-500"
                                                            aria-label={`Remove ${item.name}`}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-[1000] text-slate-900">
                                                                ₹{totalPrice}
                                                            </span>
                                                            {unitSaving > 0 && (
                                                                <span className="text-xs font-semibold text-slate-400 line-through">
                                                                    ₹{totalMrp}
                                                                </span>
                                                            )}
                                                            {unitSaving > 0 && (
                                                                <span className="text-xs font-bold text-[#0d4d29] bg-emerald-50 px-2 py-0.5 rounded">
                                                                    Save ₹{totalSaving}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, -1, item.variantSku)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-rose-600 transition-colors disabled:opacity-30"
                                                                disabled={item.quantity <= 1}
                                                            >
                                                                <Minus size={14} strokeWidth={3} />
                                                            </button>
                                                            <span className="min-w-[20px] text-center text-sm font-black text-slate-900">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, 1, item.variantSku)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-[#0d4d29] transition-colors"
                                                            >
                                                                <Plus size={14} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
                                <Link
                                    to="/categories"
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-black uppercase text-slate-800 transition-colors"
                                >
                                    Continue Shopping
                                    <ArrowRight size={14} />
                                </Link>
                                <button
                                    onClick={clearCart}
                                    className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    Clear Cart
                                </button>
                            </div>
                        </section>

                        {/* Order Summary Sidebar */}
                        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
                            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white p-5 md:p-6 shadow-sm space-y-4">
                                <div className="border-b border-slate-100 pb-3">
                                    <h3 className="text-base font-[1000] tracking-tight text-slate-900 uppercase">
                                        ORDER SUMMARY
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Review pricing before checkout
                                    </p>
                                </div>

                                <div className="space-y-2.5 text-xs md:text-sm">
                                    <div className="flex justify-between text-slate-600 font-semibold">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-slate-900">₹{Number(cartTotal).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 font-semibold">
                                        <span>Delivery Fee</span>
                                        <span className="font-[1000] text-[#0d4d29]">FREE</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                                        <span className="text-base font-[1000] text-slate-900 uppercase">Total Paid</span>
                                        <span className="text-2xl font-[1000] tracking-tight text-slate-900">₹{Number(cartTotal).toFixed(2)}</span>
                                    </div>
                                </div>

                                <Link to="/checkout" className="block pt-2">
                                    <Button className="h-14 w-full rounded-2xl bg-[#0d4d29] hover:bg-[#0a3f22] text-white text-sm font-[1000] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-98">
                                        Proceed to Checkout <ArrowRight size={18} />
                                    </Button>
                                </Link>

                                <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 pt-1">
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 flex items-center gap-1.5">
                                        <Truck size={14} className="text-[#0d4d29]" />
                                        Fast Delivery
                                    </div>
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-[#0d4d29]" />
                                        Safe & Secure
                                    </div>
                                </div>
                            </div>

                            {/* SAVED MONEY ON THIS ORDER Card */}
                            {totalCartSavings > 0 && (
                                <div className="rounded-3xl bg-[#fefce8] border-2 border-[#fef08a] p-4 flex items-center justify-between gap-3 shadow-xs">
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="inline-flex items-center gap-1 bg-[#fde047]/70 px-2 py-0.5 rounded-full text-[9px] font-[1000] text-amber-900 uppercase">
                                            <span>✓</span> SAVED ON THIS ORDER
                                        </div>
                                        <div className="text-2xl font-[1000] text-[#0d592e]">
                                            ₹{totalCartSavings.toFixed(2)}
                                        </div>
                                        <p className="text-[11px] font-bold text-amber-900">
                                            You will earn {Math.floor(totalCartSavings)} Athreya Coins!
                                        </p>
                                    </div>
                                    <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-white/70 p-1 border border-amber-200">
                                        <img
                                            src={piggyBankImg}
                                            alt="Piggy Bank Savings"
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                ) : (
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 md:p-12 text-center shadow-xs space-y-6">
                        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl bg-emerald-50 border border-emerald-100">
                            {emptyBoxData ? (
                                <Lottie
                                    animationData={emptyBoxData}
                                    loop
                                    className="h-32 w-32"
                                />
                            ) : (
                                <div className="h-32 w-32 flex items-center justify-center text-4xl">🛒</div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl md:text-3xl font-[1000] tracking-tight text-slate-900 uppercase">
                                Your cart is empty
                            </h2>
                            <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto">
                                Save more money & earn Athreya Coins with every purchase!
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                            <Link
                                to="/categories"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0d4d29] hover:bg-[#0a3f22] px-8 py-3.5 text-xs font-[1000] uppercase tracking-wider text-white transition-all shadow-md active:scale-98"
                            >
                                Start Shopping
                                <ArrowRight size={16} />
                            </Link>
                            <Link
                                to="/offers"
                                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 px-8 py-3.5 text-xs font-[1000] uppercase tracking-wider text-slate-800 transition-colors"
                            >
                                Browse Offers
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartPage;
