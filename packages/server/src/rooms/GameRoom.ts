import { Room, Client } from "@colyseus/core";
import { GameState, PlayerState } from "../schema/GameState";

// Damage per weapon: 0 = pistol, 1 = shotgun
const WEAPON_DAMAGE: Record<number, number> = {
    0: 25,
    1: 15,
};

export class GameRoom extends Room<GameState> {
    maxClients = 10;

    private nextTeam: number = 0;
    public score = {
        team0: 0,
        team1: 0
    };

    // Map width/height must match client
    private mapWidth = 2000;
    private mapHeight = 2000;

    onCreate() {
        this.setState(new GameState());

        // Handle movement input
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                player.rotation = data.rotation;
            }
        });

        // Handle weapon switch
        this.onMessage("switch_weapon", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && (data.weapon === 0 || data.weapon === 1)) {
                player.weapon = data.weapon;
            }
        });

        // Handle shoot input
        this.onMessage("shoot", (client, data) => {
            // Broadcast the shoot event to everyone except the shooter
            this.broadcast("player_shoot", {
                sessionId: client.sessionId,
                x: data.x,
                y: data.y,
                angle: data.angle,
                weapon: data.weapon ?? 0,
            }, { except: client });
        });

        // Handle hit registration
        this.onMessage("hit", (client, data) => {
            const target = this.state.players.get(data.targetId);
            const shooter = this.state.players.get(client.sessionId);

            if (target && target.active && shooter && shooter.team !== target.team) {
                const weaponId = data.weapon ?? 0;
                const damage = WEAPON_DAMAGE[weaponId] ?? 25;
                target.health -= damage;

                if (target.health <= 0) {
                    target.active = false;
                    target.health = 0;
                    shooter.kills++;

                    // Award point to shooter's team
                    if (shooter.team === 0) this.score.team0++;
                    else this.score.team1++;

                    this.broadcast("score_update", this.score);

                    // Broadcast kill event for kill feed
                    this.broadcast("kill", {
                        killerId: client.sessionId,
                        killerTeam: shooter.team,
                        victimId: data.targetId,
                    });

                    // Simple "respawn" timer after 3 seconds
                    this.clock.setTimeout(() => {
                        target.health = 100;
                        target.active = true;
                        // Pick new random location within map bounds
                        target.x = 200 + Math.random() * (this.mapWidth - 400);
                        target.y = 200 + Math.random() * (this.mapHeight - 400);
                    }, 3000);
                }
            }
        });
    }

    onJoin(client: Client) {
        console.log("Client joined:", client.sessionId);

        const player = new PlayerState();
        // Spawn at a somewhat random position within map bounds
        player.x = 200 + Math.random() * (this.mapWidth - 400);
        player.y = 200 + Math.random() * (this.mapHeight - 400);

        // Assign team
        player.team = this.nextTeam;
        this.nextTeam = this.nextTeam === 0 ? 1 : 0;

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client) {
        console.log("Client left:", client.sessionId);
        this.state.players.delete(client.sessionId);
    }
}
