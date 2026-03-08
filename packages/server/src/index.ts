import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "http";
import cors from "cors";

import { GameRoom } from "./rooms/GameRoom";

import path from "path";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the client build directory
const clientBuildPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientBuildPath));

// Fallback to index.html for any other requests (SPA support)
app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

const server = http.createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server
    })
});

gameServer.define("game_room", GameRoom);

gameServer.listen(port).then(() => {
    console.log(`[GameServer] Listening on Port: ${port}`);
});
