import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import Player from './Player';
import Bullet from './Bullet';
import HealthBar from './HealthBar';
import Minimap from './Minimap';
import KillFeed from './KillFeed';
import SoundManager from './SoundManager';
import { WEAPONS } from './Weapon';
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

interface RemotePlayerData {
    sprite: Phaser.GameObjects.Sprite;
    healthBar: HealthBar;
    team: number;
    active: boolean;
    nameTag: Phaser.GameObjects.Text;
}

export default class GameScene extends Phaser.Scene {
    private client!: Colyseus.Client;
    private room!: Colyseus.Room;
    private player!: Player;
    private playerHealthBar!: HealthBar;
    private bullets!: Phaser.Physics.Arcade.Group;
    private remotePlayers: Map<string, RemotePlayerData> = new Map();
    private minimap!: Minimap;
    private killFeed!: KillFeed;
    private soundManager!: SoundManager;

    // HUD elements
    private healthText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private ammoText!: Phaser.GameObjects.Text;
    private weaponText!: Phaser.GameObjects.Text;
    private teamBanner!: Phaser.GameObjects.Graphics;

    // Death overlay
    private deathOverlay!: Phaser.GameObjects.Graphics;
    private deathText!: Phaser.GameObjects.Text;
    private respawnText!: Phaser.GameObjects.Text;
    private isDead: boolean = false;

    // Local state
    private localTeam: number = 0;

    constructor() {
        super('GameScene');
    }

    init() {
        this.soundManager = new SoundManager();
        this.connectServer();
    }

    async connectServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        const backendUrl = (host === 'localhost' || host === '127.0.0.1')
            ? 'ws://localhost:2567'
            : `${protocol}://${host}${port}`;

