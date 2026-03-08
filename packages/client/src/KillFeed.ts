import Phaser from 'phaser';

interface KillEntry {
    text: Phaser.GameObjects.Text;
    createdAt: number;
}

export default class KillFeed {
    private scene: Phaser.Scene;
    private entries: KillEntry[] = [];
    private maxEntries: number = 5;
    private displayTime: number = 4000; // ms
    private x: number;
    private y: number;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;
        this.x = x;
        this.y = y;
    }

    addKill(killerName: string, victimName: string, killerTeam: number) {
        const color = killerTeam === 0 ? '#66ccff' : '#ff6666';

        const text = this.scene.add.text(this.x, this.y, '', {
            font: '14px Arial',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
        });
        text.setScrollFactor(0);
        text.setDepth(1000);
        text.setText('');

        // Build styled text (Phaser doesn't natively support inline colors, so we use a simple format)
        text.setText(`${killerName} ⊳ ${victimName}`);
        text.setColor(color);

        const entry: KillEntry = {
            text,
            createdAt: this.scene.time.now,
        };

        this.entries.unshift(entry);

        // Remove overflow
        while (this.entries.length > this.maxEntries) {
            const old = this.entries.pop()!;
            old.text.destroy();
        }

        this.repositionEntries();
    }

    private repositionEntries() {
        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];
            entry.text.setPosition(this.x, this.y + i * 24);
            entry.text.setAlpha(1 - i * 0.15);
        }
    }

    update() {
        const now = this.scene.time.now;
        let changed = false;

        this.entries = this.entries.filter((entry) => {
            const age = now - entry.createdAt;
            if (age > this.displayTime) {
                entry.text.destroy();
                changed = true;
                return false;
            }
            // Fade in last second
            if (age > this.displayTime - 1000) {
                entry.text.setAlpha((this.displayTime - age) / 1000);
            }
            return true;
        });

        if (changed) this.repositionEntries();
    }
}
