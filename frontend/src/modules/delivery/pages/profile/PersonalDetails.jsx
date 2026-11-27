import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, MapPin, Navigation, Loader2 } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { deliveryApi } from "../../services/deliveryApi";
import { useAuth } from "@core/context/AuthContext";

/**
 * Rider's personal details — loaded from and saved to the rider's real
 * profile (this page used to show fixed demo data and never saved).
 */
const PersonalDetails = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", address: "", currentArea: "" });

  const fillForm = (p) =>
    setFormData({
      name: p?.name || "",
      email: p?.email || "",
      address: p?.address || "",
      currentArea: p?.currentArea || "",
    });

  useEffect(() => {
    (async () => {
      try {
        const res = await deliveryApi.getProfile();
        const p = res.data?.result || res.data?.data || null;
        setProfile(p);
        fillForm(p);
      } catch {
        toast.error("Could not load your profile");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      const res = await deliveryApi.updateProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        currentArea: formData.currentArea.trim(),
      });
      const updated = res.data?.result || res.data?.data || null;
      if (updated) {
        setProfile(updated);
        fillForm(updated);
      }
      setIsEditing(false);
      toast.success("Personal details saved");
      refreshUser?.();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save your details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    fillForm(profile);
    setIsEditing(false);
  };

  const field = (key) => ({
    value: formData[key],
    readOnly: !isEditing,
    onChange: (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value })),
    className: !isEditing ? "bg-gray-50 border-transparent" : "",
  });

  const initials = (profile?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">Personal Details</h1>
          <div className="ml-auto flex gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="h-8 px-3">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 px-3">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isLoading || !profile}
                className="text-primary hover:bg-primary/5"
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : (
        <div className="p-4 max-w-lg mx-auto space-y-6">
          {/* Profile photo / initials */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-24 h-24 rounded-full p-1 bg-white shadow-md">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt="Profile" className="w-full h-full rounded-full object-cover bg-gray-100" />
              ) : (
                <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-black">
                  {initials}
                </div>
              )}
            </div>
            {profile?._id && (
              <p className="mt-3 text-[16px] text-gray-700">
                Delivery Partner ID: {String(profile._id).slice(-6).toUpperCase()}
              </p>
            )}
          </div>

          <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm">
            <Input label="Full Name" icon={User} {...field("name")} />

            <Input
              label="Phone Number"
              value={profile?.phone || ""}
              readOnly
              icon={Phone}
              className="bg-gray-50 border-transparent text-gray-700"
              helperText="Contact support to change your phone number"
            />

            <Input label="Email Address" type="email" icon={Mail} placeholder="you@example.com" {...field("email")} />

            <Input label="Working Area" icon={Navigation} placeholder="e.g. Aswapuram" {...field("currentArea")} />

            <div className="relative">
              <label className="block text-[14px] font-medium text-gray-700 mb-1 ml-1">Current Address</label>
              <div className="relative">
                <div className="absolute top-2.5 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                  <MapPin size={18} />
                </div>
                <textarea
                  value={formData.address}
                  readOnly={!isEditing}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="House / street / area"
                  className={`w-full pl-10 pr-4 py-2 rounded-xl text-[16px] border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                    !isEditing ? "bg-gray-50 border-transparent text-gray-600" : "bg-white border-gray-200"
                  }`}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalDetails;
