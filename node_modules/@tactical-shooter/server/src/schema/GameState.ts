import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") rotation: number = 0;
    @type("number") health: number = 100;
    @type("boolean") active: boolean = true;
    @type("number") team: number = 0; // 0 for blue, 1 for red
    @type("number") weapon: number = 0; // 0 = pistol, 1 = shotgun
    @type("number") kills: number = 0;
}

export class GameState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
