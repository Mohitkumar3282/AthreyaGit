import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, CreditCard, AlertTriangle, User, Loader2 } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { deliveryApi } from "../../services/deliveryApi";

const maskAccount = (n) => {
  const s = String(n || "");
  return s.length > 4 ? `${"X".repeat(s.length - 4)}${s.slice(-4)}` : s;
};

/**
 * Rider's payout bank account — real data, editable. (This page used to show
 * fixed demo details for every rider and its "Verify & Update" did nothing.)
 */
const BankAccount = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ accountHolder: "", accountNumber: "", confirmAccountNumber: "", ifsc: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await deliveryApi.getProfile();
        const p = res.data?.result || res.data?.data || null;
        setProfile(p);
        setForm((prev) => ({ ...prev, accountHolder: p?.accountHolder || p?.name || "", ifsc: p?.ifsc || "" }));
      } catch {
        toast.error("Could not load your bank details");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const hasAccount = Boolean(profile?.accountNumber && profile?.ifsc);

  const handleSave = async () => {
    const accountNumber = form.accountNumber.replace(/\s/g, "");
    if (!form.accountHolder.trim()) return toast.error("Enter the account holder's name");
    if (!/^\d{9,18}$/.test(accountNumber)) return toast.error("Account number must be 9 to 18 digits");
    if (accountNumber !== form.confirmAccountNumber.replace(/\s/g, "")) {
      return toast.error("Account numbers do not match");
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) {
      return toast.error("Enter a valid IFSC code (e.g. SBIN0001234)");
    }

    setIsSaving(true);
    try {
      const res = await deliveryApi.updateProfile({
        accountHolder: form.accountHolder.trim(),
        accountNumber,
        ifsc: form.ifsc.trim().toUpperCase(),
      });
      const updated = res.data?.result || res.data?.data || null;
      if (updated) setProfile(updated);
      setForm((prev) => ({ ...prev, accountNumber: "", confirmAccountNumber: "" }));
      toast.success("Bank account saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save bank account");
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">Bank Account</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : (
        <div className="p-4 max-w-lg mx-auto space-y-6">
          {/* Current account */}
          <div className="bg-gradient-to-br from-brand-900 to-brand-800 text-white p-6 rounded-2xl shadow-xl">
            <Landmark size={32} className="text-white/80 mb-6" />
            {hasAccount ? (
              <>
                <p className="text-brand-200 text-[14px] uppercase tracking-wider">Account Number</p>
                <p className="font-mono text-2xl tracking-widest">{maskAccount(profile.accountNumber)}</p>
                <div className="flex justify-between items-end mt-6">
                  <div>
                    <p className="text-brand-200 text-[14px] uppercase tracking-wider mb-1">Account Holder</p>
                    <p className="font-bold text-lg">{profile.accountHolder || profile.name}</p>
                  </div>
                  <p className="text-brand-200 text-[14px]">{profile.ifsc}</p>
                </div>
              </>
            ) : (
              <p className="text-lg font-bold">No bank account added yet</p>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex items-start">
            <AlertTriangle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-[14px] text-yellow-700 leading-relaxed">
              Your earnings are paid to this account. Double-check the account number and IFSC code — money sent to a
              wrong account may not be recoverable.
            </p>
          </div>

          <div className="pt-2">
            <h3 className="ds-h4 text-gray-900 mb-4">{hasAccount ? "Change Bank Account" : "Add Bank Account"}</h3>
            <div className="space-y-4">
              <Input label="Account Holder Name" icon={User} value={form.accountHolder} onChange={setField("accountHolder")} />
              <Input
                label="Account Number"
                placeholder="Enter account number"
                icon={CreditCard}
                inputMode="numeric"
                value={form.accountNumber}
                onChange={setField("accountNumber")}
              />
              <Input
                label="Confirm Account Number"
                placeholder="Re-enter account number"
                icon={CreditCard}
                inputMode="numeric"
                value={form.confirmAccountNumber}
                onChange={setField("confirmAccountNumber")}
              />
              <Input label="IFSC Code" placeholder="e.g. SBIN0001234" icon={Landmark} value={form.ifsc} onChange={setField("ifsc")} />
              <Button className="w-full mt-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : hasAccount ? "Update Bank Account" : "Save Bank Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccount;
