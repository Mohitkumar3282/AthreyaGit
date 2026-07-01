import mongoose from "mongoose";
import Seller from "../models/seller.js";
import Product from "../models/product.js";
import Review from "../models/review.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";

// Helper for Mock Sellers
const getMockSeller = (id) => {
  const isMock2 = id === "mock-2";
  return {
    _id: id,
    name: isMock2 ? "Fruits & Veggies Vendor" : "Kirana Shop Owner",
    shopName: isMock2 ? "Fresh Vegetables & Fruits" : "Indore Fresh Kirana",
    email: isMock2 ? "fruits@athreya.com" : "kirana@athreya.com",
    phone: isMock2 ? "9876543211" : "9876543210",
    category: isMock2 ? "Vegetables" : "Grocery",
    description: isMock2 ? "Fresh direct-from-farm organic fruits and vegetables." : "All your daily grocery needs, grocery items, spices, pulses, grains and household cleaning essentials.",
    shopBanner: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
    shopLogo: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=200",
    shopGallery: [
      "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400"
    ],
    storeFrontImage: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=400",
    storeInteriorImages: [
      "https://images.unsplash.com/photo-1583258292688-d0213df4a3a8?auto=format&fit=crop&q=80&w=400"
    ],
    businessDescription: isMock2 ? "Fresh organic vegetables and farm fruits." : "Your trusted neighborhood Kirana store.",
    storeTimings: "8:00 AM - 9:00 PM",
    contactNumber: isMock2 ? "9876543211" : "9876543210",
    minimumOrderAmount: 99,
    deliveryFee: 25,
    freeDeliveryAbove: 300,
    hygieneAssured: true,
    rating: isMock2 ? 4.5 : 4.6,
    reviewCount: 28,
    isOpen: true,
    isActive: true,
    isVerified: true,
    role: "seller",
    location: {
      type: "Point",
      coordinates: [75.9001552518043, 22.711140989838025]
    },
    serviceRadius: 10,
    address: " Corporate House, Film Colony, South Tukoganj, Indore, Madhya Pradesh 452001",
    locality: "South Tukoganj",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452001"
  };
};

const getMockProducts = (id) => {
  const isMock2 = id === "mock-2";
  if (isMock2) {
    return [
      {
        _id: "p-veg1",
        name: "Fresh Tomatoes",
        salePrice: 40,
        price: 50,
        weight: "1 kg",
        mainImage: "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&q=80&w=400",
        category: "Vegetables",
        status: "active"
      },
      {
        _id: "p-veg2",
        name: "Organic Bananas",
        salePrice: 60,
        price: 70,
        weight: "1 dozen",
        mainImage: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=400",
        category: "Fruits",
        status: "active"
      }
    ];
  } else {
    return [
      {
        _id: "p-g1",
        name: "Fortune Sunflower Oil",
        salePrice: 145,
        price: 175,
        weight: "1 L",
        mainImage: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=400",
        category: "Grocery",
        status: "active"
      },
      {
        _id: "p-g2",
        name: "Aashirvaad Shudh Chakki Atta",
        salePrice: 260,
        price: 290,
        weight: "5 kg",
        mainImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400",
        category: "Grocery",
        status: "active"
      }
    ];
  }
};

/* ===============================
   GET SHOP BY ID
   ================================ */
