"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/features/game/SocketProvider";

export default function HomePage() {
  const router = useRouter();
  const { state, name, setName } = useGameSocket();

  const [value, setValue] = useState("");

  // Prefill with the previously used name once it is read from storage.
  useEffect(() => {
    if (name) setValue(name);
  }, [name]);

  // Successful auto-rejoin → drop straight back into the game.
  useEffect(() => {
    if (state?.roomId) {
      router.push(`/game/${state.roomId}`);
    }
  }, [state?.roomId, router]);

  const handleContinue = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setName(trimmed);
    router.push("/lobby");
  };

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center px-6 py-10 text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(8, 6, 5, 0.78) 0%, rgba(8, 6, 5, 0.44) 42%, rgba(8, 6, 5, 0.2) 72%), linear-gradient(180deg, rgba(8, 6, 5, 0.1) 0%, rgba(8, 6, 5, 0.56) 100%), url('/welcome-bg.png')",
      }}
    >
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Сундук</h1>
          <p className="text-sm text-amber-50/70">
            Карточная игра для 2–5 игроков.
          </p>
        </header>

        <div className="mt-8 space-y-3">
          <label className="block text-sm font-medium text-amber-50/86">
            Как вас зовут?
          </label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleContinue();
            }}
            placeholder="Игрок..."
            className="w-full rounded-lg border border-amber-100/20 bg-amber-50 px-3 py-2 text-base text-stone-950 outline-none transition placeholder:text-stone-500 focus:border-amber-300"
          />
        </div>

        <button
          type="button"
          disabled={!value.trim()}
          onClick={handleContinue}
          className="mt-6 w-full rounded-lg bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-50"
        >
          В лобби
        </button>
      </section>
    </main>
  );
}
