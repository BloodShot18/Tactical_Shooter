import { Room, Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
export declare class GameRoom extends Room<GameState> {
    maxClients: number;
    private nextTeam;
    score: {
        team0: number;
        team1: number;
    };
    private mapWidth;
    private mapHeight;
    onCreate(): void;
    onJoin(client: Client): void;
    onLeave(client: Client): void;
}
