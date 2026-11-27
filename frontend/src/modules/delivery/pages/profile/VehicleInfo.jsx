import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, ShieldCheck, FileText, Clock, Loader2, Hash, IdCard } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { deliveryApi } from "../../services/deliveryApi";
import { useAuth } from "@core/context/AuthContext";

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "cycle", label: "Cycle" },
];

/**
 * Rider's vehicle details — real data, editable. (Previously read-only with
 * placeholder "N/A" fields and every document marked "Verified".)
 */
const VehicleInfo = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ vehicleType: "bike", vehicleNumber: "", drivingLicenseNumber: "" });

  const fillForm = (p) =>
    setForm({
      vehicleType: p?.vehicleType || "bike",
      vehicleNumber: p?.vehicleNumber || "",
      drivingLicenseNumber: p?.drivingLicenseNumber || "",
    });

  useEffect(() => {
    (async () => {
      try {
        const res = await deliveryApi.getProfile();
        const p = res.data?.result || res.data?.data || null;
        setProfile(p);
        fillForm(p);
      } catch {
        toast.error("Could not load your vehicle details");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!form.vehicleNumber.trim()) {
      toast.error("Enter your vehicle number");
      return;
    }
    setIsSaving(true);
    try {
      const res = await deliveryApi.updateProfile({
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim(),
        drivingLicenseNumber: form.drivingLicenseNumber.trim(),
      });
      const updated = res.data?.result || res.data?.data || null;
      if (updated) {
        setProfile(updated);
        fillForm(updated);
      }
      setIsEditing(false);
      toast.success("Vehicle details saved");
      refreshUser?.();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save vehicle details");
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel = VEHICLE_TYPES.find((t) => t.value === profile?.vehicleType)?.label || "Not set";
  const verified = profile?.isVerified === true;
  const docs = [
    { title: "Driving Licence", number: profile?.drivingLicenseNumber, uploaded: Boolean(profile?.documents?.drivingLicense) },
    { title: "Aadhaar", number: null, uploaded: Boolean(profile?.documents?.aadhar) },
    { title: "PAN", number: null, uploaded: Boolean(profile?.documents?.pan) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">Vehicle Information</h1>
          <div className="ml-auto flex gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => { fillForm(profile); setIsEditing(false); }} disabled={isSaving} className="h-8 px-3">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 px-3">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} disabled={isLoading || !profile} className="text-primary hover:bg-primary/5">
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
          {isEditing ? (
            <Card className="p-4 space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-gray-700 mb-1 ml-1">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, vehicleType: t.value }))}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition ${
                        form.vehicleType === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-gray-700 border-gray-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Vehicle Number"
                icon={Hash}
                placeholder="e.g. TS 28 AB 1234"
                value={form.vehicleNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, vehicleNumber: e.target.value }))}
              />
              <Input
                label="Driving Licence Number"
                icon={IdCard}
                placeholder="e.g. TS2820190001234"
                value={form.drivingLicenseNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, drivingLicenseNumber: e.target.value }))}
              />
            </Card>
          ) : (
            <Card className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-gray-300 text-[14px] uppercase tracking-wider font-bold mb-1">Vehicle</p>
                  <h3 className="text-2xl font-bold">{profile?.vehicleNumber || "Number not added"}</h3>
                  <p className="text-gray-300">{typeLabel}</p>
                </div>
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm">
                  <Truck size={24} className="text-white" />
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-gray-300 text-[14px]">Driving Licence</p>
                <p className="font-medium">{profile?.drivingLicenseNumber || "Not added"}</p>
              </div>
            </Card>
          )}

          <div>
            <h3 className="ds-h4 text-gray-900 mb-3 px-1">Documents</h3>
            <div className="space-y-3">
              {docs.map((doc) => (
                <Card key={doc.title} className="p-4 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-start">
                      <div className="p-2 rounded-lg mr-3 bg-brand-50 text-brand-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-[16px]">{doc.title}</h4>
                        <p className="text-[14px] text-gray-600 mt-0.5">
                          {doc.uploaded ? "Uploaded" : "Not uploaded"}
                          {doc.number ? ` · ${doc.number}` : ""}
                        </p>
                      </div>
                    </div>
                    {verified && doc.uploaded ? (
                      <div className="flex items-center text-brand-600 bg-brand-50 px-2 py-1 rounded text-[13.5px] font-bold uppercase tracking-wider">
                        <ShieldCheck size={12} className="mr-1" /> Verified
                      </div>
                    ) : (
                      <div className="flex items-center text-amber-700 bg-amber-50 px-2 py-1 rounded text-[13.5px] font-bold uppercase tracking-wider">
                        <Clock size={12} className="mr-1" /> {doc.uploaded ? "In review" : "Missing"}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleInfo;
