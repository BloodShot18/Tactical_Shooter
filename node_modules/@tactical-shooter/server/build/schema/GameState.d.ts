import { Schema, MapSchema } from "@colyseus/schema";
export declare class PlayerState extends Schema {
    x: number;
    y: number;
    rotation: number;
    health: number;
    active: boolean;
    team: number;
    weapon: number;
    kills: number;
}
export declare class GameState extends Schema {
    players: MapSchema<PlayerState, string>;
}
