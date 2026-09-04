import React, { useCallback, useEffect, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Coins,
    Loader2,
    Search,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Admin view over the Athreya Coins programme.
 *
 * Two tabs: customer balances, and the full movement log. Both are read-only —
 * coins are minted by delivery settlement and spent at checkout, so there is
 * no admin "grant" action. The outstanding balance is the platform's liability
 * (coins customers can still spend as discount), which is the number finance
 * actually cares about.
 */

const TX_LABELS = {
    EARN: 'Coins Earned',
    REDEEM: 'Coins Redeemed',
    REVERSAL: 'Coins Returned',
    ADJUSTMENT: 'Adjustment',
    EXPIRY: 'Coins Reclaimed',
};

const TX_FILTERS = [
    { id: '', label: 'All types' },
    { id: 'EARN', label: 'Earned' },
    { id: 'REDEEM', label: 'Redeemed' },
    { id: 'REVERSAL', label: 'Returned' },
    { id: 'EXPIRY', label: 'Reclaimed' },
];

const coinsFmt = (value) => Number(value || 0).toLocaleString('en-IN');
const rupees = (value) => `₹${Number(value || 0).toFixed(2)}`;

function StatCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
    const tones = {
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate: 'bg-slate-100 text-slate-600',
    };
    return (
        <Card className="border-none shadow-lg ring-1 ring-slate-100 bg-white rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {label}
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
                    {sub && <p className="text-[11px] font-bold text-slate-500 mt-1">{sub}</p>}
                </div>
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </Card>
    );
}

