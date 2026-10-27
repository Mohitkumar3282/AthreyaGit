import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "Delete account" button + confirmation dialog, shared by the Seller and
 * Delivery Partner apps. The server refuses while orders, wallet money or cash
 * are outstanding and says why; that message is shown as-is.
 */
const DeleteAccountSection = ({ onDelete, onDeleted, consequences = [], className = "" }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onDelete(text.trim());
      toast.success("Your account has been deleted");
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText("");
          setOpen(true);
        }}
        className={`w-full py-3.5 text-red-600 font-bold bg-white border border-red-200 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors ${className}`}
      >
        <Trash2 size={18} />
        Delete account
      </button>

      {open && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 size={22} />
              <h3 className="text-lg font-black">Delete your account?</h3>
            </div>
            <ul className="text-[14px] text-gray-700 font-medium list-disc pl-5 space-y-1.5">
              {consequences.map((c) => (
                <li key={c}>{c}</li>
              ))}
              <li>You will be signed out and will not be able to log back in to this account.</li>
              <li>This cannot be undone.</li>
            </ul>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1">
                Type <span className="text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoCapitalize="characters"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm font-bold outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy || text.trim().toUpperCase() !== "DELETE"}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-black disabled:opacity-40"
              >
                {busy ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeleteAccountSection;
