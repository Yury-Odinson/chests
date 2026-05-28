import type { Rank } from "@/shared/types/game";

export function ChestsList({ chests }: { chests: Rank[] }) {
  if (chests.length === 0) {
    return <span className="text-xs opacity-50">нет сундуков</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chests.map((rank) => (
        <span
          key={rank}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
          title={`Сундук ${rank}`}
        >
          {rank}
        </span>
      ))}
    </div>
  );
}
