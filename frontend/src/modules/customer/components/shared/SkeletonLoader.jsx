import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn("animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80", className)}
      {...props}
    />
  );
};

export const ProductCardSkeleton = ({ compact = false }) => {
  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 border border-[#1a6e2e]/20 flex flex-col gap-3 h-full">
      {/* Image Skeleton */}
      <Skeleton className="w-full aspect-[4/3] rounded-xl" />
      
      {/* Title & Brand Skeletons */}
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
      
      {/* Price & Add button Row */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-50">
        <div className="space-y-1">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-3 w-8 rounded" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
};

export const ShopCardSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl p-3  border border-slate-100/80 flex flex-col gap-2.5">
      {/* Shop Image Skeleton */}
      <Skeleton className="w-full aspect-[4/3] rounded-xl" />
      
      {/* Shop Name & Details */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-1/3 rounded" />
          <Skeleton className="h-3 w-1/4 rounded" />
        </div>
      </div>
    </div>
  );
};

export const ShopHeaderSkeleton = () => {
  return (
    <div className="w-full">
      {/* Banner Skeleton */}
      <div className="relative w-full h-48 md:h-72 bg-slate-200 animate-pulse rounded-b-3xl">
        <div className="absolute inset-0 " />

      </div>
      
      {/* Shop Info Card Skeleton */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 relative -mt-16 z-10">
        <div className="bg-white rounded-3xl p-6  border border-slate-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-center gap-4.5">
              {/* Logo */}
              <Skeleton className="h-20 w-20 rounded-2xl flex-shrink-0" />
              {/* Title & Category */}
              <div className="space-y-2.5">
                <Skeleton className="h-7 w-48 rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
              </div>
            </div>
            {/* Action Card Skeleton */}
            <Skeleton className="h-20 w-full md:w-64 rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 pt-5 mt-5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-24 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CategoryListSkeleton = () => {
  return (
    <div className="flex gap-3 overflow-hidden py-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-xl flex-shrink-0" />
      ))}
    </div>
  );
};

export default function SkeletonLoader({ variant = 'productGrid', count = 4, className }) {
  if (variant === 'productGrid') {
    return (
      <div className={cn("grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'shopGrid') {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <ShopCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'shopHeader') {
    return <ShopHeaderSkeleton />;
  }

  if (variant === 'categoryList') {
    return <CategoryListSkeleton />;
  }

  return null;
}
