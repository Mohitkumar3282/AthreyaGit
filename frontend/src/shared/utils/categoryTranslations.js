const TELUGU_TRANSLATIONS = {
  "water can": "వాటర్ క్యాన్",
  "watercan": "వాటర్ క్యాన్",
  "milk": "పాలు",
  "tiffin": "టిఫిన్స్",
  "tiffins": "టిఫిన్స్",
  "tiffin's": "టిఫిన్స్",
  "breakfast": "టిఫిన్స్",
  "restaurant": "రెస్టారెంట్",
  "restaurants": "రెస్టారెంట్",
  "vegetable": "కూరగాయలు",
  "vegetables": "కూరగాయలు",
  "vegetable's": "కూరగాయలు",
  "fruit": "పండ్లు",
  "fruits": "పండ్లు",
  "fruit's": "పండ్లు",
  "chicken": "చికెన్",
  "chiken": "చికెన్",
  "chiken's": "చికెన్",
  "chicken's": "చికెన్",
  "food": "ఆహారం",
  "cookware": "వంట పాత్రలు",
  "meat": "మాంసం",
  "mutton": "మాంసం",
  "grocery": "కిరాణా",
  "groceries": "కిరాణా",
  "kirana": "కిరాణా",
  "sea food": "సముద్ర ఆహారం",
  "seafood": "సముద్ర ఆహారం",
  "bakery": "బేకరీ",
  "snacks": "స్నాక్స్",
  "snack": "స్నాక్స్",
  "tea & coffee": "టీ & కాఫీ",
  "tea": "టీ & కాఫీ",
  "coffee": "టీ & కాఫీ",
  "pharmacy": "మెడిసిన్",
  "medicine": "మెడిసిన్",
  "flowers": "పూలు",
  "electronics": "ఎలక్ట్రానిక్స్",
  "stationery": "స్టేషనరీ",
  "pets": "పెట్స్",
  "home needs": "హోమ్ నీడ్స్",
  "baby care": "బేబీ కేర్",
  "fashion": "ఫ్యాషన్",
  "more": "మరిన్ని",
};

export const getTeluguCategoryName = (name) => {
  if (!name) return "";
  const cleanName = name.trim().toLowerCase();

  // Direct match
  if (TELUGU_TRANSLATIONS[cleanName]) return TELUGU_TRANSLATIONS[cleanName];

  // Regex / Partial keyword match
  if (cleanName.includes("tiffin") || cleanName.includes("breakfast")) return "టిఫిన్స్";
  if (cleanName.includes("vegetable")) return "కూరగాయలు";
  if (cleanName.includes("fruit")) return "పండ్లు";
  if (cleanName.includes("chicken") || cleanName.includes("chiken")) return "చికెన్";
  if (cleanName.includes("meat") || cleanName.includes("mutton")) return "మాంసం";
  if (cleanName.includes("milk")) return "పాలు";
  if (cleanName.includes("water")) return "వాటర్ క్యాన్";
  if (cleanName.includes("grocery") || cleanName.includes("kirana")) return "కిరాణా";
  if (cleanName.includes("bakery")) return "బేకరీ";
  if (cleanName.includes("snack")) return "స్నాక్స్";
  if (cleanName.includes("restaurant") || cleanName.includes("food")) return "రెస్టారెంట్";

  return "";
};
