import Phaser from 'phaser';

export default class Minimap {
    private mapSize: number;
    private displaySize: number = 150;
    private padding: number = 10;
    private graphics: Phaser.GameObjects.Graphics;
    private container: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number) {
        this.mapSize = Math.max(mapWidth, mapHeight);

        const x = scene.cameras.main.width - this.displaySize - this.padding;
        const y = this.padding;

        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0);
        this.container.setDepth(999);

        // Background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.6);
        bg.fillRoundedRect(0, 0, this.displaySize, this.displaySize, 6);
        bg.lineStyle(2, 0x44ff44, 0.8);
        bg.strokeRoundedRect(0, 0, this.displaySize, this.displaySize, 6);
        this.container.add(bg);

        // Dot layer
        this.graphics = scene.add.graphics();
        this.container.add(this.graphics);
    }

    update(
        localPlayer: { x: number; y: number; active: boolean },
        remotePlayers: Map<string, { x: number; y: number; team: number; active: boolean }>,
        localTeam: number
    ) {
        this.graphics.clear();

        const scale = this.displaySize / this.mapSize;

        // Draw remote players
        remotePlayers.forEach((p) => {
            if (!p.active) return;
            const dotColor = p.team === 0 ? 0x3399ff : 0xff4444;
            const dx = p.x * scale;
            const dy = p.y * scale;
            this.graphics.fillStyle(dotColor, 1);
            this.graphics.fillCircle(dx, dy, 3);
        });

        // Draw local player on top (brighter, larger)
        if (localPlayer.active) {
            const localColor = localTeam === 0 ? 0x00eeff : 0xff6666;
            const lx = localPlayer.x * scale;
            const ly = localPlayer.y * scale;
            this.graphics.fillStyle(localColor, 1);
            this.graphics.fillCircle(lx, ly, 4);

            // White outline for emphasis
            this.graphics.lineStyle(1, 0xffffff, 0.8);
            this.graphics.strokeCircle(lx, ly, 5);
        }
    }
}
