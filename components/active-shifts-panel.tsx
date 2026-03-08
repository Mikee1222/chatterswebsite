"use client";

import { useRouter } from "next/navigation";
import { startChattingShift, endChattingShift } from "@/app/actions/shifts";
import { enterModel, leaveModel } from "@/app/actions/model-session";
import { formatDateTimeEuropean } from "@/lib/format";
import type { Shift } from "@/types";
import type { ModelRecord } from "@/types";

type ShiftModel = { id: string; model_name: string; model_id: string; left_at: string | null };

export function ActiveShiftsPanel({
  userRole,
  shifts,
  myShift,
  myActiveModelss,
  freeModelss,
}: {
  userRole: string;
  shifts: Shift[];
  myShift: Shift | null;
  myActiveModelss: ShiftModel[];
  freeModelss: ModelRecord[];
}) {
  const router = useRouter();

  async function handleStart() {
    const res = await startChattingShift();
    if (res.error) alert(res.error);
    else router.refresh();
  }

  async function handleEnd() {
    const res = await endChattingShift();
    if (res.error) alert(res.error);
    else router.refresh();
  }

  async function handleEnter(modelRecordId: string) {
    const res = await enterModel(modelRecordId);
    if (res.error) alert(res.error);
    else router.refresh();
  }

  async function handleLeave(shiftModelRecordId: string) {
    const res = await leaveModel(shiftModelRecordId);
    if (res.error) alert(res.error);
    else router.refresh();
  }

  const canControl = userRole === "chatter" || userRole === "admin";

  return (
    <div className="space-y-6">
      {canControl && (
        <div className="glass-card flex items-center gap-4 p-4">
          {!myShift ? (
            <form action={handleStart}>
              <button
                type="button"
                onClick={handleStart}
                className="rounded-xl bg-[hsl(330,80%,55%)] px-6 py-2.5 font-medium text-white hover:bg-[hsl(330,80%,50%)]"
              >
                Start shift
              </button>
            </form>
          ) : (
            <form action={handleEnd}>
              <button
                type="button"
                onClick={handleEnd}
                className="rounded-xl border border-white/20 bg-white/10 px-6 py-2.5 font-medium text-white hover:bg-white/15"
              >
                End shift
              </button>
            </form>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <h2 className="border-b border-white/10 p-4 text-base font-semibold text-white md:text-lg">Active shifts</h2>
        {/* Mobile: cards */}
        <ul className="divide-y divide-white/5 md:hidden">
          {shifts.length === 0 ? (
            <li className="p-6 text-center text-sm text-white/50">No active chatting shifts</li>
          ) : (
            shifts.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white/90">{s.chatter_name}</span>
                  <span className="rounded-full bg-[hsl(330,80%,55%)]/20 px-2 py-0.5 text-xs text-[hsl(330,90%,65%)]">active</span>
                </div>
                <p className="mt-1 text-sm text-white/60">{s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}</p>
                <p className="mt-0.5 text-xs text-white/50">Models: {s.models_count}</p>
              </li>
            ))
          )}
        </ul>
        {/* Desktop: table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">Chatter</th>
              <th className="p-3 font-medium">Start</th>
              <th className="p-3 font-medium">Models count</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/50">No active chatting shifts</td>
              </tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white/90">{s.chatter_name}</td>
                  <td className="p-3 text-white/70">{s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}</td>
                  <td className="p-3 text-white/70">{s.models_count}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-[hsl(330,80%,55%)]/20 px-2 py-0.5 text-xs text-[hsl(330,90%,65%)]">active</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {myShift && canControl && (
        <div className="glass-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">My session — enter / leave modelss</h2>
          <div className="mb-4">
            <p className="mb-2 text-sm text-white/60">Currently in:</p>
            <ul className="flex flex-wrap gap-2">
              {myActiveModelss.length === 0 ? (
                <li className="text-sm text-white/50">None</li>
              ) : (
                myActiveModelss.map((sm) => (
                  <li key={sm.id} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                    <span className="text-white/90">{sm.model_name}</span>
                    <button
                      type="button"
                      onClick={() => handleLeave(sm.id)}
                      className="text-xs text-[hsl(330,90%,65%)] hover:underline"
                    >
                      Leave
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm text-white/60">Free modelss — enter:</p>
            <ul className="flex flex-wrap gap-2">
              {freeModelss.length === 0 ? (
                <li className="text-sm text-white/50">No free modelss</li>
              ) : (
                freeModelss.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => handleEnter(m.id)}
                      className="rounded-lg bg-[hsl(330,80%,55%)]/20 px-3 py-1.5 text-sm text-[hsl(330,90%,65%)] hover:bg-[hsl(330,80%,55%)]/30"
                    >
                      Enter {m.model_name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
