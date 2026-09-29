// Static UI-text dictionary for the app-wide language toggle (English/Telugu).
// Covers navigation, headers and common actions across all four apps
// (customer, rider/delivery, seller, admin). Dynamic content (product
// names, descriptions, shop names — text an admin/seller typed in, not
// hardcoded UI copy) is NOT here; that goes through the backend
// google-translate-api-x pipeline via <Translated /> instead, since it
// can't be known ahead of time.
//
// Extend this file whenever a new static string needs a Telugu counterpart —
// missing keys fall back to the English value automatically (see
// LanguageContext.t()).

export const DEFAULT_LANGUAGE = "en";

// Languages offered in the app-wide language dropdown. `label` is the
// English name (used as a fallback), `native` is shown in the menu itself.
// Only "en" and "te" have a curated static DICTIONARY below — the rest
// still get full dynamic-content translation (product/shop names etc. via
// <Translated />) but static UI chrome falls back to English for them
// until entries are added here. Extend DICTIONARY to give a language full
// static-text coverage.
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

export const DICTIONARY = {
  en: {
    // Common nav (customer)
    home: "Home",
    wallet: "Wallet",
    category: "Category",
    categories: "Categories",
    orders: "Orders",
    profile: "Profile",
    cart: "Cart",
    search: "Search",
    checkout: "Checkout",
    trackOrder: "Track Order",
    addToCart: "Add to Cart",
    language: "Language",
    myOrders: "My Orders",
    offers: "Offers",
    shops: "Shops",
    notifications: "Notifications",

    // Rider (delivery) app
    earnings: "Earnings",
    history: "History",
    dashboard: "Dashboard",
    goOnline: "Go Online",
    goOffline: "Go Offline",
    accept: "Accept",
    reject: "Reject",
    navigate: "Navigate",
    pickup: "Pickup",
    drop: "Drop",
    performance: "Performance",

    // Seller app
    products: "Products",
    stock: "Stock",
    withdrawals: "Withdrawals",
    transactions: "Transactions",
    shopOpen: "Online",
    shopClosed: "Offline",

    // Admin panel
    settings: "Settings",
    customers: "Customers",
    sellers: "Sellers",
    deliveryPartners: "Delivery Partners",
    reports: "Reports",

    // Generic actions
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    signOut: "Sign Out",
    login: "Login",
    logout: "Logout",
    submit: "Submit",
    confirm: "Confirm",
    back: "Back",
    loading: "Loading...",
  },
  te: {
    home: "హోమ్",
    wallet: "వాలెట్",
    category: "కేటగిరీ",
    categories: "కేటగిరీలు",
    orders: "ఆర్డర్లు",
    profile: "ప్రొఫైల్",
    cart: "కార్ట్",
    search: "వెతకండి",
    checkout: "చెక్అవుట్",
    trackOrder: "ఆర్డర్ ట్రాక్ చేయండి",
    addToCart: "కార్ట్‌కి జోడించండి",
    language: "భాష",
    myOrders: "నా ఆర్డర్లు",
    offers: "ఆఫర్లు",
    shops: "షాపులు",
    notifications: "నోటిఫికేషన్లు",

    earnings: "సంపాదన",
    history: "చరిత్ర",
    dashboard: "డాష్‌బోర్డ్",
    goOnline: "ఆన్‌లైన్‌కి వెళ్ళండి",
    goOffline: "ఆఫ్‌లైన్‌కి వెళ్ళండి",
    accept: "అంగీకరించండి",
    reject: "తిరస్కరించండి",
    navigate: "నావిగేట్ చేయండి",
    pickup: "పికప్",
    drop: "డ్రాప్",
    performance: "పనితీరు",

    products: "ఉత్పత్తులు",
    stock: "స్టాక్",
    withdrawals: "విత్‌డ్రావల్స్",
    transactions: "లావాదేవీలు",
    shopOpen: "ఆన్‌లైన్",
    shopClosed: "ఆఫ్‌లైన్",

    settings: "సెట్టింగులు",
    customers: "కస్టమర్లు",
    sellers: "అమ్మకందారులు",
    deliveryPartners: "డెలివరీ భాగస్వాములు",
    reports: "నివేదికలు",

    save: "సేవ్ చేయండి",
    cancel: "రద్దు చేయండి",
    edit: "సవరించండి",
    delete: "తొలగించండి",
    add: "జోడించండి",
    signOut: "సైన్ అవుట్",
    login: "లాగిన్",
    logout: "లాగ్అవుట్",
    submit: "సమర్పించండి",
    confirm: "నిర్ధారించండి",
    back: "వెనుకకు",
    loading: "లోడ్ అవుతోంది...",
  },
};
