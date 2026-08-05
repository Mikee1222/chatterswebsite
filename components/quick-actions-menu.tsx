"use client";

import * as React from "react";
import { DollarSign, Fish, Target } from "lucide-react";
import { useRouter } from "next/navigation";

type QuickActionsMenuProps = {
  onClose: () => void;
  openAddWhale: () => void;
  openTransactionForm: () => void;
};

export function QuickActionsMenu({ onClose, openAddWhale, openTransactionForm }: QuickActionsMenuProps) {
  const router = useRouter();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose}>
        <div
          className="animate-slide-up w-full rounded-t-3xl bg-[#1a1a1a] p-6 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-white/20" />

          <h3 className="mb-4 text-lg font-semibold text-white">Quick actions</h3>

          <div className="grid gap-3">
            <button onClick={() => { onClose(); openAddWhale(); }} className="group">
              <div className="flex items-center gap-4 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5 p-4 transition-all hover:border-pink-500/40 hover:from-pink-500/15">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/20">
                  <Fish className="h-6 w-6 text-pink-300" aria-hidden />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">Add new whale</p>
                  <p className="text-sm text-white/40">Track a new subscriber</p>
                </div>
                <svg className="h-5 w-5 text-white/30 transition-colors group-hover:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <button onClick={() => { onClose(); openTransactionForm(); }} className="group">
              <div className="flex items-center gap-4 rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4 transition-all hover:border-green-500/40 hover:from-green-500/15">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
                  <DollarSign className="h-6 w-6 text-green-300" aria-hidden />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">Log transaction</p>
                  <p className="text-sm text-white/40">Record whale spending</p>
                </div>
                <svg className="h-5 w-5 text-white/30 transition-colors group-hover:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <button onClick={() => { onClose(); router.push("/request-custom"); }} className="group">
              <div className="flex items-center gap-4 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 transition-all hover:border-purple-500/40 hover:from-purple-500/15">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                  <Target className="h-6 w-6 text-purple-300" aria-hidden />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">Custom Video</p>
                  <p className="text-sm text-white/40">Submit custom content request</p>
                </div>
                <svg className="h-5 w-5 text-white/30 transition-colors group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>

          <button onClick={onClose} className="mt-4 w-full py-3 text-sm text-white/40">
            Cancel
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
