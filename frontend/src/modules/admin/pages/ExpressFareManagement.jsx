// Athreya Express — fare management
// One table drives what the customer is quoted, what they are charged, and what
// the rider earns. The calculator on the right runs the SAME server function on
// your unsaved edits, so you can see the effect before you save.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { Zap, Save, RotateCcw, Home, Store, Truck, Bike, IndianRupee, Calculator, Moon, Scale, TrendingUp, Power } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICES = [
    { key: 'home_to_home', label: 'Home to Home', telugu: 'ఇంటి నుండి ఇంటికి', icon: Home },
    { key: 'shop_to_home', label: 'Shop to Home', telugu: 'షాప్ నుండి ఇంటికి', icon: Store },
    { key: 'cargo_to_home', label: 'Cargo to Home', telugu: 'కార్గో / బస్సు', icon: Truck },
    { key: 'rider_delivery', label: 'Rider Pickup Request', telugu: 'రైడర్ పికప్', icon: Bike },
];

const FALLBACK_BANDS = [
    { key: 'upTo1Kg', label: 'Up to 1 kg' },
    { key: 'kg1To3', label: '1-3 kg' },
    { key: 'kg3To5', label: '3-5 kg' },
    { key: 'kg5To10', label: '5-10 kg' },
    { key: 'kg10Plus', label: '10 kg+' },
];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const NumField = ({ label, hint, value, onChange, prefix, suffix, step = '1', min = 0, max }) => (
    <label className="block">
        <span className="text-[11px] font-bold text-slate-600">{label}</span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all">
            {prefix && <span className="pl-3 text-xs font-bold text-slate-400">{prefix}</span>}
            <input
                type="number"
                inputMode="decimal"
                value={value ?? ''}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-transparent px-3 py-2 text-sm font-bold text-slate-900 outline-none"
            />
            {suffix && <span className="pr-3 text-xs font-bold text-slate-400 whitespace-nowrap">{suffix}</span>}
        </div>
        {hint && <span className="mt-1 block text-[10px] text-slate-400 leading-snug">{hint}</span>}
    </label>
);

const Toggle = ({ checked, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            checked ? 'bg-emerald-500' : 'bg-slate-300',
        )}
    >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
);

const Section = ({ icon: Icon, title, subtitle, children, right }) => (
    <Card className="p-5 rounded-2xl shadow-sm border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-900">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p>}
                </div>
            </div>
            {right}
        </div>
        {children}
    </Card>
);

