import { Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  if (rank === 1) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} aria-label="Rank 1">
        <Trophy className="h-5 w-5 text-yellow-400" aria-hidden />
        <span className="text-sm font-bold text-yellow-400">#1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} aria-label="Rank 2">
        <Medal className="h-5 w-5 text-gray-400" aria-hidden />
        <span className="text-sm font-bold text-gray-400">#2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} aria-label="Rank 3">
        <Medal className="h-5 w-5 text-amber-500" aria-hidden />
        <span className="text-sm font-bold text-amber-500">#3</span>
      </span>
    );
  }
  return (
    <span className={cn("text-sm font-bold text-white/40", className)} aria-label={`Rank ${rank}`}>
      #{rank}
    </span>
  );
}
