import { io } from "socket.io-client";

const roomId = process.argv[2];
if (!roomId) { console.error("usage: node join.mjs ROOM"); process.exit(1); }

const sock = io("http://localhost:3000", { path: "/api/socket" });
sock.on("connect", () => {
  console.log("connected as Бот");
  sock.emit("room:join", { roomId, playerName: "Бот" });
});
sock.on("room:joined", ({ playerId }) => {
  console.log(`joined as ${playerId}`);
});
sock.on("game:log", (l) => console.log("LOG:", l.kind, "—", l.message));
sock.on("game:error", (e) => console.log("ERR:", e.message));
setTimeout(() => { console.log("done"); sock.disconnect(); process.exit(0); }, 60000);
