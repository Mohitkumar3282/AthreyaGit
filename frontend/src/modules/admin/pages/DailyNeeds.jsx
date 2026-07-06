import React, { useState, useEffect, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import Pagination from "@shared/components/ui/Pagination";
import { toast } from "sonner";
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineArrowPath,
  HiOutlineTag,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";

const DailyNeeds = () => {
  const [allCategories, setAllCategories] = useState([]);
  const [dailyNeedsCategoryIds, setDailyNeedsCategoryIds] = useState([]);
  
  // Active selected category in the list for showing product preview
  const [activeCategoryId, setActiveCategoryId] = useState("");
  
  // Products currently in the active category (for preview)
  const [previewProducts, setPreviewProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryIdToAdd, setNewCategoryIdToAdd] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Filter categories to only type = "category"
  const categoriesList = useMemo(() => {
    return allCategories.filter(c => c.type === "category");
  }, [allCategories]);

  // Categories currently mapped in Daily Needs
  const mappedCategories = useMemo(() => {
    return dailyNeedsCategoryIds
      .map(id => categoriesList.find(c => (c._id || c.id) === id))
      .filter(Boolean);
  }, [dailyNeedsCategoryIds, categoriesList]);

  // Available categories that can be added (not already added)
  const availableCategoriesToAdd = useMemo(() => {
    return categoriesList.filter(c => !dailyNeedsCategoryIds.includes(c._id || c.id));
  }, [categoriesList, dailyNeedsCategoryIds]);

  // Load platform settings & category list
  const loadSettingsAndCategories = async () => {
    try {
      // 1. Fetch categories
      const catRes = await adminApi.getCategories();
      if (catRes.data.success) {
        setAllCategories(catRes.data.results || catRes.data.result || []);
      }
      
      // 2. Fetch current settings (which contains the mapped categories array)
      const settingsRes = await adminApi.getSettings();
      const settingsData = settingsRes.data?.result || settingsRes.data || {};
      if (Array.isArray(settingsData.dailyNeedsCategoryIds)) {
        setDailyNeedsCategoryIds(settingsData.dailyNeedsCategoryIds);
        if (settingsData.dailyNeedsCategoryIds.length > 0) {
          setActiveCategoryId(settingsData.dailyNeedsCategoryIds[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load initial settings or categories:", err);
      toast.error("Failed to load settings.");
    }
  };

  // Load products in the active category for preview
  const loadPreviewProducts = async () => {
    if (!activeCategoryId) {
      setPreviewProducts([]);
      setTotal(0);
      return;
    }
    
    setIsLoadingProducts(true);
    try {
      const response = await adminApi.getProducts({
        category: activeCategoryId,
        page,
        limit: pageSize,
      });
      if (response.data.success) {
        const payload = response.data.result || {};
        setPreviewProducts(payload.items || response.data.results || []);
        setTotal(payload.total || (payload.items || []).length);
      }
    } catch (err) {
      console.error("Failed to fetch products for preview:", err);
      setPreviewProducts([]);
      setTotal(0);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadSettingsAndCategories();
  }, []);

  useEffect(() => {
    loadPreviewProducts();
  }, [activeCategoryId, page, pageSize]);

  // Add Category to Daily Needs list
  const handleAddCategory = () => {
    if (!newCategoryIdToAdd) {
      toast.error("Please select a category");
      return;
    }
    setDailyNeedsCategoryIds(prev => [...prev, newCategoryIdToAdd]);
    if (!activeCategoryId) {
      setActiveCategoryId(newCategoryIdToAdd);
    }
    setNewCategoryIdToAdd("");
    setIsAddModalOpen(false);
    toast.success("Category added to list. Click save to apply changes.");
  };

  // Remove Category from Daily Needs list
  const handleRemoveCategory = (id) => {
    setDailyNeedsCategoryIds(prev => prev.filter(catId => catId !== id));
    if (activeCategoryId === id) {
      const remaining = dailyNeedsCategoryIds.filter(catId => catId !== id);
      setActiveCategoryId(remaining.length > 0 ? remaining[0] : "");
    }
    toast.success("Category removed from list. Click save to apply changes.");
  };

  // Save mappings to platform settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Saving category configuration...");
    try {
      const res = await adminApi.updateSettings({
        dailyNeedsCategoryIds
      });
      if (res.data.success) {
        toast.success("Daily Needs category configuration saved!", { id: toastId });
      } else {
        toast.error("Failed to save configuration", { id: toastId });
      }
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error(err.response?.data?.message || "Failed to save configuration", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Needs Category Configuration</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Configure which categories show up in the customer app's "Daily Needs" shortcut section.
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-800 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <HiOutlineCheckCircle className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Category Configuration"}
        </button>
      </div>

      {/* Grid: Category List and Product Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Card: Categories in Daily Needs */}
        <Card className="border-none shadow-xl ring-1 ring-slate-100 p-5 bg-white h-fit space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                <HiOutlineTag className="h-4 w-4 text-slate-500" />
                Featured Categories
              </h2>
              <p className="text-[10px] font-semibold text-slate-400">
                Categories displayed in Daily Needs.
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white rounded-xl transition-all shadow-sm border border-slate-200/50"
              title="Add Category"
            >
              <HiOutlinePlus className="h-4 w-4" />
            </button>
          </div>

          <div className="h-px bg-slate-100" />

          {/* List of mapped categories */}
          <div className="space-y-2">
            {mappedCategories.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-6">
                No categories added yet. Click the + button to add categories!
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {mappedCategories.map((cat) => {
                  const catId = cat._id || cat.id;
                  return (
                    <div
                      key={catId}
                      onClick={() => {
                        setActiveCategoryId(catId);
                        setPage(1);
                      }}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                        activeCategoryId === catId
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {cat.image && (
                          <img src={cat.image} alt={cat.name} className="w-8 h-8 rounded-lg object-cover bg-slate-50 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCategory(catId);
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Remove Category"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Right Card: Products Live Preview */}
        <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-2xl bg-white lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-slate-850">
                Products Live Preview
              </h2>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                List of products that will show up for the client when they click this category.
              </p>
            </div>
            {activeCategoryId && (
              <Badge variant="success" className="text-[9px] font-extrabold uppercase tracking-wider">
                {categoriesList.find(c => (c._id || c.id) === activeCategoryId)?.name || "Preview"}
              </Badge>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[60%]">Product</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[20%]">Price</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[20%]">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoadingProducts ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <HiOutlineArrowPath className="h-6 w-6 text-slate-300 animate-spin" />
                        <span className="text-xs font-bold text-slate-400">Loading products preview...</span>
                      </div>
                    </td>
                  </tr>
                ) : !activeCategoryId ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-24 text-center text-slate-400 text-xs font-bold">
                      Select or add a category to preview products.
                    </td>
                  </tr>
                ) : previewProducts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-24 text-center text-slate-400 text-xs font-bold">
                      No products found in this category. Sellers need to add products under this category to display them.
                    </td>
                  </tr>
                ) : (
                  previewProducts.map((product) => (
                    <tr key={product._id || product.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {product.mainImage ? (
                              <img src={product.mainImage} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-[10px] font-black text-slate-300">NO IMG</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{product.name}</div>
                            <div className="text-[9px] font-semibold text-slate-400 mt-0.5">
                              Seller: {product.sellerId?.shopName || "Store"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-800">₹{product.price}</div>
                        {product.salePrice > 0 && (
                          <div className="text-[9px] font-bold text-slate-400 line-through">₹{product.salePrice}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={product.stock > 0 ? "success" : "default"} className="text-[9px] font-bold">
                          {product.stock} units
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > pageSize && (
            <div className="p-4 border-t border-slate-50 shrink-0">
              <Pagination
                page={page}
                totalPages={Math.ceil(total / pageSize)}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                loading={isLoadingProducts}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setNewCategoryIdToAdd("");
        }}
        title="Add Category to Daily Needs"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Choose a category to display in the client application's Daily Needs home section.
          </p>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Select Category
            </label>
            <select
              value={newCategoryIdToAdd}
              onChange={(e) => setNewCategoryIdToAdd(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 ring-1 ring-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer focus:ring-slate-200"
            >
              <option value="">Select category...</option>
              {availableCategoriesToAdd.map((cat) => (
                <option key={cat._id || cat.id} value={cat._id || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setNewCategoryIdToAdd("");
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCategory}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
            >
              Add Category
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyNeeds;
