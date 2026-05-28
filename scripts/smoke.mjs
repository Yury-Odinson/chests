import { io } from "socket.io-client";

const URL = process.env.URL ?? "http://localhost:3000";

function makeClient(name) {
  const socket = io(URL, { path: "/api/socket" });
  const state = {
    name,
    socket,
    playerId: null,
    roomId: null,
    lastState: null,
    errors: [],
    logs: [],
  };
  socket.on("connect", () => log(name, "connected"));
  socket.on("room:created", (p) => {
    state.roomId = p.roomId;
    state.playerId = p.playerId;
    log(name, `room created: ${p.roomId} (playerId=${p.playerId})`);
  });
  socket.on("room:joined", (p) => {
    state.roomId = p.roomId;
    state.playerId = p.playerId;
    log(name, `joined ${p.roomId} (playerId=${p.playerId})`);
  });
  socket.on("game:state", (s) => {
    state.lastState = s;
  });
  socket.on("game:log", (item) => {
    state.logs.push(item.message);
    log(name, `LOG: ${item.message}`);
  });
  socket.on("game:error", ({ message }) => {
    state.errors.push(message);
    log(name, `ERR: ${message}`);
  });
  return state;
}

function log(who, msg) {
  console.log(`[${who}] ${msg}`);
}

function waitFor(checkFn, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = checkFn();
      if (v) return resolve(v);
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function main() {
  const alice = makeClient("Alice");
  const bob = makeClient("Bob");

  await waitFor(() => alice.socket.connected && bob.socket.connected);

  alice.socket.emit("room:create", { playerName: "Alice" });
  await waitFor(() => alice.roomId);

  bob.socket.emit("room:join", {
    roomId: alice.roomId,
    playerName: "Bob",
  });
  await waitFor(() => bob.roomId);

  alice.socket.emit("room:start", { roomId: alice.roomId });
  await waitFor(
    () =>
      alice.lastState?.status === "playing" &&
      bob.lastState?.status === "playing"
  );

  console.log("\n=== After start ===");
  console.log(`Alice hand: ${alice.lastState.me.hand.length} cards`);
  console.log(`Bob hand: ${bob.lastState.me.hand.length} cards`);
  console.log(`Deck: ${alice.lastState.deckCount}`);
  console.log(`Current player: ${alice.lastState.currentPlayerId}`);

  // Verify Alice can't see Bob's hand
  const aliceJson = JSON.stringify(alice.lastState);
  const bobCardId = bob.lastState.me.hand[0]?.id;
  const leak = bobCardId && aliceJson.includes(bobCardId);
  console.log(`\nHand secrecy: ${leak ? "FAIL (leak!)" : "OK"}`);

  // Try ask sequence: whoever is current asks the other
  const currentSocket =
    alice.lastState.currentPlayerId === alice.playerId ? alice : bob;
  const other = currentSocket === alice ? bob : alice;
  const myRank = currentSocket.lastState.me.hand[0].rank;
  console.log(
    `\n${currentSocket.name} asks ${other.name} for rank ${myRank}`
  );
  currentSocket.socket.emit("game:ask-rank", {
    roomId: currentSocket.roomId,
    targetPlayerId: other.playerId,
    rank: myRank,
  });

  // Wait for either pendingGuess or turn change
  await waitFor(() => currentSocket.logs.length > 0, 1000);

  console.log("\n=== After ask ===");
  console.log(`pendingGuess: ${JSON.stringify(currentSocket.lastState.pendingGuess)}`);
  console.log(`current: ${currentSocket.lastState.currentPlayerId}`);

  alice.socket.disconnect();
  bob.socket.disconnect();
  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
