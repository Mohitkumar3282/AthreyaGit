// Rider incentives - daily targets, peak hours, weekly bonus, rain, breaks.
// Saved to Settings.riderIncentives; the backend reads the rules on every
// delivery and the Rider App fetches them live, so edits apply immediately.
import React, { useEffect, useState } from 'react';
import Card from '@shared/components/ui/Card';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { Save, Plus, Trash2, CloudRain, Clock, Target, Trophy, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULTS = {
    dailyTargets: { enabled: true, tiers: [{ orders: 8, bonus: 80 }, { orders: 15, bonus: 180 }, { orders: 22, bonus: 300 }] },
    peakHours: { enabled: true, windows: [{ start: '12:00', end: '15:00', bonus: 10 }, { start: '19:00', end: '22:00', bonus: 15 }] },
    weeklyBonus: { enabled: true, minOrders: 100, minRating: 4.8, bonus: 500 },
    rain: { enabled: true, active: false, bonusPerDelivery: 15 },
    breaks: { enabled: true, durations: [15, 30, 60] },
};

const merge = (saved) => ({
    dailyTargets: { ...DEFAULTS.dailyTargets, ...(saved?.dailyTargets || {}) },
    peakHours: { ...DEFAULTS.peakHours, ...(saved?.peakHours || {}) },
    weeklyBonus: { ...DEFAULTS.weeklyBonus, ...(saved?.weeklyBonus || {}) },
    rain: { ...DEFAULTS.rain, ...(saved?.rain || {}) },
    breaks: { ...DEFAULTS.breaks, ...(saved?.breaks || {}) },
});

const Toggle = ({ checked, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-emerald-500' : 'bg-slate-300')}
    >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
);

const Num = ({ value, onChange, prefix, suffix, step = 1, className }) => (
    <div className={cn('flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3', className)}>
        {prefix && <span className="text-xs font-bold text-slate-400 mr-1">{prefix}</span>}
        <input
            type="number"
            min={0}
            step={step}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-transparent py-2 text-sm font-bold text-slate-900 outline-none"
        />
        {suffix && <span className="text-xs font-bold text-slate-400 ml-1 whitespace-nowrap">{suffix}</span>}
    </div>
);

const Section = ({ icon: Icon, title, hint, enabled, onToggle, children }) => (
    <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-900">{title}</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>
                </div>
            </div>
            <Toggle checked={enabled} onChange={onToggle} label={title} />
        </div>
        <div className={cn('space-y-3', !enabled && 'opacity-50 pointer-events-none')}>{children}</div>
    </Card>
);

const RiderIncentives = () => {
    const [cfg, setCfg] = useState(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await adminApi.getSettings();
                setCfg(merge(res.data?.result?.riderIncentives));
            } catch {
                toast.error('Failed to load incentive settings');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const set = (section, patch) => setCfg((c) => ({ ...c, [section]: { ...c[section], ...patch } }));
    const setRow = (section, key, i, patch) =>
        setCfg((c) => ({ ...c, [section]: { ...c[section], [key]: c[section][key].map((r, idx) => (idx === i ? { ...r, ...patch } : r)) } }));

    const save = async () => {
        const clean = {
            ...cfg,
            dailyTargets: {
                ...cfg.dailyTargets,
                tiers: cfg.dailyTargets.tiers.filter((t) => Number(t.orders) > 0).map((t) => ({ orders: Number(t.orders), bonus: Number(t.bonus) || 0 })),
            },
            peakHours: {
                ...cfg.peakHours,
                windows: cfg.peakHours.windows.map((w) => ({ start: w.start, end: w.end, bonus: Number(w.bonus) || 0 })),
            },
            weeklyBonus: {
                ...cfg.weeklyBonus,
                minOrders: Number(cfg.weeklyBonus.minOrders) || 1,
                minRating: Number(cfg.weeklyBonus.minRating) || 0,
                bonus: Number(cfg.weeklyBonus.bonus) || 0,
            },
            rain: { ...cfg.rain, bonusPerDelivery: Number(cfg.rain.bonusPerDelivery) || 0 },
            breaks: { ...cfg.breaks, durations: cfg.breaks.durations.map(Number).filter((m) => m > 0) },
        };
        try {
            setSaving(true);
            await adminApi.updateSettings({ riderIncentives: clean });
            toast.success('Incentive settings saved. Riders see them now.');
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;

    return (
        <div className="space-y-5 pb-24 max-w-4xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-slate-900">Rider Incentives</h1>
                    <p className="text-xs text-slate-500">Changes apply to new deliveries immediately and show in the Rider App.</p>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                >
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
                </button>
            </div>

            <Section
                icon={Target}
                title="Daily Targets"
                hint="Only the highest tier reached in a day is paid (the tier's total, not added together)."
                enabled={cfg.dailyTargets.enabled}
                onToggle={(v) => set('dailyTargets', { enabled: v })}
            >
                {cfg.dailyTargets.tiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Num value={t.orders} onChange={(v) => setRow('dailyTargets', 'tiers', i, { orders: v })} suffix="+ orders" className="flex-1" />
                        <Num value={t.bonus} onChange={(v) => setRow('dailyTargets', 'tiers', i, { bonus: v })} prefix="₹" className="flex-1" />
                        <button onClick={() => set('dailyTargets', { tiers: cfg.dailyTargets.tiers.filter((_, x) => x !== i) })} className="p-2 text-rose-500">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                <button onClick={() => set('dailyTargets', { tiers: [...cfg.dailyTargets.tiers, { orders: '', bonus: '' }] })} className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Plus className="h-3.5 w-3.5" /> Add tier
                </button>
            </Section>

            <Section
                icon={Clock}
                title="Peak-Hour Incentives"
                hint="Extra amount per delivery completed inside these windows (India time)."
                enabled={cfg.peakHours.enabled}
                onToggle={(v) => set('peakHours', { enabled: v })}
            >
                {cfg.peakHours.windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                        <input type="time" value={w.start} onChange={(e) => setRow('peakHours', 'windows', i, { start: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" />
                        <span className="text-xs text-slate-400">to</span>
                        <input type="time" value={w.end} onChange={(e) => setRow('peakHours', 'windows', i, { end: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" />
                        <Num value={w.bonus} onChange={(v) => setRow('peakHours', 'windows', i, { bonus: v })} prefix="₹" suffix="/ delivery" className="w-40" />
                        <button onClick={() => set('peakHours', { windows: cfg.peakHours.windows.filter((_, x) => x !== i) })} className="p-2 text-rose-500">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                <button onClick={() => set('peakHours', { windows: [...cfg.peakHours.windows, { start: '12:00', end: '15:00', bonus: 10 }] })} className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Plus className="h-3.5 w-3.5" /> Add window
                </button>
            </Section>

            <Section
                icon={Trophy}
                title="Weekly Bonus"
                hint="Paid once per week (Mon-Sun) when both conditions are met."
                enabled={cfg.weeklyBonus.enabled}
                onToggle={(v) => set('weeklyBonus', { enabled: v })}
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-[11px] font-bold text-slate-600">Min orders
                        <Num value={cfg.weeklyBonus.minOrders} onChange={(v) => set('weeklyBonus', { minOrders: v })} />
                    </label>
                    <label className="text-[11px] font-bold text-slate-600">Min rating
                        <Num value={cfg.weeklyBonus.minRating} step={0.1} onChange={(v) => set('weeklyBonus', { minRating: v })} />
                    </label>
                    <label className="text-[11px] font-bold text-slate-600">Bonus
                        <Num value={cfg.weeklyBonus.bonus} prefix="₹" onChange={(v) => set('weeklyBonus', { bonus: v })} />
                    </label>
                </div>
            </Section>

            <Section
                icon={CloudRain}
                title="Rain Incentive"
                hint="Extra amount per delivery while rain mode is ON. Switch rain mode on/off below when the weather changes."
                enabled={cfg.rain.enabled}
                onToggle={(v) => set('rain', { enabled: v })}
            >
                <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-100 px-4 py-3">
                    <div>
                        <p className="text-xs font-black text-sky-900">Rain mode right now</p>
                        <p className="text-[11px] text-sky-700">{cfg.rain.active ? 'ON - riders earn the rain bonus' : 'OFF'}</p>
                    </div>
                    <Toggle checked={cfg.rain.active} onChange={(v) => set('rain', { active: v })} label="Rain mode" />
                </div>
                <label className="text-[11px] font-bold text-slate-600 block max-w-xs">Bonus per delivery
                    <Num value={cfg.rain.bonusPerDelivery} prefix="₹" onChange={(v) => set('rain', { bonusPerDelivery: v })} />
                </label>
            </Section>

            <Section
                icon={Coffee}
                title="Rider Breaks"
                hint="Riders pick one of these durations. No orders are offered during a break and there is no penalty."
                enabled={cfg.breaks.enabled}
                onToggle={(v) => set('breaks', { enabled: v })}
            >
                <div className="flex flex-wrap items-center gap-2">
                    {cfg.breaks.durations.map((m, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <Num value={m} suffix="min" className="w-28" onChange={(v) => set('breaks', { durations: cfg.breaks.durations.map((d, x) => (x === i ? v : d)) })} />
                            <button onClick={() => set('breaks', { durations: cfg.breaks.durations.filter((_, x) => x !== i) })} className="p-1 text-rose-500">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button onClick={() => set('breaks', { durations: [...cfg.breaks.durations, 15] })} className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                </div>
            </Section>
        </div>
    );
};

export default RiderIncentives;
