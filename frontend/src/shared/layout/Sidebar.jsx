import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { HiChevronDown } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const colorMap = {
  indigo:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  rose: "text-rose-600 bg-rose-50 border-rose-100 group-hover:bg-rose-100/50",
  amber:
    "text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-100/50",
  blue: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  emerald:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  violet:
    "text-violet-600 bg-violet-50 border-violet-100 group-hover:bg-violet-100/50",
  cyan: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  orange:
    "text-orange-600 bg-orange-50 border-orange-100 group-hover:bg-orange-100/50",
  green:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  sky: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  pink: "text-pink-600 bg-pink-50 border-pink-100 group-hover:bg-pink-100/50",
  fuchsia:
    "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100 group-hover:bg-fuchsia-100/50",
  red: "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-100/50",
  slate:
    "text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-100/50",
  dark: "text-gray-800 bg-gray-100 border-gray-200 group-hover:bg-gray-200/50",
};

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) => {
  const location = useLocation();
  const badgeCount = Number(item?.badgeCount || 0);
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 pr-12 py-2.5 transition-all duration-300 group relative overflow-hidden cursor-pointer",
            isChildActive || isOpen
              ? "bg-blue-100/80 text-[#1e40af] ring-1 ring-blue-200/50"
              : "text-slate-700 hover:text-slate-900",
          )}>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-blue-100/40 rounded-lg -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center space-x-2.5 z-10">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-500 shadow-sm",
                isChildActive || isOpen
                  ? "bg-[#1e40af] text-white ring-2 ring-blue-200/20"
                  : "bg-blue-50 text-slate-400 group-hover:bg-blue-100/50 group-hover:text-slate-700",
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-xs tracking-tight transition-all duration-300",
                isChildActive || isOpen ? "font-bold" : "font-semibold",
              )}>
              {item.label}
            </span>
          </div>
          {badgeCount > 0 && !isOpen && (
            <span className="pointer-events-none absolute top-2 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#f0f7ff]">
              {badgeLabel}
            </span>
          )}
          <div
            className={cn(
              "transition-all duration-300 z-10",
              isOpen
                ? "rotate-180 text-[#1e40af]"
                : "rotate-0 text-slate-450 group-hover:text-slate-600",
            )}>
            <HiChevronDown className="h-4 w-4" />
          </div>
        </button>
        {isOpen && (
          <div className="pl-9 pr-3 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-500">
            {item.children.map((child) => {
              const showChildBadge =
                badgeCount > 0 && String(child?.path || "") === "/admin/support-tickets";

              return (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-1.5 px-2.5 rounded-lg transition-all duration-300 relative",
                    isActive
                      ? "text-[#1e40af] font-bold bg-blue-100/60 shadow-xs ring-1 ring-blue-200/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-blue-50/50",
                    showChildBadge && "pr-9",
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-[#1e40af] shadow-[0_0_10px_rgba(30,64,175,0.5)]" />
                    )}
                    {child.label}
                    {showChildBadge && (
                      <span className="pointer-events-none absolute top-1 right-2 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#f0f7ff]">
                        {badgeLabel}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.end !== undefined ? item.end : false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
          isActive
            ? "bg-[#1e40af] text-white shadow-md shadow-[#1e40af]/10 font-bold"
            : "text-slate-700 hover:text-slate-955",
        )
      }>
      {({ isActive }) => (
        <>
          <AnimatePresence>
            {isHovered && !isActive && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-blue-100/40 rounded-lg -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-500 shadow-sm z-10",
              isActive
                ? "bg-white/20 text-white"
                : "bg-blue-50 text-slate-400 group-hover:bg-blue-100/50 group-hover:text-slate-700",
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "text-xs tracking-tight transition-all duration-300 z-10",
              isActive ? "font-bold" : "font-semibold",
            )}>
            {item.label}
          </span>
          {badgeCount > 0 && (
            <span className="pointer-events-none absolute top-2 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#f0f7ff] z-10">
              {badgeLabel}
            </span>
          )}
          {isActive && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 rounded-l-full animate-in slide-in-from-right-1" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({ items, title, onClose, openMenu, handleToggle, hoveredIdx, setHoveredIdx }) => {
  const { settings } = useSettings();
  const appName = settings?.appName || 'App';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex h-16 items-center justify-between px-5 border-b border-blue-100/60 bg-gradient-to-b from-white to-transparent z-10">
        <div className="flex items-center space-x-2.5">
          {settings?.logoUrl ? (
            <div className="h-9 w-9 rounded-xl overflow-hidden shadow-sm ring-1 ring-blue-100 group-hover:scale-110 transition-all duration-500 ease-out">
              <img 
                src={settings.logoUrl} 
                alt={appName} 
                className="h-full w-full object-contain" 
                style={{ filter: "url(#logo-yellow-watch-green-rider)" }}
              />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-[#1e40af] flex items-center justify-center text-white shadow-sm transform -rotate-6 hover:rotate-0 transition-all duration-500 ease-out">
              <span className="text-lg font-black italic">{appName.charAt(0)}</span>
            </div>
          )}
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-800 leading-none">
              {appName}
            </h1>
            <span className="text-[9px] font-black text-[#1e40af] uppercase tracking-[0.2em] mt-1 block">
              {title}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="p-2 md:hidden text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className="mt-4 px-3 space-y-1.5 flex-1 overflow-y-auto overscroll-contain custom-scrollbar min-h-0 pb-6 relative z-20"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <p className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">
          Core Management
        </p>
        <AnimatePresence>
          {items.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              isOpen={openMenu === item.label}
              onToggle={() => handleToggle(item.label)}
              isHovered={hoveredIdx === idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseEnterWithClose={() => {
                setHoveredIdx(idx);
              }}
              onMouseLeave={() => { }} // Handle in nav container
            />
          ))}
        </AnimatePresence>
      </nav>

      <div className="p-4 border-t border-blue-100 bg-gradient-to-t from-blue-50/30 to-transparent flex-shrink-0">
        <div className="bg-blue-100/40 rounded-lg p-3 shadow-sm border border-blue-200/50 hover:bg-blue-100/70 hover:border-blue-200 transition-all group cursor-pointer">
          <div className="flex items-center space-x-2.5">
            <div className="relative group">
              {settings?.logoUrl ? (
                <div className="h-8 w-8 rounded-lg overflow-hidden border border-blue-200 shadow-lg group-hover:scale-110 transition-all duration-500">
                  <img 
                    src={settings.logoUrl} 
                    alt={appName} 
                    className="h-full w-full object-contain" 
                    style={{ filter: "url(#logo-yellow-watch-green-rider)" }}
                  />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1e40af] via-brand-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-lg group-hover:scale-110 transition-all duration-500">
                  {appName.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-[#f0f7ff] shadow-sm animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-[#1e40af] transition-colors">
                {title?.toLowerCase().includes('seller') ? 'Seller Console' : 'Admin Console'}
              </p>
              <p className="text-[9px] text-slate-500 truncate font-black uppercase tracking-widest">
                {title?.toLowerCase().includes('seller') ? 'Seller' : 'Super Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, onClose }) => {
  const { role } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const commonProps = {
    items,
    title,
    onClose,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed left-0 inset-y-0 w-72 text-slate-700 md:flex flex-col z-50 transition-all duration-300",
        (role === "admin" || role === "seller") 
          ? "hidden md:flex bg-white border-r border-slate-150 shadow-[20px_0_60px_rgba(0,0,0,0.02)]" 
          : "bg-[#f0f7ff] border-r border-blue-100 shadow-[20px_0_60px_rgba(30,64,175,0.05)] flex",
      )}>
        <SidebarContent {...commonProps} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Outer Container (Fixed Shell - NO TRANSFORM) */}
            <div className="absolute left-0 inset-y-0 w-72 flex flex-col pointer-events-none">
              {/* Inner Animation Wrapper (TRANSFORM APPLIED HERE) */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "flex-1 shadow-2xl flex flex-col pointer-events-auto min-h-0",
                  (role === "admin" || role === "seller") ? "bg-white" : "bg-[#f0f7ff]"
                )}
              >
                <SidebarContent {...commonProps} />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
