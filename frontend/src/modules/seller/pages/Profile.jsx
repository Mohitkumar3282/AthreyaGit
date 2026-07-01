import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  CheckCircle,
  Camera,
  Trash2,
  Plus,
  Clock,
  FileText,
  Check,
  DollarSign,
  Image
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";

const SellerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  
  const [formData, setFormData] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
    category: "",
    businessDescription: "",
    shopBanner: "",
    shopLogo: "",
    shopGallery: [],
    storeFrontImage: "",
    storeInteriorImages: [],
    storeTimings: "9:00 AM - 10:00 PM",
    contactNumber: "",
    minimumOrderAmount: 0,
    deliveryFee: 30,
    freeDeliveryAbove: 499,
    hygieneAssured: false,
    isOpen: true,
  });

  useEffect(() => {
    fetchProfile();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await sellerApi.getCategories();
      setCategoriesList(response.data.result || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
        name: data.name || "",
        shopName: data.shopName || "",
        phone: data.phone || "",
        email: data.email || "",
        lat: data.location?.coordinates[1] || null,
        lng: data.location?.coordinates[0] || null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
        category: data.category || "",
        businessDescription: data.businessDescription || "",
        shopBanner: data.shopBanner || "",
        shopLogo: data.shopLogo || "",
        shopGallery: data.shopGallery || [],
        storeFrontImage: data.storeFrontImage || "",
        storeInteriorImages: data.storeInteriorImages || [],
        storeTimings: data.storeTimings || "9:00 AM - 10:00 PM",
        contactNumber: data.contactNumber || "",
        minimumOrderAmount: data.minimumOrderAmount || 0,
        deliveryFee: data.deliveryFee || 30,
        freeDeliveryAbove: data.freeDeliveryAbove || 499,
        hygieneAssured: data.hygieneAssured || false,
        isOpen: data.isOpen !== undefined ? data.isOpen : true,
      });
    } catch (error) {
      toast.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "name") {
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData((prev) => ({ ...prev, [name]: cleaned }));
    } else if (name === "phone" || name === "contactNumber") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData((prev) => ({ ...prev, [name]: digitsOnly }));
    } else if (name === "email") {
      setFormData((prev) => ({ ...prev, [name]: value.trimStart() }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageUpload = async (e, fieldName, isArray = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const toastId = toast.loading("Uploading image...");
    try {
      const response = await sellerApi.uploadMedia(uploadForm);
      const url = response.data.result.secureUrl;
      toast.success("Image uploaded successfully", { id: toastId });

      if (isArray) {
        setFormData((prev) => {
          const currentList = prev[fieldName] || [];
          if (fieldName === "shopGallery" && currentList.length >= 8) {
            toast.error("Maximum 8 gallery images allowed");
            return prev;
          }
          return {
            ...prev,
            [fieldName]: [...currentList, url],
          };
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          [fieldName]: url,
        }));
      }
    } catch (error) {
      toast.error("Failed to upload image", { id: toastId });
    }
  };

  const removeArrayImage = (fieldName, index) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSaving(true);
    try {
      await sellerApi.updateProfile(formData);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = !profile.isActive;
      await sellerApi.updateProfile({ isActive: newStatus });
      setProfile((prev) => ({ ...prev, isActive: newStatus }));
      toast.success(`Shop is now ${newStatus ? "Active" : "Inactive"}`);
    } catch (error) {
      toast.error("Failed to update shop status");
    }
  };

  const toggleOpenStatus = async () => {
    try {
      const newOpenStatus = !formData.isOpen;
      setFormData((prev) => ({ ...prev, isOpen: newOpenStatus }));
      await sellerApi.updateProfile({ isOpen: newOpenStatus });
      toast.success(`Shop is now ${newOpenStatus ? "Open" : "Closed"}`);
    } catch (error) {
      toast.error("Failed to update store opening status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-['Outfit'] space-y-8">
      {/* Header Section */}
      <div className="relative mb-24 px-4">
        {/* Banner Background */}
        <div 
          className="bg-cover bg-center h-64 rounded-lg shadow-2xl relative overflow-hidden group"
          style={{ 
            backgroundImage: formData.shopBanner ? `url(${formData.shopBanner})` : 'linear-gradient(to right, #0f172a, #020617, #000000)' 
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          {isEditing && (
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity">
              <Camera size={32} />
              <span className="text-xs font-bold uppercase mt-2 tracking-wider">Change Shop Banner</span>
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "shopBanner")} />
            </label>
          )}
        </div>

        {/* Profile Info Row */}
        <div className="absolute bottom-8 left-4 right-4 md:left-8 md:right-8 lg:left-12 lg:right-12 grid grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)_auto] items-center md:items-end gap-6 md:gap-8">
          {/* Avatar Container */}
          <div className="h-44 w-44 rounded-full bg-white p-2 shadow-[0_30px_70px_rgba(0,0,0,0.15)] flex-shrink-0 mx-auto md:mx-0 relative group">
            <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-50 overflow-hidden">
              {formData.shopLogo ? (
                <img src={formData.shopLogo} alt="Shop Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-7xl font-black text-slate-900">
                  {profile?.name?.charAt(0)}
                </span>
              )}
            </div>
            {isEditing && (
              <label className="absolute inset-2 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity">
                <Camera size={24} />
                <span className="text-[10px] font-bold uppercase mt-1 tracking-wider">Change Logo</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "shopLogo")} />
              </label>
            )}
          </div>

          {/* Info Block */}
          <div className="min-w-0 pb-2 md:pb-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-3">
              <span className="px-4 py-1.5 bg-white/10 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[2px] rounded-full border border-white/20">
                {profile?.role}
              </span>
              <button
                onClick={toggleStatus}
                className={`group flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-[2px] rounded-full border transition-all hover:scale-105 active:scale-95 ${
                  profile?.isActive
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    : "bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                }`}>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    profile?.isActive ? "bg-emerald-200" : "bg-rose-200"
                  }`}
                />
                {profile?.isActive ? "Active" : "Inactive"}
              </button>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter drop-shadow-sm mb-1 break-words">
              {profile?.name}
            </h1>
            <p className="text-white/60 font-black tracking-[1px] text-lg">
              {profile?.shopName}
            </p>
          </div>

          {/* Action Button */}
          <div className="pb-2 md:pb-4 w-full md:w-auto">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white hover:text-slate-950 transition-all rounded-lg px-6 lg:px-12 py-4 md:py-5 flex items-center justify-center gap-3 md:gap-4 font-black tracking-[2px] md:tracking-[3px] text-xs shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-[1.03] active:scale-[0.95] whitespace-nowrap">
                <Edit2 size={18} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="w-full md:w-auto flex gap-3 md:gap-4 justify-center md:justify-end">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-[64px] w-[64px] flex items-center justify-center bg-white/5 text-white border border-white/20 hover:bg-white hover:text-slate-900 rounded-lg shadow-lg transition-all backdrop-blur-md">
                  <X size={24} className="stroke-[2.5]" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="min-w-0 max-w-full bg-white text-slate-950 hover:bg-slate-100 rounded-lg px-5 md:px-8 lg:px-12 py-4 md:py-5 font-black tracking-[2px] md:tracking-[3px] text-xs flex items-center gap-3 md:gap-4 shadow-[0_25px_50px_rgba(0,0,0,0.15)] h-[64px] whitespace-nowrap">
                  {isSaving ? (
                    "UPDATING..."
                  ) : (
                    <>
                      <Save size={20} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Info Columns */}
        <div className="md:col-span-2 space-y-8">
          {/* Business Profile Details */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <h3 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">
              Business Profile
            </h3>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={true}
                      className="w-full pl-14 pr-6 py-4 bg-slate-100 border-2 border-transparent rounded-lg text-sm font-bold text-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Shop Category
                  </label>
                  <div className="relative group">
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    >
                      <option value="">Select Category</option>
                      {categoriesList.map((cat) => (
                        <option key={cat._id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store timings
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Clock size={18} />
                    </div>
                    <input
                      type="text"
                      name="storeTimings"
                      placeholder="e.g. 9:00 AM - 10:00 PM"
                      value={formData.storeTimings}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                  Business Description
                </label>
                <div className="relative group">
                  <textarea
                    name="businessDescription"
                    rows={4}
                    value={formData.businessDescription}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Describe your business, offerings, specialties..."
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70 resize-none"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery & Fee Configurations */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <h3 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">
              Order & Delivery Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                  Min Order Amount (₹)
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                    <DollarSign size={16} />
                  </div>
                  <input
                    type="number"
                    name="minimumOrderAmount"
                    value={formData.minimumOrderAmount}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                  Delivery Fee (₹)
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                    <DollarSign size={16} />
                  </div>
                  <input
                    type="number"
                    name="deliveryFee"
                    value={formData.deliveryFee}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                  Free Delivery Above (₹)
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                    <DollarSign size={16} />
                  </div>
                  <input
                    type="number"
                    name="freeDeliveryAbove"
                    value={formData.freeDeliveryAbove}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <Shield className="text-emerald-600" size={20} />
                <div>
                  <h4 className="text-sm font-black text-emerald-950">Hygiene Assured Badge</h4>
                  <p className="text-xs text-emerald-700">Display the safety & hygiene certification badge to customers.</p>
                </div>
              </div>
              <input
                type="checkbox"
                name="hygieneAssured"
                checked={formData.hygieneAssured}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer disabled:opacity-50"
              />
            </div>
          </Card>

          {/* Visuals, Front, Interior and Gallery uploads */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg space-y-8">
            <h3 className="text-xl font-black text-slate-900 border-b border-slate-50 pb-4">
              Store Media & Gallery
            </h3>

            {/* Store Front Image */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-slate-600 block">
                Store Front Image (Showcases physical shop location)
              </label>
              <div className="flex items-center gap-6">
                <div className="relative w-36 h-24 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {formData.storeFrontImage ? (
                    <img src={formData.storeFrontImage} alt="Store Front" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={24} className="text-slate-400" />
                  )}
                  {isEditing && formData.storeFrontImage && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, storeFrontImage: "" }))}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <label className="px-6 py-3 bg-slate-900 text-white text-xs font-black tracking-widest rounded-lg cursor-pointer hover:bg-black uppercase transition-all">
                    Upload image
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "storeFrontImage")} />
                  </label>
                )}
              </div>
            </div>

            {/* Store Interior Images */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-slate-600 block">
                Store Interior Images (Inside layouts & shelves)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(formData.storeInteriorImages || []).map((img, idx) => (
                  <div key={idx} className="relative aspect-video rounded-lg bg-slate-100 border border-slate-200 overflow-hidden group">
                    <img src={img} alt={`Interior ${idx + 1}`} className="w-full h-full object-cover" />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeArrayImage("storeInteriorImages", idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <label className="aspect-video rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer transition-all">
                    <Plus size={24} />
                    <span className="text-[10px] font-black uppercase tracking-wider mt-1">Add Image</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "storeInteriorImages", true)} />
                  </label>
                )}
              </div>
            </div>

            {/* Shop Gallery Images */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600">
                  Shop Gallery (Max 8 promotional or category images)
                </label>
                <span className="text-xs text-slate-400 font-bold">
                  {(formData.shopGallery || []).length}/8
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(formData.shopGallery || []).map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden group">
                    <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeArrayImage("shopGallery", idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isEditing && (formData.shopGallery || []).length < 8 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer transition-all">
                    <Plus size={24} />
                    <span className="text-[10px] font-black uppercase tracking-wider mt-1">Add Image</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "shopGallery", true)} />
                  </label>
                )}
              </div>
            </div>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                Location & Service Settings
              </h3>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100/50 space-y-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                        formData.lat
                          ? "bg-emerald-100 text-emerald-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)]"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                {formData.lat && (
                  <div className="pt-6 border-t border-slate-200/60 flex flex-wrap gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Service Radius
                      </span>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <input
                            type="number"
                            name="radius"
                            value={formData.radius}
                            onChange={handleChange}
                            className="w-20 px-3 py-1.5 bg-white border rounded text-sm font-bold text-slate-700 outline-none"
                          />
                        ) : (
                          <span className="text-lg font-black text-slate-900">
                            {formData.radius}
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                          KM
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Latitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Longitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location and service radius determine which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Card */}
        <div className="space-y-8">
          {/* Shop Opening Hours / Open State Toggle */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg bg-slate-50">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-6">
              Shop Status Settings
            </h4>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">
                    Shop Display State
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {formData.isOpen ? "Accepting Orders" : "Closed / Pause"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleOpenStatus}
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${formData.isOpen ? 'left-6.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[40px] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 mb-6">
              Security & Trust
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Verification
                  </p>
                  <p className="text-sm font-bold">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Rocket size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Partner Tier
                  </p>
                  <p className="text-sm font-bold">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Region
                  </p>
                  <p className="text-sm font-bold">Pan India Reach</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}
    </div>
  );
};

export default SellerProfile;