        this.client = new Colyseus.Client(backendUrl);
        try {
            this.room = await this.client.joinOrCreate('game_room');
            this.setupMultiplayer();
        } catch (e) {
            console.error('SERVER JOIN ERROR', e);
        }
    }

    preload() {
        // Textures generated in create()
    }

    create() {
        // --- Set up world bounds ---
        this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // --- Generate textures ---
        const graph = this.make.graphics({ x: 0, y: 0 });

        // Player texture
        graph.fillStyle(0x00ccff);
        graph.fillCircle(16, 16, 16);
        // Small direction indicator
        graph.fillStyle(0xffffff);
        graph.fillTriangle(28, 16, 20, 10, 20, 22);
        graph.generateTexture('player', 32, 32);
        graph.clear();

        // Bullet texture
        graph.fillStyle(0xffff00);
        graph.fillRect(0, 0, 8, 8);
        graph.generateTexture('bullet', 8, 8);
        graph.clear();

        // Grid background tile
        graph.fillStyle(0x0a0a12);
        graph.fillRect(0, 0, 64, 64);
        graph.lineStyle(1, 0x1a2a1a, 0.4);
        graph.strokeRect(0, 0, 64, 64);
        graph.generateTexture('ground', 64, 64);
        graph.clear();

        // Crate obstacle texture
        graph.fillStyle(0x554433);
        graph.fillRect(0, 0, 50, 50);
        graph.lineStyle(2, 0x887755);
        graph.strokeRect(2, 2, 46, 46);
        graph.lineBetween(0, 0, 50, 50);
        graph.lineBetween(50, 0, 0, 50);
        graph.generateTexture('crate', 50, 50);
        graph.clear();

        // Wall obstacle texture
        graph.fillStyle(0x666666);
        graph.fillRect(0, 0, 120, 20);
        graph.lineStyle(1, 0x888888);
        graph.strokeRect(1, 1, 118, 18);
        graph.generateTexture('wall', 120, 20);
        graph.clear();

        graph.destroy();

        // --- Tiled background ---
        this.add.tileSprite(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 'ground');

        // --- Map border walls ---
        this.addBorderWalls();

        // --- Bullets group ---
        this.bullets = this.physics.add.group({
            classType: Bullet,
            maxSize: 50,
            runChildUpdate: true
        });

        // --- Virtual Joysticks ---
        const moveStick = new VirtualJoystick(this, {
            x: 100,
            y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5).setScrollFactor(0).setDepth(900),
            thumb: this.add.circle(0, 0, 25, 0xcccccc, 0.5).setScrollFactor(0).setDepth(901),
            dir: '8dir',
        });

        const shootStick = new VirtualJoystick(this, {
            x: window.innerWidth - 100,
            y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5).setScrollFactor(0).setDepth(900),
            thumb: this.add.circle(0, 0, 25, 0xff0000, 0.5).setScrollFactor(0).setDepth(901),
            dir: '8dir',
        });

        // --- Player ---
        this.player = new Player(this, MAP_WIDTH / 2, MAP_HEIGHT / 2, moveStick, shootStick);
        this.playerHealthBar = new HealthBar(this, this.player);

        // --- Shooting listener ---
        this.events.on('player-shoot', (x: number, y: number, angle: number, weaponId: number) => {
            const bullet = this.bullets.get() as Bullet;
            if (bullet) {
                const wp = WEAPONS[weaponId];
                bullet.fire(x, y, angle, wp.bulletSpeed);
                bullet.setTint(wp.bulletColor);
                this.soundManager.playShoot(weaponId);
                if (this.room) {
                    this.room.send('shoot', { x, y, angle, weapon: weaponId });
                }
            }
        });

        // --- Weapon switch listener ---
        this.events.on('weapon-switch', (weaponId: number) => {
            if (this.room) {
                this.room.send('switch_weapon', { weapon: weaponId });
            }
            this.updateWeaponHUD();
        });

        // --- Ammo change listener ---
        this.events.on('ammo-change', () => {
            this.updateWeaponHUD();
        });

        // --- Camera ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1);

        // --- HUD ---
        this.createHUD();

        // --- Minimap ---
        this.minimap = new Minimap(this, MAP_WIDTH, MAP_HEIGHT);

        // --- Kill Feed ---
        this.killFeed = new KillFeed(this, window.innerWidth - 250, 170);

        // --- Obstacles ---
        this.addObstacles();

        // --- Death Overlay (hidden initially) ---
        this.createDeathOverlay();
    }

    private createHUD() {
        // Team banner at top
        this.teamBanner = this.add.graphics();
        this.teamBanner.setScrollFactor(0);
        this.teamBanner.setDepth(800);
        this.drawTeamBanner();

        const hStyle = {
            font: 'bold 20px Arial',
            color: '#00ff88',
            backgroundColor: '#00000099',
            padding: { x: 8, y: 4 },
        };

        this.healthText = this.add.text(10, 45, 'HP: 100', hStyle);
        this.healthText.setScrollFactor(0).setDepth(800);

        this.scoreText = this.add.text(window.innerWidth / 2 - 80, 8, 'BLUE 0 — RED 0', {
            font: 'bold 18px Arial',
            color: '#ffffff',
            backgroundColor: '#00000099',
            padding: { x: 12, y: 6 },
        });
        this.scoreText.setScrollFactor(0).setDepth(801);

        // Weapon & Ammo HUD at bottom center
        this.weaponText = this.add.text(window.innerWidth / 2 - 80, window.innerHeight - 50, 'PISTOL', {
            font: 'bold 16px Arial',
            color: '#ffcc00',
            backgroundColor: '#00000099',
            padding: { x: 8, y: 4 },
        });
        this.weaponText.setScrollFactor(0).setDepth(800);

        this.ammoText = this.add.text(window.innerWidth / 2 + 10, window.innerHeight - 50, '12 / 12', {
            font: 'bold 16px Arial',
            color: '#ffffff',
            backgroundColor: '#00000099',
            padding: { x: 8, y: 4 },
        });
        this.ammoText.setScrollFactor(0).setDepth(800);

        // Instructions
        const instructions = this.add.text(10, 10, 'WASD: Move  |  Mouse: Aim & Shoot  |  1/2: Weapon  |  R: Reload', {
            font: '13px Arial',
            color: '#aaaaaa',
            backgroundColor: '#00000077',
            padding: { x: 6, y: 3 },
        });
        instructions.setScrollFactor(0).setDepth(800);
    }

    private drawTeamBanner() {
        this.teamBanner.clear();
        const color = this.localTeam === 0 ? 0x0066cc : 0xcc2200;
        this.teamBanner.fillStyle(color, 0.25);
        this.teamBanner.fillRect(0, 0, window.innerWidth, 38);
    }

    private updateWeaponHUD() {
        if (!this.weaponText || !this.ammoText) return;
        const wp = WEAPONS[this.player.currentWeaponIndex];
        this.weaponText.setText(wp.name.toUpperCase());
        this.ammoText.setText(`${this.player.currentAmmo} / ${wp.maxAmmo}`);

        if (this.player.isReloading) {
            this.ammoText.setText('RELOADING...');
            this.ammoText.setColor('#ff6666');
        } else {
            this.ammoText.setColor('#ffffff');
        }
    }

    private createDeathOverlay() {
        // Dark overlay
        this.deathOverlay = this.add.graphics();
        this.deathOverlay.setScrollFactor(0);
        this.deathOverlay.setDepth(950);
        this.deathOverlay.fillStyle(0x000000, 0.7);
        this.deathOverlay.fillRect(0, 0, window.innerWidth, window.innerHeight);
        this.deathOverlay.setVisible(false);

        this.deathText = this.add.text(window.innerWidth / 2, window.innerHeight / 2 - 40, 'YOU DIED', {
            font: 'bold 64px Arial',
            color: '#ff3333',
            stroke: '#000000',
            strokeThickness: 4,
        });
        this.deathText.setOrigin(0.5).setScrollFactor(0).setDepth(951);
        this.deathText.setVisible(false);

        this.respawnText = this.add.text(window.innerWidth / 2, window.innerHeight / 2 + 30, 'Respawning in 3...', {
            font: '24px Arial',
            color: '#cccccc',
        });
        this.respawnText.setOrigin(0.5).setScrollFactor(0).setDepth(951);
        this.respawnText.setVisible(false);
    }

    private showDeathScreen() {
        this.isDead = true;
        this.deathOverlay.setVisible(true);
        this.deathText.setVisible(true);
        this.respawnText.setVisible(true);
        this.soundManager.playDeath();

        let countdown = 3;
        this.respawnText.setText(`Respawning in ${countdown}...`);

        this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                countdown--;
                if (countdown > 0) {
                    this.respawnText.setText(`Respawning in ${countdown}...`);
                } else {
                    this.respawnText.setText('Respawning...');
                }
            },
        });
    }

    private hideDeathScreen() {
        this.isDead = false;
        this.deathOverlay.setVisible(false);
        this.deathText.setVisible(false);
        this.respawnText.setVisible(false);
        this.soundManager.playRespawn();
    }

    private setupMultiplayer() {
        // Listen for new players joining
        this.room.state.players.onAdd((player: any, sessionId: string) => {
            const isLocal = sessionId === this.room.sessionId;
            const playerColor = player.team === 0 ? 0x00ccff : 0xff3333;

            if (isLocal) {
                this.player.setPosition(player.x, player.y);
                this.player.setTint(playerColor);
                this.localTeam = player.team;
                this.drawTeamBanner();
            } else {
                const remoteSprite = this.add.sprite(player.x, player.y, 'player');
                remoteSprite.setTint(playerColor);

                const healthBar = new HealthBar(this, remoteSprite);

                const nameTag = this.add.text(player.x, player.y - 38, `Player`, {
                    font: '11px Arial',
                    color: player.team === 0 ? '#66ccff' : '#ff6666',
                });
                nameTag.setOrigin(0.5);

                this.remotePlayers.set(sessionId, {
                    sprite: remoteSprite,
                    healthBar,
                    team: player.team,
                    active: player.active,
                    nameTag,
                });
            }

            // Listen for changes
            player.onChange(() => {
                if (sessionId !== this.room.sessionId) {
                    const remote = this.remotePlayers.get(sessionId);
                    if (remote) {
                        remote.sprite.setPosition(player.x, player.y);
                        remote.sprite.setRotation(player.rotation);
                        remote.healthBar.setHealth(player.health);
                        remote.healthBar.update();
                        remote.nameTag.setPosition(player.x, player.y - 38);
                        remote.active = player.active;
                        remote.sprite.setActive(player.active);
                        remote.sprite.setVisible(player.active);
                        remote.nameTag.setVisible(player.active);
                        if (!player.active) {
                            remote.sprite.setPosition(-1000, -1000);
                            remote.nameTag.setPosition(-1000, -1000);
                        }
                    }
                } else {
                    // Local player state
                    this.player.setActive(player.active);
                    this.player.setVisible(player.active);
                    this.playerHealthBar.setHealth(player.health);

                    if (this.healthText) {
                        this.healthText.setText(`HP: ${player.health}`);
                        if (player.health > 60) this.healthText.setColor('#00ff88');
                        else if (player.health > 30) this.healthText.setColor('#ffcc00');
                        else this.healthText.setColor('#ff3333');
                    }

                    // Death handling
                    if (!player.active && !this.isDead) {
                        this.showDeathScreen();
                    } else if (player.active && this.isDead) {
                        this.hideDeathScreen();
                    }
                }
            });
        });

        // Listen for players leaving
        this.room.state.players.onRemove((_player: any, sessionId: string) => {
            const remote = this.remotePlayers.get(sessionId);
            if (remote) {
                remote.sprite.destroy();
                remote.healthBar.destroy();
                remote.nameTag.destroy();
                this.remotePlayers.delete(sessionId);
            }
        });

        // Remote shooting
        this.room.onMessage("player_shoot", (data) => {
            const bullet = this.bullets.get() as Bullet;
            if (bullet) {
                const wp = WEAPONS[data.weapon ?? 0];
                bullet.fire(data.x, data.y, data.angle, wp.bulletSpeed);
                bullet.setTint(wp.bulletColor);
            }
        });

        // Score updates
        this.room.onMessage("score_update", (score) => {
            if (this.scoreText) {
                this.scoreText.setText(`BLUE ${score.team0} — RED ${score.team1}`);
            }
        });

        // Kill event for kill feed
        this.room.onMessage("kill", (data) => {
            const killerLabel = data.killerId === this.room.sessionId ? 'You' : `Player`;
            const victimLabel = data.victimId === this.room.sessionId ? 'You' : `Player`;
            this.killFeed.addKill(killerLabel, victimLabel, data.killerTeam);
            this.soundManager.playHit();
        });
    }

    private addBorderWalls() {
        const borderGraphics = this.make.graphics({ x: 0, y: 0 });
        const thickness = 16;

        borderGraphics.fillStyle(0xff3300, 0.6);
        borderGraphics.fillRect(0, 0, MAP_WIDTH, thickness); // Top
        borderGraphics.fillRect(0, MAP_HEIGHT - thickness, MAP_WIDTH, thickness); // Bottom
        borderGraphics.fillRect(0, 0, thickness, MAP_HEIGHT); // Left
        borderGraphics.fillRect(MAP_WIDTH - thickness, 0, thickness, MAP_HEIGHT); // Right
        borderGraphics.generateTexture('border', MAP_WIDTH, MAP_HEIGHT);
        borderGraphics.destroy();

        // We just draw the border as visible graphics (no collision needed — world bounds handle it)
        const borderVisual = this.add.graphics();
        borderVisual.fillStyle(0xff3300, 0.3);
        borderVisual.fillRect(0, 0, MAP_WIDTH, thickness);
        borderVisual.fillRect(0, MAP_HEIGHT - thickness, MAP_WIDTH, thickness);
        borderVisual.fillRect(0, 0, thickness, MAP_HEIGHT);
        borderVisual.fillRect(MAP_WIDTH - thickness, 0, thickness, MAP_HEIGHT);
    }

    private addObstacles() {
        const obstacles = this.physics.add.staticGroup();

        // Fixed strategic positions for cover
        const cratePositions = [
            { x: 400, y: 400 }, { x: 600, y: 300 }, { x: 800, y: 600 },
            { x: 1000, y: 400 }, { x: 1200, y: 800 }, { x: 500, y: 1000 },
            { x: 1400, y: 600 }, { x: 700, y: 1400 }, { x: 1500, y: 1200 },
            { x: 1000, y: 1000 }, { x: 300, y: 1500 }, { x: 1600, y: 400 },
            { x: 1100, y: 1600 }, { x: 400, y: 1800 }, { x: 1700, y: 1700 },
        ];

        cratePositions.forEach(pos => {
            obstacles.create(pos.x, pos.y, 'crate');
        });

        // Wall segments for cover
        const wallPositions = [
            { x: 500, y: 700, angle: 0 }, { x: 900, y: 500, angle: Math.PI / 2 },
            { x: 1300, y: 1000, angle: 0 }, { x: 700, y: 1200, angle: Math.PI / 4 },
            { x: 1500, y: 800, angle: Math.PI / 2 }, { x: 1000, y: 1500, angle: 0 },
        ];

        wallPositions.forEach(pos => {
            const wall = obstacles.create(pos.x, pos.y, 'wall') as Phaser.Physics.Arcade.Image;
            wall.setRotation(pos.angle);
        });

        // Collisions
        this.physics.add.collider(this.player, obstacles);
        this.physics.add.collider(this.bullets, obstacles, (b) => {
            const bullet = b as Phaser.Physics.Arcade.Sprite;
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.destroy();
        });
    }

    update(time: number, delta: number) {
        // Don't process input if dead
        if (!this.isDead) {
            this.player.update(time, delta);
        }

        // Update health bar positions
        this.playerHealthBar.update();

        // Update minimap
        if (this.minimap) {
            const remoteData = new Map<string, { x: number; y: number; team: number; active: boolean }>();
            this.remotePlayers.forEach((data, key) => {
                remoteData.set(key, {
                    x: data.sprite.x,
                    y: data.sprite.y,
                    team: data.team,
                    active: data.active,
                });
            });
            this.minimap.update(
                { x: this.player.x, y: this.player.y, active: this.player.active },
                remoteData,
                this.localTeam
            );
        }

        // Update kill feed
        if (this.killFeed) {
            this.killFeed.update();
        }

        // Update weapon HUD periodically (for reload state)
        this.updateWeaponHUD();

        // Send position to server
        if (this.room && !this.isDead) {
            this.room.send("move", {
                x: this.player.x,
                y: this.player.y,
                rotation: this.player.rotation
            });
        }

        // Bullet-to-remote-player collision (check dynamically since players can join anytime)
        this.remotePlayers.forEach((remoteData, sessionId) => {
            if (!remoteData.active) return;
            const sprite = remoteData.sprite;

            // Simple distance-based hit check (since remote sprites aren't physics objects)
            this.bullets.children.each((b: any) => {
                const bullet = b as Phaser.Physics.Arcade.Sprite;
                if (bullet.active && Phaser.Math.Distance.Between(bullet.x, bullet.y, sprite.x, sprite.y) < 20) {
                    if (this.room) {
                        this.room.send("hit", { targetId: sessionId, weapon: this.player.currentWeaponIndex });
                        bullet.setActive(false);
                        bullet.setVisible(false);
                        bullet.destroy();
                    }
                }
                return true;
            });
        });
    }
}
