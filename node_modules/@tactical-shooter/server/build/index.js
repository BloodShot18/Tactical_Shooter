"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@colyseus/core");
const ws_transport_1 = require("@colyseus/ws-transport");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const GameRoom_1 = require("./rooms/GameRoom");
const path_1 = __importDefault(require("path"));
const port = Number(process.env.PORT || 2567);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from the client build directory
const clientBuildPath = path_1.default.join(__dirname, "../../client/dist");
app.use(express_1.default.static(clientBuildPath));
// Fallback to index.html for any other requests (SPA support)
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(clientBuildPath, "index.html"));
});
const server = http_1.default.createServer(app);
const gameServer = new core_1.Server({
    transport: new ws_transport_1.WebSocketTransport({
        server
    })
});
gameServer.define("game_room", GameRoom_1.GameRoom);
gameServer.listen(port).then(() => {
    console.log(`[GameServer] Listening on Port: ${port}`);
});
