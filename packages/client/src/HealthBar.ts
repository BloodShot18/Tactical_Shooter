import Phaser from 'phaser';

export default class HealthBar {
    private bar: Phaser.GameObjects.Graphics;
    private bg: Phaser.GameObjects.Graphics;
    private target: Phaser.GameObjects.Sprite;
    private width: number = 40;
    private height: number = 5;
    private offsetY: number = -28;
    private currentHealth: number = 100;
    private maxHealth: number = 100;

    constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
        this.target = target;
        this.bg = scene.add.graphics();
        this.bar = scene.add.graphics();
        this.draw();
    }

    setHealth(value: number) {
        this.currentHealth = Phaser.Math.Clamp(value, 0, this.maxHealth);
        this.draw();
    }

    update() {
        if (!this.target.active || !this.target.visible) {
            this.bar.setVisible(false);
            this.bg.setVisible(false);
            return;
        }
        this.bar.setVisible(true);
        this.bg.setVisible(true);
        this.bar.setPosition(this.target.x, this.target.y);
        this.bg.setPosition(this.target.x, this.target.y);
    }

    private draw() {
        const ratio = this.currentHealth / this.maxHealth;
        const halfW = this.width / 2;

        // Background (dark)
        this.bg.clear();
        this.bg.fillStyle(0x000000, 0.6);
        this.bg.fillRoundedRect(-halfW - 1, this.offsetY - 1, this.width + 2, this.height + 2, 2);

        // Foreground (health)
        this.bar.clear();
        let color = 0x00ff00;
        if (ratio < 0.6) color = 0xffcc00;
        if (ratio < 0.3) color = 0xff3333;

        this.bar.fillStyle(color, 0.9);
        this.bar.fillRoundedRect(-halfW, this.offsetY, this.width * ratio, this.height, 2);
    }

    destroy() {
        this.bar.destroy();
        this.bg.destroy();
    }
}
