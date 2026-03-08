import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Make the bullet a small square to start
        this.setDisplaySize(8, 8);
        this.setTint(0xffff00); // Yellow
    }

    fire(x: number, y: number, angle: number, speed: number = 800) {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);

        this.scene.physics.velocityFromRotation(angle, speed, this.body?.velocity);
        this.setRotation(angle);
    }

    update(time: number, delta: number) {
        super.update(time, delta);

        // Destroy bullet if it goes out of map bounds
        if (this.x < -50 || this.x > 2050 ||
            this.y < -50 || this.y > 2050) {
            this.setActive(false);
            this.setVisible(false);
            this.destroy();
        }
    }
}