const ExpressFareManagement = () => {
    const [saved, setSaved] = useState(null); // last persisted settings
    const [draft, setDraft] = useState(null); // what the form edits
    const [bands, setBands] = useState(FALLBACK_BANDS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Calculator
    const [calc, setCalc] = useState({ service: 'home_to_home', distanceKm: 2.5, weight: 'Up to 1 kg', hourIst: 12 });
    const [quote, setQuote] = useState(null);
    const [quoting, setQuoting] = useState(false);
    const quoteSeq = useRef(0);

    useEffect(() => {
        (async () => {
            try {
                const res = await adminApi.getExpressFare();
                if (res.data.success) {
                    const { settings, weightBands } = res.data.result;
                    setSaved(settings);
                    setDraft(settings);
                    if (Array.isArray(weightBands) && weightBands.length) setBands(weightBands);
                }
            } catch (e) {
                toast.error('Failed to load Express fare settings');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const dirty = useMemo(
        () => !!draft && !!saved && JSON.stringify(strip(draft)) !== JSON.stringify(strip(saved)),
        [draft, saved],
    );

    const set = useCallback((path, value) => {
        setDraft((prev) => {
            const next = structuredClone(prev);
            const keys = path.split('.');
            let ref = next;
            for (let i = 0; i < keys.length - 1; i += 1) ref = ref[keys[i]];
            ref[keys[keys.length - 1]] = value;
            return next;
        });
    }, []);

    // Live preview: same server function, on the UNSAVED draft.
    useEffect(() => {
        if (!draft) return undefined;
        const seq = ++quoteSeq.current;
        const t = setTimeout(async () => {
            setQuoting(true);
            try {
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const hh = String(calc.hourIst).padStart(2, '0');
                const res = await adminApi.quoteExpressFare({
                    service: calc.service,
                    distanceKm: Number(calc.distanceKm) || 0,
                    weight: calc.weight,
                    at: new Date(`${today}T${hh}:00:00+05:30`).toISOString(),
                    settingsOverride: strip(draft),
                });
                if (seq === quoteSeq.current && res.data.success) setQuote(res.data.result);
            } catch {
                if (seq === quoteSeq.current) setQuote(null);
            } finally {
                if (seq === quoteSeq.current) setQuoting(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [draft, calc]);

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true);
        try {
            const res = await adminApi.updateExpressFare(strip(draft));
            if (res.data.success) {
                setSaved(res.data.result.settings);
                setDraft(res.data.result.settings);
                toast.success('Express fares saved — live for new bookings');
            }
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save fares');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !draft) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-24">
                <div className="h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading fares…</p>
            </div>
        );
    }

    const fare = quote?.fare;
    const riderTotal = fare?.rider?.total ?? 0;

    return (
        <div className="space-y-6 pb-28">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Zap className="h-6 w-6 text-amber-500" />
                        Express Fare Management
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Set what customers pay and what riders earn for Athreya Express.
                    </p>
                </div>
                <Link to="/admin/express" className="text-xs font-bold text-emerald-700 hover:underline">
                    ← Back to Express orders
                </Link>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    {/* Master switch */}
                    <Card className={cn('p-4 rounded-2xl border flex items-center justify-between gap-4', draft.enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/60')}>
                        <div className="flex items-start gap-3">
                            <Power className={cn('h-5 w-5 mt-0.5', draft.enabled ? 'text-emerald-600' : 'text-amber-600')} />
                            <div>
                                <p className="text-sm font-black text-slate-900">
                                    {draft.enabled ? 'Express fare table is ON' : 'Express fare table is OFF'}
                                </p>
                                <p className="text-[11px] text-slate-600 leading-snug">
                                    {draft.enabled
                                        ? 'Bookings use the fares below.'
                                        : 'Bookings fall back to the platform-wide delivery fee in Fees & Charges. Service on/off switches still apply.'}
                                </p>
                            </div>
                        </div>
                        <Toggle checked={draft.enabled} onChange={(v) => set('enabled', v)} label="Use Express fare table" />
                    </Card>

                    <Section icon={IndianRupee} title="Customer fare" subtitle="Base fare covers the first stretch; every further km (rounded up) adds the per-km rate.">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <NumField label="Base fare" prefix="₹" value={draft.baseFare} onChange={(v) => set('baseFare', v)} />
                            <NumField label="Base distance" suffix="km" step="0.1" value={draft.baseDistanceKm} onChange={(v) => set('baseDistanceKm', v)} hint="Included in the base fare" />
                            <NumField label="Per extra km" prefix="₹" value={draft.perKmRate} onChange={(v) => set('perKmRate', v)} />
                            <NumField label="Minimum fare" prefix="₹" value={draft.minimumFare} onChange={(v) => set('minimumFare', v)} hint="Never charge less than this" />
                            <NumField label="Surge multiplier" suffix="×" step="0.1" min={1} max={5} value={draft.surgeMultiplier} onChange={(v) => set('surgeMultiplier', v)} hint="1 = off · 1.5 = +50%" />
                        </div>
                        {draft.surgeMultiplier > 1 && (
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-800">
                                <TrendingUp className="h-3.5 w-3.5" /> Surge is ON — every new booking costs {Math.round((draft.surgeMultiplier - 1) * 100)}% more.
                            </div>
                        )}
                    </Section>

                    <Section icon={Scale} title="Weight surcharge" subtitle="Flat add-on per weight band the customer picks (Home, Shop and Cargo). Rider requests carry no weight.">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {bands.map((b) => (
                                <NumField key={b.key} label={b.label} prefix="₹" value={draft.weightSurcharge[b.key]} onChange={(v) => set(`weightSurcharge.${b.key}`, v)} />
                            ))}
                        </div>
                    </Section>

                    <Section
                        icon={Moon}
                        title="Night charge"
                        subtitle="Extra amount for bookings placed during night hours (India time)."
                        right={<Toggle checked={draft.nightCharge.enabled} onChange={(v) => set('nightCharge.enabled', v)} label="Night charge" />}
                    >
                        <div className={cn('grid grid-cols-3 gap-4 transition-opacity', !draft.nightCharge.enabled && 'opacity-40 pointer-events-none')}>
                            <NumField label="From hour" suffix=":00" max={23} value={draft.nightCharge.startHour} onChange={(v) => set('nightCharge.startHour', v)} hint="24h · 22 = 10 PM" />
                            <NumField label="Until hour" suffix=":00" max={23} value={draft.nightCharge.endHour} onChange={(v) => set('nightCharge.endHour', v)} hint="6 = 6 AM" />
                            <NumField label="Charge" prefix="₹" value={draft.nightCharge.amount} onChange={(v) => set('nightCharge.amount', v)} />
                        </div>
                    </Section>

                    <Section icon={Zap} title="Services" subtitle="Turn a service off to stop new bookings, or add a flat fee on top of the fare.">
                        <div className="divide-y divide-slate-100">
                            {SERVICES.map(({ key, label, telugu, icon: Icon }) => {
                                const s = draft.services[key];
                                return (
                                    <div key={key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', s.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 truncate">{label}</p>
                                                <p className="text-[10px] text-slate-400">{telugu} · {s.enabled ? 'Accepting bookings' : 'Paused'}</p>
                                            </div>
                                        </div>
                                        <div className="w-full sm:w-40">
                                            <NumField label="Service fee" prefix="₹" value={s.serviceFee} onChange={(v) => set(`services.${key}.serviceFee`, v)} />
                                        </div>
                                        <Toggle checked={s.enabled} onChange={(v) => set(`services.${key}.enabled`, v)} label={`${label} enabled`} />
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    <Section icon={Save} title="Rider payout" subtitle="What the delivery partner earns per Express job.">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <NumField label="Base payout" prefix="₹" value={draft.rider.basePayout} onChange={(v) => set('rider.basePayout', v)} />
                            <NumField label="Per extra km" prefix="₹" value={draft.rider.perKmPayout} onChange={(v) => set('rider.perKmPayout', v)} />
                            <NumField label="Add-on share" suffix="%" max={100} value={draft.rider.surchargeSharePercent} onChange={(v) => set('rider.surchargeSharePercent', v)} hint="Of weight, service, night & surge add-ons" />
                        </div>
                    </Section>
                </div>

                {/* Calculator */}
                <div className="xl:col-span-1">
                    <div className="xl:sticky xl:top-4 space-y-4">
                        <Card className="p-5 rounded-2xl shadow-sm border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Calculator className="h-4 w-4 text-emerald-700" />
                                <h3 className="text-sm font-black text-slate-900">Fare calculator</h3>
                                <span className="ml-auto text-[10px] font-bold text-slate-400">{quoting ? 'Calculating…' : dirty ? 'Preview of unsaved edits' : 'Live'}</span>
                            </div>

                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-slate-600">Service</span>
                                    <select value={calc.service} onChange={(e) => setCalc((c) => ({ ...c, service: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none">
                                        {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                    </select>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <NumField label="Distance" suffix="km" step="0.1" value={calc.distanceKm} onChange={(v) => setCalc((c) => ({ ...c, distanceKm: v }))} />
                                    <NumField label="Hour (IST)" suffix=":00" max={23} value={calc.hourIst} onChange={(v) => setCalc((c) => ({ ...c, hourIst: Math.min(23, Math.max(0, Number(v) || 0)) }))} />
                                </div>
                                {calc.service !== 'rider_delivery' && (
                                    <label className="block">
                                        <span className="text-[11px] font-bold text-slate-600">Weight</span>
                                        <select value={calc.weight} onChange={(e) => setCalc((c) => ({ ...c, weight: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none">
                                            {bands.map((b) => <option key={b.key} value={b.label}>{b.label}</option>)}
                                        </select>
                                    </label>
                                )}
                            </div>

                            {fare && (
                                <div className="mt-5 space-y-1.5 text-xs">
                                    {!quote.serviceEnabled && (
                                        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700">This service is paused — customers can't book it.</div>
                                    )}
                                    <Line label="Base fare" value={fare.baseFare} />
                                    <Line label={`Distance (${fare.extraKm} extra km)`} value={fare.distanceFare} />
                                    {fare.weightSurcharge > 0 && <Line label={`Weight (${fare.weightBand})`} value={fare.weightSurcharge} />}
                                    {fare.serviceFee > 0 && <Line label="Service fee" value={fare.serviceFee} />}
                                    {fare.nightCharge > 0 && <Line label="Night charge" value={fare.nightCharge} />}
                                    {fare.surgeAmount > 0 && <Line label="Surge" value={fare.surgeAmount} />}
                                    {fare.minimumFareTopUp > 0 && <Line label="Minimum fare top-up" value={fare.minimumFareTopUp} />}
                                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                                        <span className="text-sm font-black text-slate-900">Customer pays</span>
                                        <span className="text-lg font-black text-emerald-700">{inr(fare.total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span className="font-bold">Rider earns</span>
                                        <span className="font-black">{inr(riderTotal)}</span>
                                    </div>
                                    <div className={cn('flex items-center justify-between font-bold', fare.total - riderTotal < 0 ? 'text-rose-600' : 'text-slate-600')}>
                                        <span>Athreya margin</span>
                                        <span className="font-black">{inr(fare.total - riderTotal)}</span>
                                    </div>
                                    {fare.total - riderTotal < 0 && (
                                        <p className="text-[10px] font-bold text-rose-600">Riders would earn more than the customer pays for this job.</p>
                                    )}
                                    {quote.eta?.label && (
                                        <p className="pt-1 text-[10px] text-slate-400">Customer sees an estimated time of {quote.eta.label}.</p>
                                    )}
                                </div>
                            )}
                        </Card>
                        {saved?.updatedAt && (
                            <p className="text-[10px] text-slate-400 text-center">
                                Last saved {new Date(saved.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Save bar */}
            <div className={cn('fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300', dirty ? 'translate-y-0' : 'translate-y-full')}>
                <div className="mx-auto max-w-5xl px-4 pb-4">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl">
                        <p className="text-xs font-bold">You have unsaved fare changes</p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setDraft(saved)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
                                <RotateCcw className="h-3.5 w-3.5" /> Discard
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-black text-slate-900 hover:bg-emerald-400 disabled:opacity-60">
                                <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save fares'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Line = ({ label, value }) => (
    <div className="flex items-center justify-between text-slate-600">
        <span>{label}</span>
        <span className="font-bold text-slate-900">{inr(value)}</span>
    </div>
);

/** A cleared number input is '' — treat it as 0 rather than failing validation. */
function zeroBlanks(value) {
    if (value === '') return 0;
    if (Array.isArray(value)) return value.map(zeroBlanks);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, zeroBlanks(v)]));
    }
    return value;
}

/** Drop server-only bookkeeping before comparing / sending. */
function strip(settings) {
    const { updatedAt, updatedBy, ...rest } = settings || {};
    return zeroBlanks(rest);
}

export default ExpressFareManagement;
