'use client';

import React from 'react';
import { Award, Sparkles, Gift, Check, Flame } from 'lucide-react';
import { LoyaltyInfo } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';

interface LoyaltyStampCardProps {
  loyalty: LoyaltyInfo;
  onApplyCoupon?: (code: string) => void;
  isApplied?: boolean;
}

export default function LoyaltyStampCard({ loyalty, onApplyCoupon, isApplied }: LoyaltyStampCardProps) {
  const { lang } = useLanguage();

  const currentStamps = loyalty.stamps;
  // Ready only when an earned reward is still unused. Checking the
  // earned count alone would keep offering a reward already redeemed.
  const isRewardReady = loyalty.rewardsAvailable > 0;

  return (
    <div className="bg-gradient-to-br from-brand-chocolate via-[#3A2720] to-brand-chocolate text-white rounded-3xl p-5 sm:p-6 shadow-card border border-brand-caramel/30 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-caramel/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-cream/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-caramel/25 border border-brand-caramel/40 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-brand-cream" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-heading font-bold text-base sm:text-lg text-brand-cream">
                {lang === 'bn' ? 'সুইট রিওয়ার্ডস স্ট্যাম্প কার্ড' : 'Sweet Rewards Loyalty Card'}
              </h4>
              <span className="text-[13px] font-bold uppercase tracking-wider bg-brand-caramel/30 text-brand-cream border border-brand-caramel/40 px-2 py-0.5 rounded-full">
                {lang === 'bn' ? loyalty.tierBn : loyalty.tier}
              </span>
            </div>
            <p className="text-[13px] text-brand-cream/70 mt-0.5">
              {lang === 'bn'
                ? `প্রতি ৫টি সম্পন্ন অর্ডারে পান ১টি ফ্রি স্পেশাল ডেজার্ট ডিসকাউন্ট!`
                : `Every 5 completed orders unlocks a complimentary dessert reward!`}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[13px] text-brand-cream/60 block">
            {lang === 'bn' ? 'সম্পন্ন অর্ডার' : 'Completed Orders'}
          </span>
          <span className="font-heading font-extrabold text-lg text-brand-cream">
            {loyalty.completedOrders} <span className="text-[13px] font-normal text-white/50">/ 5 {lang === 'bn' ? 'স্ট্যাম্প' : 'stamps'}</span>
          </span>
        </div>
      </div>

      {/* Stamp Slots Row */}
      <div className="relative z-10 py-5">
        <div className="grid grid-cols-5 gap-2 sm:gap-4">
          {[1, 2, 3, 4, 5].map((slotNum) => {
            const isStamped = slotNum <= currentStamps || (slotNum === 5 && isRewardReady);
            const isTarget = slotNum === 5;

            return (
              <div
                key={slotNum}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={`relative w-full aspect-square max-w-[64px] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                    isStamped
                      ? 'bg-gradient-to-br from-brand-caramel via-brand-caramel to-brand-chocolate text-white shadow-soft border-2 border-brand-cream scale-102 ring-2 ring-brand-caramel/30'
                      : isTarget
                      ? 'bg-white/5 border-2 border-dashed border-brand-caramel/50 text-brand-caramel/80 hover:border-brand-caramel'
                      : 'bg-white/5 border border-dashed border-white/20 text-white/30'
                  }`}
                >
                  {isStamped ? (
                    <div className="flex flex-col items-center justify-center animate-fade-in">
                      {isTarget ? (
                        <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-brand-cream animate-bounce" />
                      ) : (
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand-cream" />
                      )}
                      <span className="text-[9px] sm:text-[13px] font-extrabold tracking-tighter uppercase mt-0.5 text-white/90">
                        {lang === 'bn' ? `স্ট্যাম্প ${slotNum}` : `Stamp ${slotNum}`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      {isTarget ? (
                        <>
                          <Gift className="w-4 h-4 text-brand-cream/60 mb-0.5" />
                          <span className="text-[8px] sm:text-[9px] font-bold text-brand-cream/80 text-center leading-none">
                            FREE
                          </span>
                        </>
                      ) : (
                        <span className="font-heading text-[13px] sm:text-sm font-bold text-white/40">
                          {slotNum}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[9px] sm:text-[13px] text-white/60 font-medium">
                  {isTarget 
                    ? (lang === 'bn' ? 'উপহার' : 'Reward') 
                    : (lang === 'bn' ? `${slotNum}ম অর্ডার` : `Order ${slotNum}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reward Status / Action */}
      <div className="relative z-10 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {isRewardReady ? (
            <p className="text-[13px] sm:text-sm text-brand-cream font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-cream" />
              <span>
                {lang === 'bn' 
                  ? 'অভিনন্দন! আপনার ৫টি অর্ডারের উপহার সক্রিয় হয়েছে।' 
                  : 'Congratulations! Your 5-order reward is active.'}
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-brand-cream/80 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-brand-caramel" />
              <span>
                {lang === 'bn'
                  ? `ফ্রি রিওয়ার্ড আনলক করতে আর মাত্র ${loyalty.stampsToNextReward}টি অর্ডার বাকি!`
                  : `Only ${loyalty.stampsToNextReward} more order${loyalty.stampsToNextReward > 1 ? 's' : ''} to unlock your free reward!`}
              </span>
            </p>
          )}
        </div>

        {onApplyCoupon && (
          <div>
            {isApplied ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-forest/10 bg-brand-forest/30 border border-brand-forest/50 px-3 py-1.5 rounded-xl">
                <Check className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'রিওয়ার্ড কুপন যোগ হয়েছে' : 'Reward Applied!'}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onApplyCoupon(loyalty.rewardCouponCode)}
                disabled={!isRewardReady}
                className={`text-[13px] font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-soft flex items-center gap-1.5 ${
                  isRewardReady
                    ? 'bg-gradient-to-r from-brand-caramel to-brand-caramel hover:brightness-110 text-white cursor-pointer active:scale-95'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'কুপন প্রয়োগ করুন (৳১৫০ ছাড়)' : 'Apply Reward (৳150 Off)'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