export const getShopById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (id.startsWith("mock-")) {
        return handleResponse(res, 200, "Shop details retrieved successfully", getMockSeller(id));
      }
      return handleResponse(res, 404, "Shop not found");
    }

    const seller = await Seller.findOne({ _id: id, isActive: true, isOpen: true, isVerified: true });
    
    if (!seller) {
      return handleResponse(res, 404, "Shop not found");
    }

    return handleResponse(res, 200, "Shop details retrieved successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SHOP PRODUCTS
   ================================ */
export const getShopProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, category, isFeatured, limit = 40, page = 1 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (id.startsWith("mock-")) {
        const mockProds = getMockProducts(id);
        return handleResponse(res, 200, "Shop products fetched successfully", {
          items: mockProds.map(p => ({
            ...p,
            id: p._id,
            image: p.mainImage,
            price: p.salePrice,
            originalPrice: p.price,
            weight: p.weight,
            deliveryTime: "8-15 mins"
          })),
          total: mockProds.length,
          page: 1,
          totalPages: 1
        });
      }
      return handleResponse(res, 404, "Shop not found");
    }

    const seller = await Seller.findOne({ _id: id, isActive: true, isOpen: true, isVerified: true }).lean();
    if (!seller) {
      return handleResponse(res, 404, "Shop not found or currently offline");
    }

    const query = { sellerId: id, status: "active" };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (category && category !== "all" && category !== "All") {
      query.$or = [
        { category: category },
        { categoryId: category }
      ];
    }

    if (isFeatured === "true") {
      query.isFeatured = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    const formatted = products.map(p => ({
      ...p,
      id: p._id,
      image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
      price: p.salePrice || p.price,
      originalPrice: p.price,
      weight: p.weight || "1 unit",
      deliveryTime: "8-15 mins"
    }));

    return handleResponse(res, 200, "Shop products fetched successfully", {
      items: formatted,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)) || 1
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SHOP REVIEWS
   ================================ */
export const getShopReviews = async (req, res) => {
  try {
    const { id } = req.params;

    const mockReviews = [
      {
        _id: "mock-r1",
        userId: { name: "Ananya Sharma", profileImage: "" },
        rating: 5,
        comment: "Excellent service! The items were extremely fresh and delivered well within 15 minutes.",
        createdAt: new Date(Date.now() - 2 * 3600000)
      },
      {
        _id: "mock-r2",
        userId: { name: "Rahul Verma", profileImage: "" },
        rating: 4,
        comment: "Great experience ordering from here. The packaging was neat and complete.",
        createdAt: new Date(Date.now() - 24 * 3600000)
      },
      {
        _id: "mock-r3",
        userId: { name: "Priya Patel", profileImage: "" },
        rating: 5,
        comment: "Highly recommended for last-minute orders. Everything was intact.",
        createdAt: new Date(Date.now() - 3 * 24 * 3600000)
      }
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (id.startsWith("mock-")) {
        return handleResponse(res, 200, "Shop reviews fetched successfully", mockReviews);
      }
      return handleResponse(res, 404, "Shop not found");
    }
    
    const seller = await Seller.findById(id);
    if (!seller) {
      return handleResponse(res, 404, "Shop not found");
    }

    const products = await Product.find({ sellerId: id }).select("_id").lean();
    const productIds = products.map(p => p._id);

    const dbReviews = await Review.find({ productId: { $in: productIds }, status: "approved" })
      .populate("userId", "name profileImage")
      .populate("productId", "name")
      .sort({ createdAt: -1 })
      .lean();

    const finalReviews = dbReviews.length > 0 ? dbReviews : mockReviews;

    return handleResponse(res, 200, "Shop reviews fetched successfully", finalReviews);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SHOP GALLERY
   ================================ */
export const getShopGallery = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (id.startsWith("mock-")) {
        const ms = getMockSeller(id);
        return handleResponse(res, 200, "Shop gallery fetched successfully", {
          storeFrontImage: ms.storeFrontImage,
          storeInteriorImages: ms.storeInteriorImages,
          shopGallery: ms.shopGallery
        });
      }
      return handleResponse(res, 404, "Shop not found");
    }

    const seller = await Seller.findById(id).select("shopGallery storeFrontImage storeInteriorImages").lean();
    
    if (!seller) {
      return handleResponse(res, 404, "Shop not found");
    }

    const gallery = {
      storeFrontImage: seller.storeFrontImage || "",
      storeInteriorImages: seller.storeInteriorImages || [],
      shopGallery: seller.shopGallery || []
    };

    return handleResponse(res, 200, "Shop gallery fetched successfully", gallery);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SIMILAR SHOPS
   ================================ */
export const getSimilarShops = async (req, res) => {
  try {
    const { id } = req.params;

    let category = "Grocery";
    let locationCoords = [75.9001552518043, 22.711140989838025];

    if (mongoose.Types.ObjectId.isValid(id)) {
      const currentSeller = await Seller.findById(id).lean();
      if (!currentSeller) {
        return handleResponse(res, 404, "Shop not found");
      }
      category = currentSeller.category;
      if (currentSeller.location?.coordinates) {
        locationCoords = currentSeller.location.coordinates;
      }
    } else if (id.startsWith("mock-")) {
      const ms = getMockSeller(id);
      category = ms.category;
    } else {
      return handleResponse(res, 404, "Shop not found");
    }

    const query = {
      _id: { $ne: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null },
      category: category,
      isActive: true,
      isOpen: true,
      isVerified: true
    };

    const similarSellers = await Seller.find(query).limit(10).lean();

    const customerLng = locationCoords[0];
    const customerLat = locationCoords[1];

    const formatted = similarSellers.map(seller => {
      const sellerLng = seller.location?.coordinates?.[0] || 75.9001552518043;
      const sellerLat = seller.location?.coordinates?.[1] || 22.711140989838025;
      const distance = calculateDistance(
        customerLat,
        customerLng,
        sellerLat,
        sellerLng
      );
      return {
        ...seller,
        distance
      };
    });

    // If no real similar shops exist in category, return the other mock seller as fallback
    if (formatted.length === 0) {
      const alternateMockId = id === "mock-1" ? "mock-2" : "mock-1";
      formatted.push({
        ...getMockSeller(alternateMockId),
        distance: 1.5
      });
    }

    return handleResponse(res, 200, "Similar shops fetched successfully", formatted);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
