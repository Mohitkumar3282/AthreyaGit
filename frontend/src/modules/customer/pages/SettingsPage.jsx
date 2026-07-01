import React from 'react';
import { Bell, Lock, User, Globe, ChevronRight, ToggleRight, LogOut } from 'lucide-react';

const SettingsPage = () => {
    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            {/* Header */}
            <div className="bg-[#1a6e2e] px-5 pt-10 pb-20 relative z-10 rounded-b-[2.5rem] overflow-hidden border-b border-transparent">
                <h1 className="text-3xl font-black text-white tracking-tight relative z-10">Settings</h1>
                <p className="text-white/80 text-sm font-medium mt-1 relative z-10">Configure your app preferences</p>
            </div>

            <div className="max-w-2xl mx-auto px-4 -mt-10 relative z-20 space-y-6">

                {/* General Section */}
                <div className="bg-white rounded-3xl overflow-hidden border border-[#1a6e2e]/20">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">General</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        <SettingItem icon={Bell} label="Notifications" hasToggle />
                        <SettingItem icon={Globe} label="Language" value="English" />
                        {/* <SettingItem icon={Moon} label="Dark Mode" hasToggle /> */}
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white rounded-3xl overflow-hidden border border-[#1a6e2e]/20">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        <SettingItem icon={Lock} label="Change Password" />
                        <SettingItem icon={User} label="Privacy Settings" />
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-3xl overflow-hidden border border-[#1a6e2e]/20">
                    <div className="p-4">
                        <button className="w-full py-4 text-red-600 font-bold bg-red-50 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                            <LogOut size={20} /> Delete Account
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

const SettingItem = ({ icon: Icon, label, value, hasToggle }) => (
    <div className="px-6 py-5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
        <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <Icon size={20} />
            </div>
            <span className="font-bold text-slate-800 text-base">{label}</span>
        </div>

        <div className="flex items-center gap-2">
            {value && <span className="text-slate-400 text-sm font-medium">{value}</span>}
            {hasToggle ? (
                <ToggleRight size={32} className="text-[#1a6e2e] fill-current" />
            ) : (
                <ChevronRight size={20} className="text-slate-300" />
            )}
        </div>
    </div>
);

export default SettingsPage;