const AdminCoinWallets = () => {
    const [activeTab, setActiveTab] = useState('wallets');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const [wallets, setWallets] = useState([]);
    const [summary, setSummary] = useState(null);
    const [settings, setSettings] = useState(null);
    const [walletPage, setWalletPage] = useState(1);
    const [walletTotal, setWalletTotal] = useState(0);

    const [transactions, setTransactions] = useState([]);
    const [txPage, setTxPage] = useState(1);
    const [txTotal, setTxTotal] = useState(0);

    const [loading, setLoading] = useState(true);
    const pageSize = 25;

    const fetchWallets = useCallback(async (page = 1, term = '') => {
        setLoading(true);
        try {
            const res = await adminApi.getCoinWallets({ page, limit: pageSize, search: term });
            const data = res.data?.result ?? res.data;
            setWallets(data?.items || []);
            setWalletTotal(data?.total || 0);
            setSummary(data?.summary || null);
            setSettings(data?.settings || null);
            setWalletPage(page);
        } catch {
            setWallets([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async (page = 1, type = '') => {
        setLoading(true);
        try {
            const res = await adminApi.getCoinTransactions({ page, limit: pageSize, type });
            const data = res.data?.result ?? res.data;
            setTransactions(data?.items || []);
            setTxTotal(data?.total || 0);
            setTxPage(page);
        } catch {
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced so typing in the search box does not hammer the API.
    useEffect(() => {
        if (activeTab !== 'wallets') return undefined;
        const timer = setTimeout(() => fetchWallets(1, search), 400);
        return () => clearTimeout(timer);
    }, [activeTab, search, fetchWallets]);

    useEffect(() => {
        if (activeTab !== 'transactions') return;
        fetchTransactions(1, typeFilter);
    }, [activeTab, typeFilter, fetchTransactions]);

    const coinsPerRupee = settings?.rupeeValuePerCoin
        ? Math.round(1 / settings.rupeeValuePerCoin)
        : 100;

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Coins className="h-6 w-6 text-amber-500" />
                    Athreya Coins Wallets
                </h1>
                <p className="text-sm font-bold text-slate-500 mt-1">
                    {coinsPerRupee} Coins = ₹1
                    {settings && !settings.enabled && (
                        <span className="ml-2 text-rose-600">· Programme currently disabled</span>
                    )}
                </p>
            </div>

            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        icon={Wallet}
                        tone="amber"
                        label="Outstanding Coins"
                        value={coinsFmt(summary.outstandingCoins)}
                        sub={`${rupees(summary.outstandingValue)} redeemable liability`}
                    />
                    <StatCard
                        icon={TrendingUp}
                        tone="emerald"
                        label="Lifetime Earned"
                        value={coinsFmt(summary.lifetimeEarned)}
                    />
                    <StatCard
                        icon={TrendingDown}
                        label="Lifetime Redeemed"
                        value={coinsFmt(summary.lifetimeRedeemed)}
                    />
                    <StatCard
                        icon={Coins}
                        label="Wallets"
                        value={coinsFmt(summary.walletCount)}
                    />
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    {[
                        { id: 'wallets', label: 'Customer Balances' },
                        { id: 'transactions', label: 'Transactions' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors',
                                activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'wallets' ? (
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, phone or email"
                            className="w-full pl-11 pr-4 py-3 bg-white ring-1 ring-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                    </div>
                ) : (
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-4 py-3 bg-white ring-1 ring-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none"
                    >
                        {TX_FILTERS.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                {loading ? (
                    <div className="py-20 flex justify-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : activeTab === 'wallets' ? (
                    wallets.length === 0 ? (
                        <div className="py-20 text-center text-sm font-bold text-slate-400">
                            No coin wallets yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/60">
                                    <tr>
                                        {['Customer', 'Balance', 'Value', 'Earned', 'Redeemed', 'Status'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {wallets.map((row) => (
                                        <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-slate-900">
                                                    {row.customerName || 'Unknown customer'}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-500">
                                                    {row.customerPhone || row.customerEmail || '—'}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-sm font-black text-amber-600 whitespace-nowrap">
                                                {coinsFmt(row.balance)}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                                                {rupees(row.rupeeValue)}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-emerald-600 whitespace-nowrap">
                                                +{coinsFmt(row.lifetimeEarned)}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-slate-600 whitespace-nowrap">
                                                -{coinsFmt(row.lifetimeRedeemed)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={cn(
                                                        'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider',
                                                        row.status === 'ACTIVE'
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : 'bg-rose-50 text-rose-600',
                                                    )}
                                                >
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : transactions.length === 0 ? (
                    <div className="py-20 text-center text-sm font-bold text-slate-400">
                        No coin transactions yet.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {transactions.map((tx) => {
                            const isCredit = tx.direction === 'CREDIT';
                            return (
                                <div
                                    key={tx._id}
                                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={cn(
                                                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                                                isCredit
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-slate-100 text-slate-600',
                                            )}
                                        >
                                            {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900">
                                                {TX_LABELS[tx.type] || tx.type}
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-500 truncate">
                                                {tx.customerName || 'Unknown'}
                                                {tx.customerPhone ? ` · ${tx.customerPhone}` : ''}
                                                {tx.orderId ? ` · #${tx.orderId}` : ''}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {tx.savingsBase > 0 && `1% of ${rupees(tx.savingsBase)} savings · `}
                                                {new Date(tx.date).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p
                                            className={cn(
                                                'text-sm font-black',
                                                isCredit ? 'text-emerald-600' : 'text-slate-900',
                                            )}
                                        >
                                            {isCredit ? '+' : '-'}
                                            {coinsFmt(tx.coins)}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            {rupees(tx.rupeeValue)} · bal {coinsFmt(tx.balanceAfter)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {!loading && (
                <div className="mt-4">
                    <Pagination
                        page={activeTab === 'wallets' ? walletPage : txPage}
                        total={activeTab === 'wallets' ? walletTotal : txTotal}
                        totalPages={Math.ceil(
                            (activeTab === 'wallets' ? walletTotal : txTotal) / pageSize,
                        ) || 1}
                        pageSize={pageSize}
                        onPageChange={(nextPage) =>
                            activeTab === 'wallets'
                                ? fetchWallets(nextPage, search)
                                : fetchTransactions(nextPage, typeFilter)
                        }
                    />
                </div>
            )}
        </div>
    );
};

export default AdminCoinWallets;
