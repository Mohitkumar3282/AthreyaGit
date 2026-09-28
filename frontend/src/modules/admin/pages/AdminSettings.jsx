import React, { useEffect, useRef, useState } from 'react';
import Card from '@shared/components/ui/Card';
import {
    Save,
    Settings,
    Globe,
    Building2,
    Share2,
    Smartphone,
    Search,
    Upload,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    Youtube,
    Loader2,
    Coins,
    ExternalLink,
    X,
    Package,
    Plus,
    Trash2,
    Edit3,
    CheckCircle2,
    Sparkles,
    Layers,
    Bike
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import { useSettings } from '@core/context/SettingsContext';
import { invalidateCache } from '@core/api/dedupe';

const AdminSettings = () => {
    const normalizeProductApprovalConfig = (raw) => {
        const config = raw?.productApproval || raw || {};
        return {
            sellerCreateRequiresApproval: Boolean(config.sellerCreateRequiresApproval),
            sellerEditRequiresApproval: Boolean(config.sellerEditRequiresApproval),
        };
    };

    const { refetch } = useSettings();
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('general');
    const [logoUploading, setLogoUploading] = useState(false);
    const [faviconUploading, setFaviconUploading] = useState(false);
    const logoInputRef = useRef(null);
    const faviconInputRef = useRef(null);

    const [settings, setSettings] = useState({
        appName: '',
        supportEmail: '',
        supportPhone: '',
        whatsappNumber: '',
        currencySymbol: '₹',
        currencyCode: 'INR',
        timezone: 'Asia/Kolkata',
        logoUrl: '',
        faviconUrl: '',
        primaryColor: 'var(--primary)',
        secondaryColor: '#64748b',
        companyName: '',
        taxId: '',
        address: '',
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        youtube: '',
        playStoreLink: '',
        appStoreLink: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        keywords: [],
        returnDeliveryCommission: 0,
        lowStockAlertsEnabled: true,
        productApproval: {
            sellerCreateRequiresApproval: false,
            sellerEditRequiresApproval: false,
        },
        // Athreya Coins. Stored as `rupeeValuePerCoin` (₹0.01 per coin), but
        // the admin edits the far more legible "how many coins make ₹1", so
        // the form keeps `coinsPerRupee` and converts on save.
        athreyaCoins: {
            enabled: true,
            coinsPerRupeeSaved: 1,
            rupeeValuePerCoin: 0.01,
            minRedeemCoins: 1,
            maxRedeemPercentOfOrder: 100,
            maxEarnPerOrder: 0,
            creditOn: 'DELIVERY',
        },
        parcelCategories: [
            { id: "docs", label: "Documents / Papers", telugu: "పత్రాలు", icon: "📄", enabled: true },
            { id: "clothes", label: "Clothes / Laundry", telugu: "బట్టలు", icon: "👕", enabled: true },
            { id: "food", label: "Home Food / Tiffin", telugu: "ఇంటి భోజనం / టిఫిన్", icon: "🍱", enabled: true },
            { id: "electronics", label: "Electronics / Cables", telugu: "ఎలక్ట్రానిక్స్", icon: "📱", enabled: true },
            { id: "box", label: "Carton / Gift Box", telugu: "బాక్స్ / గిఫ్ట్", icon: "📦", enabled: true },
            { id: "other", label: "Other Permitted Item", telugu: "ఇతర వస్తువులు", icon: "✨", enabled: true },
        ],
        riderTaskTypes: [
            { id: "keys", label: "Deliver Keys", telugu: "తాళాలు డెలివరీ", icon: "🔑", enabled: true },
            { id: "docs", label: "Documents / Xerox", telugu: "డాక్యుమెంట్లు / జిరాక్స్", icon: "📄", enabled: true },
            { id: "tiffin", label: "Lunch Box / Tiffin", telugu: "లంచ్ బాక్స్ / టిఫిన్", icon: "🍱", enabled: true },
            { id: "errand", label: "Pickup & Drop Errand", telugu: "పికప్ & డ్రాప్ పని", icon: "🛵", enabled: true },
            { id: "other", label: "Custom Local Task", telugu: "ఇతర స్థానిక పని", icon: "📝", enabled: true },
        ],
        serviceAreas: [
            { id: "area_1", name: "Madanapalle", pincode: "517325", enabled: true, note: "Madanapalle Town & surroundings" },
        ],
    });

    const [categoryModal, setCategoryModal] = useState({
        isOpen: false,
        type: 'parcel', // 'parcel' | 'rider'
        editIndex: null,
        form: {
            id: '',
            label: '',
            telugu: '',
            icon: '📦',
            enabled: true,
        }
    });

    const openAddCategory = (type) => {
        setCategoryModal({
            isOpen: true,
            type,
            editIndex: null,
            form: {
                id: '',
                label: '',
                telugu: '',
                icon: type === 'parcel' ? '📦' : '🛵',
                enabled: true,
            }
        });
    };

    const openEditCategory = (type, index) => {
        const list = type === 'parcel' ? (settings.parcelCategories || []) : (settings.riderTaskTypes || []);
        const item = list[index];
        if (!item) return;
        setCategoryModal({
            isOpen: true,
            type,
            editIndex: index,
            form: { ...item }
        });
    };

    const handleSaveCategoryItem = () => {
        const { type, editIndex, form } = categoryModal;
        if (!form.label.trim()) {
            showToast('Please enter an English label', 'error');
            return;
        }

        const autoId = form.id.trim() || form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const finalItem = {
            ...form,
            id: autoId || 'category_' + Date.now(),
            label: form.label.trim(),
            telugu: form.telugu?.trim() || '',
            icon: form.icon?.trim() || (type === 'parcel' ? '📦' : '🛵'),
            enabled: form.enabled !== false,
        };

        if (type === 'parcel') {
            const list = [...(settings.parcelCategories || [])];
            if (editIndex !== null && editIndex >= 0) {
                list[editIndex] = finalItem;
            } else {
                list.push(finalItem);
            }
            setSettings(prev => ({ ...prev, parcelCategories: list }));
        } else {
            const list = [...(settings.riderTaskTypes || [])];
            if (editIndex !== null && editIndex >= 0) {
                list[editIndex] = finalItem;
            } else {
                list.push(finalItem);
            }
            setSettings(prev => ({ ...prev, riderTaskTypes: list }));
        }

        setCategoryModal(prev => ({ ...prev, isOpen: false }));
        showToast(`Category ${editIndex !== null ? 'updated' : 'added'}! Click "Save All Changes" to persist.`, 'success');
    };

    const handleDeleteCategoryItem = (type, index) => {
        if (type === 'parcel') {
            const list = (settings.parcelCategories || []).filter((_, i) => i !== index);
            setSettings(prev => ({ ...prev, parcelCategories: list }));
        } else {
            const list = (settings.riderTaskTypes || []).filter((_, i) => i !== index);
            setSettings(prev => ({ ...prev, riderTaskTypes: list }));
        }
        showToast('Category removed! Click "Save All Changes" to persist.', 'info');
    };

    const handleToggleCategoryItem = (type, index) => {
        if (type === 'parcel') {
            const list = [...(settings.parcelCategories || [])];
            if (list[index]) {
                list[index] = { ...list[index], enabled: !list[index].enabled };
                setSettings(prev => ({ ...prev, parcelCategories: list }));
            }
        } else {
            const list = [...(settings.riderTaskTypes || [])];
            if (list[index]) {
                list[index] = { ...list[index], enabled: !list[index].enabled };
                setSettings(prev => ({ ...prev, riderTaskTypes: list }));
            }
        }
    };

    // Service Areas Management
    const [areaModal, setAreaModal] = useState({
        isOpen: false,
        editIndex: null,
        form: {
            id: '',
            name: '',
            pincode: '',
            radiusKm: '',
            enabled: true,
            note: '',
        },
    });

    const openAddArea = () => {
        setAreaModal({
            isOpen: true,
            editIndex: null,
            form: {
                id: '',
                name: '',
                pincode: '',
                radiusKm: '11',
                enabled: true,
                note: '',
            },
        });
    };

    const openEditArea = (index) => {
        const item = settings.serviceAreas?.[index];
        if (!item) return;
        const noteRadius = item.note ? item.note.match(/(\d+(?:\.\d+)?)\s*(?:km|kms)?/i)?.[1] : '';
        const resolvedRadius = item.radiusKm > 0 ? String(item.radiusKm) : (noteRadius || '');
        setAreaModal({
            isOpen: true,
            editIndex: index,
            form: {
                id: item.id || '',
                name: item.name || '',
                pincode: item.pincode || '',
                radiusKm: resolvedRadius,
                enabled: item.enabled !== false,
                note: item.note || '',
            },
        });
    };

    const handleSaveArea = () => {
        const { form, editIndex } = areaModal;
        if (!form.name.trim() && !form.pincode.trim()) {
            showToast('Please enter an area name or pincode', 'error');
            return;
        }

        const autoId = form.id.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'area_' + Date.now();
        const parsedRadius = Number(form.radiusKm) || (form.note?.match(/(\d+(?:\.\d+)?)\s*(?:km|kms)?/i)?.[1] ? Number(form.note.match(/(\d+(?:\.\d+)?)\s*(?:km|kms)?/i)[1]) : 0);

        const finalArea = {
            id: autoId,
            name: form.name.trim(),
            pincode: form.pincode.trim(),
            radiusKm: parsedRadius,
            enabled: form.enabled !== false,
            note: form.note.trim(),
        };

        const list = [...(settings.serviceAreas || [])];
        if (editIndex !== null && editIndex >= 0) {
            list[editIndex] = finalArea;
        } else {
            list.push(finalArea);
        }
        setSettings(prev => ({ ...prev, serviceAreas: list }));
        setAreaModal(prev => ({ ...prev, isOpen: false }));
        showToast(`Service Area ${editIndex !== null ? 'updated' : 'added'}! Click "Save All Changes" to persist.`, 'success');
    };

    const handleDeleteArea = (index) => {
        const list = (settings.serviceAreas || []).filter((_, i) => i !== index);
        setSettings(prev => ({ ...prev, serviceAreas: list }));
        showToast('Service Area removed! Click "Save All Changes" to persist.', 'info');
    };

    const handleToggleArea = (index) => {
        const list = [...(settings.serviceAreas || [])];
        if (list[index]) {
            list[index] = { ...list[index], enabled: !list[index].enabled };
            setSettings(prev => ({ ...prev, serviceAreas: list }));
        }
    };

    const coins = settings.athreyaCoins || {};
    const coinsPerRupee = Math.max(1, Math.round(1 / (Number(coins.rupeeValuePerCoin) || 0.01)));

    const handleCoinChange = (field, value) => {
        setSettings((prev) => ({
            ...prev,
            athreyaCoins: { ...(prev.athreyaCoins || {}), [field]: value },
        }));
    };

    // The admin types "100 coins = ₹1"; we persist the reciprocal.
    const handleCoinsPerRupeeChange = (value) => {
        const perRupee = Math.max(1, Math.round(Number(value) || 1));
        handleCoinChange('rupeeValuePerCoin', Number((1 / perRupee).toFixed(4)));
    };

    // Worked example rendered live under the rate inputs, so an admin can see
    // what a rate change actually pays out before saving it.
    const exampleCoins = Math.floor(100 * (Number(coins.coinsPerRupeeSaved) || 0));
    const exampleValue = (exampleCoins / coinsPerRupee).toFixed(2);

    const CREDIT_TRIGGERS = [
        { id: 'DELIVERY', label: 'Order delivered', hint: 'Recommended' },
        { id: 'PLACEMENT', label: 'Order placed', hint: 'Cancellations claw back' },
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminApi.getSettings();
                const data = res.data?.result ?? res.data;
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        productApproval: normalizeProductApprovalConfig(data || {}),
                        keywords: Array.isArray(data.keywords) ? data.keywords : (data.metaKeywords ? data.metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []),
                        returnDeliveryCommission: data.returnDeliveryCommission ?? 0,
                    }));
                }
            } catch (error) {
                console.error("Failed to load settings", error);
                showToast('Failed to load settings', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [showToast]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = {
                ...settings,
                keywords: Array.isArray(settings.keywords) ? settings.keywords : (settings.metaKeywords ? settings.metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []),
            };
            const res = await adminApi.updateSettings(payload);
            const updatedData = res.data?.result ?? res.data;
            
            if (updatedData) {
                setSettings(prev => ({
                    ...prev,
                    ...updatedData,
                    productApproval: normalizeProductApprovalConfig(updatedData),
                }));
            }
            invalidateCache('/settings');
            await refetch({ forceRefresh: true });
            showToast('Settings updated successfully', 'success');
        } catch (error) {
            console.error("Failed to update settings", error);
            showToast('Failed to update settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleProductApprovalToggle = (field) => {
        setSettings((prev) => ({
            ...prev,
            productApproval: {
                ...(prev.productApproval || {}),
                [field]: !prev.productApproval?.[field],
            },
        }));
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file (PNG, JPG, etc.)', 'error');
            return;
        }
        setLogoUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'logo');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('logoUrl', url);
                showToast('Logo uploaded. Click Save Changes to apply.', 'success');
            } else throw new Error('No URL returned');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'Failed to upload logo', 'error');
        } finally {
            setLogoUploading(false);
            e.target.value = '';
        }
    };

    const handleFaviconUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file (PNG, ICO, etc.)', 'error');
            return;
        }
        setFaviconUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'favicon');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('faviconUrl', url);
                showToast('Favicon uploaded. Click Save Changes to apply.', 'success');
            } else throw new Error('No URL returned');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'Failed to upload favicon', 'error');
        } finally {
            setFaviconUploading(false);
            e.target.value = '';
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'serviceAreas', label: 'Service Areas', icon: MapPin },
        { id: 'express', label: 'Parcel Categories', icon: Package },
        { id: 'branding', label: 'Branding', icon: Globe },
        { id: 'legal', label: 'Legal & Contact', icon: Building2 },
        { id: 'social', label: 'Social & Apps', icon: Share2 },
        { id: 'seo', label: 'SEO & Meta', icon: Search },
        { id: 'coins', label: 'Athreya Coins', icon: Coins },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Platform Settings
                        <div className="p-2 bg-slate-100 rounded-xl">
                            <Settings className="h-5 w-5 text-slate-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage global configurations, branding, and legal information.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-8 py-4 bg-black text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-200 hover:shadow-brand-300 active:scale-95 active:shadow-inner",
                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-brand-700"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {isSaving ? 'Updating...' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-3 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                                activeTab === tab.id
                                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            )}
                        >
                            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-brand-600" : "text-slate-400")} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9 space-y-6">

                    {isLoading && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-8 flex items-center justify-center">
                                <div className="h-8 w-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                            </div>
                        </Card>
                    )}

                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    General Information
                                </h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Name</label>
                                    <input
                                        type="text"
                                        value={settings.appName}
                                        onChange={(e) => handleInputChange('appName', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="email"
                                            value={settings.supportEmail}
                                            onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Phone</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={settings.supportPhone}
                                            onChange={(e) => handleInputChange('supportPhone', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Order Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                        <input
                                            type="text"
                                            placeholder="e.g. 919876543210"
                                            value={settings.whatsappNumber || ''}
                                            onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Currency Symbol</label>
                                    <input
                                        type="text"
                                        value={settings.currencySymbol}
                                        onChange={(e) => handleInputChange('currencySymbol', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Auto Low Stock Alerts</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            Automatically notify sellers when any product stock drops to its low-stock threshold.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.lowStockAlertsEnabled}
                                        onClick={() => handleInputChange('lowStockAlertsEnabled', !settings.lowStockAlertsEnabled)}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200",
                                            settings.lowStockAlertsEnabled ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                settings.lowStockAlertsEnabled ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>
                                <div className="md:col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Require approval for new seller products</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            When enabled, newly added seller products remain hidden until approved by admin.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={Boolean(settings.productApproval?.sellerCreateRequiresApproval)}
                                        onClick={() => handleProductApprovalToggle('sellerCreateRequiresApproval')}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200",
                                            settings.productApproval?.sellerCreateRequiresApproval ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                settings.productApproval?.sellerCreateRequiresApproval ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>
                                <div className="md:col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Require approval for seller product edits</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            When enabled, seller changes to existing products remain hidden until approved by admin.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={Boolean(settings.productApproval?.sellerEditRequiresApproval)}
                                        onClick={() => handleProductApprovalToggle('sellerEditRequiresApproval')}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200",
                                            settings.productApproval?.sellerEditRequiresApproval ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                settings.productApproval?.sellerEditRequiresApproval ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Branding Settings */}
                    {activeTab === 'branding' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Visual Identity
                                </h3>
                            </div>
                            <div className="p-8 space-y-8">
                                <input type="file" ref={logoInputRef} accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                <input type="file" ref={faviconInputRef} accept="image/*" className="hidden" onChange={handleFaviconUpload} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Logo</label>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => !logoUploading && logoInputRef.current?.click()}
                                            onKeyDown={(e) => e.key === 'Enter' && !logoUploading && logoInputRef.current?.click()}
                                            className={cn(
                                                "h-40 w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden",
                                                settings.logoUrl ? "border-slate-200 bg-slate-50/50" : "border-slate-200 hover:border-brand-500/50 hover:bg-brand-50/10 cursor-pointer"
                                            )}
                                        >
                                            {logoUploading ? (
                                                <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
                                            ) : settings.logoUrl ? (
                                                <>
                                                    <img src={settings.logoUrl} alt="App logo" className="max-h-24 w-auto object-contain" />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-500">Click to replace</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleInputChange('logoUrl', ''); }} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600" title="Remove logo"><X className="h-4 w-4" /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Upload className="h-5 w-5 text-slate-400 group-hover:text-brand-600" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 group-hover:text-brand-600">Click to upload logo</span>
                                                </>
                                            )}
                                        </div>
                                        <input type="url" value={settings.logoUrl} onChange={(e) => handleInputChange('logoUrl', e.target.value)} placeholder="Or paste logo URL" className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Favicon</label>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => !faviconUploading && faviconInputRef.current?.click()}
                                            onKeyDown={(e) => e.key === 'Enter' && !faviconUploading && faviconInputRef.current?.click()}
                                            className={cn(
                                                "h-40 w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden",
                                                settings.faviconUrl ? "border-slate-200 bg-slate-50/50" : "border-slate-200 hover:border-brand-500/50 hover:bg-brand-50/10 cursor-pointer"
                                            )}
                                        >
                                            {faviconUploading ? (
                                                <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
                                            ) : settings.faviconUrl ? (
                                                <>
                                                    <img src={settings.faviconUrl} alt="Favicon" className="max-h-16 w-auto object-contain" />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-500">Click to replace</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleInputChange('faviconUrl', ''); }} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600" title="Remove favicon"><X className="h-4 w-4" /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Upload className="h-5 w-5 text-slate-400 group-hover:text-brand-600" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 group-hover:text-brand-600">Click to upload favicon</span>
                                                </>
                                            )}
                                        </div>
                                        <input type="url" value={settings.faviconUrl} onChange={(e) => handleInputChange('faviconUrl', e.target.value)} placeholder="Or paste favicon URL" className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Brand Color</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="color"
                                            value={settings.primaryColor}
                                            onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                            className="h-12 w-24 rounded-lg cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={settings.primaryColor}
                                            onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secondary Brand Color</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="color"
                                            value={settings.secondaryColor}
                                            onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                            className="h-12 w-24 rounded-lg cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={settings.secondaryColor}
                                            onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Legal Settings */}
                    {activeTab === 'legal' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Legal Entity & Contact
                                </h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Legal Name</label>
                                        <input
                                            type="text"
                                            value={settings.companyName}
                                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax ID / GSTIN / VAT</label>
                                        <div className="relative group">
                                            <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={settings.taxId}
                                                onChange={(e) => handleInputChange('taxId', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Office Address</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-5 top-6 h-4 w-4 text-slate-400" />
                                        <textarea
                                            rows={3}
                                            value={settings.address}
                                            onChange={(e) => handleInputChange('address', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Return delivery commission input moved to Fees & Charges → Delivery Fee Settings */}
                            </div>
                        </Card>
                    )}

                    {/* Social & Apps */}
                    {activeTab === 'social' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Social Media & App Links
                                </h3>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facebook URL</label>
                                        <div className="relative group">
                                            <Facebook className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                value={settings.facebook}
                                                onChange={(e) => handleInputChange('facebook', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Twitter / X URL</label>
                                        <div className="relative group">
                                            <Twitter className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500" />
                                            <input
                                                type="url"
                                                value={settings.twitter}
                                                onChange={(e) => handleInputChange('twitter', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instagram URL</label>
                                        <div className="relative group">
                                            <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-600" />
                                            <input
                                                type="url"
                                                value={settings.instagram}
                                                onChange={(e) => handleInputChange('instagram', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YouTube URL</label>
                                        <div className="relative group">
                                            <Youtube className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600" />
                                            <input
                                                type="url"
                                                value={settings.youtube}
                                                onChange={(e) => handleInputChange('youtube', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Play Store Link (Android)</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                value={settings.playStoreLink}
                                                onChange={(e) => handleInputChange('playStoreLink', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Store Link (iOS)</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-800" />
                                            <input
                                                type="url"
                                                value={settings.appStoreLink}
                                                onChange={(e) => handleInputChange('appStoreLink', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* SEO Settings */}
                    {activeTab === 'seo' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    SEO & Meta Information
                                </h3>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Meta Title</label>
                                    <input
                                        type="text"
                                        value={settings.metaTitle}
                                        onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Meta Description</label>
                                    <textarea
                                        rows={3}
                                        value={settings.metaDescription}
                                        onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic text-right">Recommended length: 150-160 characters</p>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Keywords</label>
                                    <input
                                        type="text"
                                        value={settings.metaKeywords}
                                        onChange={(e) => handleInputChange('metaKeywords', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        placeholder="keyword1, keyword2, keyword3"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic text-right">Separate keywords with commas</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Athreya Coins */}
                    {activeTab === 'coins' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <Coins className="h-4 w-4 text-amber-500" />
                                    Athreya Coins
                                </h3>
                                <p className="text-xs font-bold text-slate-500 mt-2">
                                    Customers earn coins on the savings of every delivered order and
                                    redeem them at checkout as a discount.
                                </p>
                            </div>

                            <div className="p-8 space-y-4">
                                {/* Enable / disable */}
                                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Enable Athreya Coins</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            When off, no new coins are earned and customers cannot redeem at
                                            checkout. Existing balances are preserved.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={Boolean(coins.enabled)}
                                        onClick={() => handleCoinChange('enabled', !coins.enabled)}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200",
                                            coins.enabled ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                coins.enabled ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>

                                {/* Conversion rate + earn rate */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Conversion Rate &mdash; coins per &#8377;1
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={coinsPerRupee}
                                            onChange={(e) => handleCoinsPerRupeeChange(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                        <p className="text-[10px] font-bold text-emerald-600">
                                            {coinsPerRupee} Coins = &#8377;1
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Coins Earned per &#8377;1 Saved
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            value={coins.coinsPerRupeeSaved ?? 1}
                                            onChange={(e) => handleCoinChange('coinsPerRupeeSaved', Number(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                        <p className="text-[10px] font-bold text-slate-400 italic">
                                            Savings are MRP minus price paid, plus any coupon discount.
                                        </p>
                                    </div>
                                </div>

                                {/* Live worked example — the quickest sanity check on a rate change */}
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                                        Worked Example
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 mt-2">
                                        A customer who saves <span className="font-black">&#8377;100</span> earns{' '}
                                        <span className="font-black text-emerald-700">{exampleCoins} coins</span>, worth{' '}
                                        <span className="font-black text-emerald-700">&#8377;{exampleValue}</span> at checkout.
                                    </p>
                                </div>

                                {/* Redemption limits */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Minimum Redemption (coins)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={coins.minRedeemCoins ?? 1}
                                            onChange={(e) => handleCoinChange('minRedeemCoins', Number(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Max % of Order Payable by Coins
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={coins.maxRedeemPercentOfOrder ?? 100}
                                            onChange={(e) => handleCoinChange('maxRedeemPercentOfOrder', Number(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Max Coins per Order (0 = no cap)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={coins.maxEarnPerOrder ?? 0}
                                            onChange={(e) => handleCoinChange('maxEarnPerOrder', Number(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* When coins are credited */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Credit Coins On
                                    </label>
                                    <div className="flex gap-3">
                                        {CREDIT_TRIGGERS.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleCoinChange('creditOn', option.id)}
                                                className={cn(
                                                    "flex-1 rounded-2xl border-2 px-4 py-3 text-left transition-all",
                                                    (coins.creditOn || 'DELIVERY') === option.id
                                                        ? "border-emerald-500 bg-emerald-50"
                                                        : "border-slate-200 bg-white hover:border-slate-300"
                                                )}
                                            >
                                                <p className="text-sm font-black text-slate-900">{option.label}</p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{option.hint}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <a
                                    href="/admin/coin-wallets"
                                    className="inline-flex items-center gap-2 text-xs font-black text-brand-600 uppercase tracking-widest hover:underline"
                                >
                                    View customer wallets &amp; transactions
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        </Card>
                    )}

                    {/* EXPRESS & PARCEL CATEGORIES TAB */}
                    {activeTab === 'express' && (
                        <div className="space-y-6">
                            {/* Parcel Item Categories */}
                            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                Parcel Details Categories (పార్సెల్ వివరాలు)
                                            </h2>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-500 mt-1">
                                            Items customers can pick from under "What are you sending?" (Documents, Clothes, Food, etc.)
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openAddCategory('parcel')}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#042A0F] text-[#A3E635] hover:bg-[#063A16] rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Add Category</span>
                                    </button>
                                </div>

                                {/* List Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(settings.parcelCategories || []).map((cat, idx) => (
                                        <div
                                            key={cat.id || idx}
                                            className={cn(
                                                "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 relative group",
                                                cat.enabled !== false
                                                    ? "bg-slate-50 border-slate-200 hover:border-emerald-300 hover:shadow-sm"
                                                    : "bg-slate-100/60 border-dashed border-slate-300 opacity-60"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-xs shrink-0">
                                                    {cat.icon || '📦'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-xs font-black text-slate-900 truncate">
                                                            {cat.label}
                                                        </h4>
                                                        {cat.enabled === false && (
                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                                                                Disabled
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                                                        {cat.telugu || `ID: ${cat.id}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    title={cat.enabled !== false ? "Disable" : "Enable"}
                                                    onClick={() => handleToggleCategoryItem('parcel', idx)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all border",
                                                        cat.enabled !== false
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                            : "bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300"
                                                    )}
                                                >
                                                    {cat.enabled !== false ? "✓" : "✕"}
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Edit Category"
                                                    onClick={() => openEditCategory('parcel', idx)}
                                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-all"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Delete Category"
                                                    onClick={() => handleDeleteCategoryItem('parcel', idx)}
                                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Rider Task Categories */}
                            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                                                <Bike className="h-5 w-5" />
                                            </div>
                                            <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                Rider Delivery Task Types (రైడర్ ఏ పని చేయాలి?)
                                            </h2>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-500 mt-1">
                                            Task options for Rider Delivery service (Keys, Documents, Tiffin, Errands, etc.)
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openAddCategory('rider')}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Add Task Type</span>
                                    </button>
                                </div>

                                {/* List Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(settings.riderTaskTypes || []).map((t, idx) => (
                                        <div
                                            key={t.id || idx}
                                            className={cn(
                                                "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 relative group",
                                                t.enabled !== false
                                                    ? "bg-slate-50 border-slate-200 hover:border-blue-300 hover:shadow-sm"
                                                    : "bg-slate-100/60 border-dashed border-slate-300 opacity-60"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-xs shrink-0">
                                                    {t.icon || '🛵'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-xs font-black text-slate-900 truncate">
                                                            {t.label}
                                                        </h4>
                                                        {t.enabled === false && (
                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                                                                Disabled
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                                                        {t.telugu || `ID: ${t.id}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    title={t.enabled !== false ? "Disable" : "Enable"}
                                                    onClick={() => handleToggleCategoryItem('rider', idx)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all border",
                                                        t.enabled !== false
                                                            ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                                            : "bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300"
                                                    )}
                                                >
                                                    {t.enabled !== false ? "✓" : "✕"}
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Edit Task"
                                                    onClick={() => openEditCategory('rider', idx)}
                                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-all"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Delete Task"
                                                    onClick={() => handleDeleteCategoryItem('rider', idx)}
                                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* SERVICE AREAS TAB */}
                    {activeTab === 'serviceAreas' && (
                        <div className="space-y-6">
                            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                    Service Area & Delivery Location Control
                                                </h2>
                                                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                                    (సర్వీస్ ప్రాంతాలు మరియు పిన్‌కోడ్‌లు)
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-xs font-medium text-slate-600 mt-2 max-w-2xl leading-relaxed">
                                            Control where Athreya Delivery is operational. Customers outside active areas/pincodes will see a friendly <strong>&quot;Coming Soon to your area&quot;</strong> notice and won&apos;t be able to place orders.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={openAddArea}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#042A0F] text-[#A3E635] hover:bg-[#063A16] rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Add Area / Pincode</span>
                                    </button>
                                </div>

                                {/* Status banner */}
                                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                                    <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                                    <div className="text-xs text-emerald-900 leading-relaxed font-medium">
                                        <strong>Active Service Coverage:</strong> {(settings.serviceAreas || []).filter(a => a.enabled !== false).length} active area(s) enabled out of {(settings.serviceAreas || []).length} total.
                                        {(settings.serviceAreas || []).length === 0 && (
                                            <span className="block mt-0.5 text-amber-800 font-semibold">
                                                ℹ️ No specific areas configured: Delivery is currently OPEN everywhere. Add at least one area to activate location restriction.
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* List Grid */}
                                {(!settings.serviceAreas || settings.serviceAreas.length === 0) ? (
                                    <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                                            <MapPin className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-700">No Service Areas Added Yet</h3>
                                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                            Click &quot;Add Area / Pincode&quot; above to specify villages, towns, or pincodes where delivery should be allowed.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={openAddArea}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add First Service Area
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {(settings.serviceAreas || []).map((area, idx) => (
                                            <div
                                                key={area.id || idx}
                                                className={cn(
                                                    "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative group",
                                                    area.enabled !== false
                                                        ? "bg-slate-50/70 border-slate-200 hover:border-emerald-300 hover:shadow-sm"
                                                        : "bg-slate-100/60 border-dashed border-slate-300 opacity-60"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center text-base shadow-xs shrink-0 font-bold",
                                                            area.enabled !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                                                        )}>
                                                            <MapPin className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <h4 className="text-xs font-black text-slate-900 truncate">
                                                                    {area.name || 'Unnamed Area'}
                                                                </h4>
                                                                {area.enabled === false ? (
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                                                                        Disabled
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {area.pincode && (
                                                                <p className="text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                                                                    PIN: {area.pincode}
                                                                </p>
                                                            )}
                                                            {(area.radiusKm > 0 || (area.note && area.note.match(/(\d+(?:\.\d+)?)\s*(?:km|kms)?/i))) && (
                                                                <div className="mt-1 flex items-center gap-1">
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                                                        🎯 Max Range: {area.radiusKm || area.note.match(/(\d+(?:\.\d+)?)\s*(?:km|kms)?/i)[1]} km
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {area.note && (
                                                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium">
                                                                    {area.note}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60 shrink-0">
                                                    <button
                                                        type="button"
                                                        title={area.enabled !== false ? "Disable Area" : "Enable Area"}
                                                        onClick={() => handleToggleArea(idx)}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all border",
                                                            area.enabled !== false
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                : "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300"
                                                        )}
                                                    >
                                                        {area.enabled !== false ? "Active" : "Off"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Edit Area"
                                                        onClick={() => openEditArea(idx)}
                                                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-all"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Delete Area"
                                                        onClick={() => handleDeleteArea(idx)}
                                                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* ADD / EDIT CATEGORY MODAL */}
            {categoryModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                    {categoryModal.editIndex !== null ? 'Edit' : 'Add New'} {categoryModal.type === 'parcel' ? 'Parcel Category' : 'Rider Task'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCategoryModal(prev => ({ ...prev, isOpen: false }))}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Icon / Emoji */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Icon / Emoji (e.g. 📄, 👕, 🍱, 📱, 📦, 🎁, 🛵)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={categoryModal.form.icon}
                                        onChange={(e) => setCategoryModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, icon: e.target.value }
                                        }))}
                                        placeholder="📦"
                                        className="w-16 text-center text-xl p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"
                                    />
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                        {['📄', '👕', '🍱', '📱', '📦', '✨', '🔑', '🛵', '🎁', '🛍️', '📚', '🔧'].map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setCategoryModal(prev => ({
                                                    ...prev,
                                                    form: { ...prev.form, icon: emoji }
                                                }))}
                                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm flex items-center justify-center transition-all"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* English Label */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    English Label <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={categoryModal.form.label}
                                    onChange={(e) => setCategoryModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, label: e.target.value }
                                    }))}
                                    placeholder="e.g. Clothes / Laundry"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Telugu Label */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Telugu Label (తెలుగు పేరు)
                                </label>
                                <input
                                    type="text"
                                    value={categoryModal.form.telugu}
                                    onChange={(e) => setCategoryModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, telugu: e.target.value }
                                    }))}
                                    placeholder="e.g. బట్టలు"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Unique ID / Key */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Category ID (Unique key)
                                </label>
                                <input
                                    type="text"
                                    value={categoryModal.form.id}
                                    onChange={(e) => setCategoryModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, id: e.target.value }
                                    }))}
                                    placeholder="e.g. clothes"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate from English label.</p>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="cat_enabled"
                                    checked={categoryModal.form.enabled !== false}
                                    onChange={(e) => setCategoryModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, enabled: e.target.checked }
                                    }))}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="cat_enabled" className="text-xs font-bold text-slate-700 cursor-pointer">
                                    Enabled (Active for customers)
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCategoryModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCategoryItem}
                                className="px-5 py-2 bg-[#042A0F] hover:bg-[#063A16] text-[#A3E635] rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                            >
                                {categoryModal.editIndex !== null ? 'Apply Changes' : 'Add Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ADD / EDIT SERVICE AREA MODAL */}
            {areaModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                    {areaModal.editIndex !== null ? 'Edit Service Area' : 'Add New Service Area'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAreaModal(prev => ({ ...prev, isOpen: false }))}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Area / Town / Village Name */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Area / Village / City Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={areaModal.form.name}
                                    onChange={(e) => setAreaModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, name: e.target.value }
                                    }))}
                                    placeholder="e.g. Madanapalle, Angallu, Punganur"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Matched case-insensitively against customer delivery address or city.</p>
                            </div>

                            {/* Pincode */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Postal Pincode (Optional / Recommended)
                                </label>
                                <input
                                    type="text"
                                    value={areaModal.form.pincode}
                                    onChange={(e) => setAreaModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, pincode: e.target.value }
                                    }))}
                                    placeholder="e.g. 517325 or 453112"
                                    maxLength={6}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 font-mono"
                                />
                            </div>

                            {/* Max Delivery Radius (in km) */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Maximum Delivery Range / Radius (in km)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="0.5"
                                        value={areaModal.form.radiusKm}
                                        onChange={(e) => setAreaModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, radiusKm: e.target.value }
                                        }))}
                                        placeholder="e.g. 11"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">km</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Orders placed further than this distance from the store/area center will be blocked.</p>
                            </div>

                            {/* Note / Details */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Description / Coverage Note (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={areaModal.form.note}
                                    onChange={(e) => setAreaModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, note: e.target.value }
                                    }))}
                                    placeholder="e.g. Town limits & nearby 5km villages"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="area_enabled"
                                    checked={areaModal.form.enabled !== false}
                                    onChange={(e) => setAreaModal(prev => ({
                                        ...prev,
                                        form: { ...prev.form, enabled: e.target.checked }
                                    }))}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="area_enabled" className="text-xs font-bold text-slate-700 cursor-pointer">
                                    Active (Allow orders in this area)
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setAreaModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveArea}
                                className="px-5 py-2 bg-[#042A0F] hover:bg-[#063A16] text-[#A3E635] rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                            >
                                {areaModal.editIndex !== null ? 'Apply Changes' : 'Add Area'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;

