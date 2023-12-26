const http = require("http");
const app = require("express")();
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(4001, () => console.log("Listening on http port 4001"));
const websocketServer = require("websocket").server;
const httpServer = http.createServer();

httpServer.listen(4000, () => console.log("server is listening on port 4000"));

const wsServer = new websocketServer({
  httpServer: httpServer,
});

const clients = {};
const games = {};

wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);
  connection.on("open", () => console.log("connection opened!"));
  connection.on("close", () => console.log("connection closed!"));
  connection.on("message", (message) => {
    // received message from client
    const result = JSON.parse(message.utf8Data);
    console.log("result", result);

    if (result.method === "create") {
      const clientId = result.clientId;
      const gameId = Date.now();
      games[gameId] = {
        id: gameId,
        balls: 20,
        clients: [],
      };

      const payload = {
        method: "create",
        game: games[gameId],
      };

      const con = clients[clientId].connection;
      con.send(JSON.stringify(payload));
    }

    if (result.method === "join") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];
      if (game.clients.length >= 3) {
        // sorry max player reached
        return;
      }
      const color = { 0: "Red", 1: "Green", 2: "Blue" }[game.clients.length];
      game.clients.push({
        clientId: clientId,
        color: color,
      });

      if (game.clients.length === 3) updateGameState();

      const payload = {
        method: "join",
        game: game,
      };

      game.clients.forEach((c) => {
        clients[c.clientId].connection.send(JSON.stringify(payload));
      });
    }

    if (result.method === "play") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const ballId = result.ballId;
      const color = result.color;

      let state = games[gameId].state;
      if (!state) state = {};

      state[ballId] = color;
      games[gameId].state = state;
    }
  });

  // generate new client id
  const clientId = Date.now();
  clients[clientId] = {
    connection: connection,
  };

  const payload = {
    method: "connect",
    clientId: clientId,
  };

  //   send back the client connect
  connection.send(JSON.stringify(payload));
});

function updateGameState() {
  for (const g of Object.keys(games)) {
    const payload = {
      method: "update",
      game: games[g],
    };
    games[g].clients.forEach((c) => {
      clients[c.clientId].connection.send(JSON.stringify(payload));
    });
  }

  setTimeout(updateGameState, 500);
}
