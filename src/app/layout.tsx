import type { Metadata } from "next";
import "./globals.css";
import { SocketProvider } from "@/features/game/SocketProvider";

export const metadata: Metadata = {
  title: "Сундук — карточная игра",
  description: "Онлайн-игра «Сундук / Клад»",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
