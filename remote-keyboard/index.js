const http = require("http");
const app = require("express")();

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(4001, () => console.log("Listening on http port 4001"));

const httpServer = http.createServer();
httpServer.listen(4000, () => console.log("server is listening on port 4000"));

const websocketServer = require("websocket").server;
const wsServer = new websocketServer({
  httpServer: httpServer,
});

let users = {};
let boards = {};

wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);
  connection.on("open", () => console.log("connection opened!"));
  connection.on("close", () => console.log("connection closed!"));
  connection.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);

    if (result.method === "create") {
      const userId = result.userId;
      const boardId = "1";
      boards[boardId] = {
        id: boardId,
        users: [],
        acquired_by: null,
      };

      const payload = {
        method: "create",
        board: boards[boardId],
      };

      const con = users[userId].connection;
      con.send(JSON.stringify(payload));
    }

    if (result.method === "control") {
      const userId = result.userId;
      const boardId = result.boardId;
      const board = boards[boardId];

      updateBoardState();

      const color = { 0: "Yellow", 1: "Red" }[board.users.length];

      const user = board.users.find((user) => user.userId === userId);
      if (!user) {
        board.users.push({
          userId: userId,
          color: color,
        });
      }

      if (board.acquired_by == null) board.acquired_by = userId;

      const payload = {
        method: "control",
        board: board,
      };

      board.users.forEach((user) => {
        users[user.userId].connection.send(JSON.stringify(payload));
      });
    }

    if (result.method === "click") {
      const userId = result.userId;
      const boardId = result.boardId;
      const key = result.key;
      const color = result.color;

      if (boards[boardId].acquired_by === userId) {
        let state = boards[boardId]?.state;
        if (!state) state = {};
        state[key] = color;
        boards[boardId].state = state;
        boards[boardId].acquired_by = null;
      }
    }

    if (result.method === "timeout") {
      const userId = result.userId;
      const boardId = result.boardId;

      boards[boardId].acquired_by = null;

      updateBoardState();

      const payload = {
        method: "timeout",
        board: boards[boardId],
        userId: userId,
      };

      const con = users[userId].connection;
      con.send(JSON.stringify(payload));
    }
  });

  // generate new client id
  const userId = Date.now();
  users[userId] = {
    connection: connection,
  };

  const payload = {
    method: "connect",
    userId: userId,
  };

  //   send back the client connect
  connection.send(JSON.stringify(payload));
});

function updateBoardState() {
  for (const b of Object.keys(boards)) {
    const payload = {
      method: "update",
      board: boards[b],
    };
    boards[b].users.forEach((user) => {
      users[user.userId].connection.send(JSON.stringify(payload));
    });
  }

  setTimeout(updateBoardState, 500);
}
