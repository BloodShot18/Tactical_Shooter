import Phaser from 'phaser';
import { WEAPONS, WeaponConfig } from './Weapon';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private weaponKeys!: {
        key1: Phaser.Input.Keyboard.Key;
        key2: Phaser.Input.Keyboard.Key;
        reload: Phaser.Input.Keyboard.Key;
    };
    public speed: number = 200;
    private moveStick?: any;
    private shootStick?: any;

    // Weapon state
    public currentWeaponIndex: number = 0;
    public currentAmmo: number;
    public isReloading: boolean = false;
    private lastFired: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, moveStick?: any, shootStick?: any) {
        super(scene, x, y, 'player');
        this.moveStick = moveStick;
        this.shootStick = shootStick;
        this.currentAmmo = this.weapon.maxAmmo;

        // Add to scene and enable physics
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setDamping(true);
        this.setDrag(0.1);

        // Initialize inputs
        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.wasd = {
                up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
            this.weaponKeys = {
                key1: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
                key2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
                reload: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
            };
        }
    }

    get weapon(): WeaponConfig {
        return WEAPONS[this.currentWeaponIndex];
    }

    switchWeapon(index: number) {
        if (index === this.currentWeaponIndex) return;
        if (index < 0 || index >= WEAPONS.length) return;
        this.currentWeaponIndex = index;
        this.currentAmmo = WEAPONS[index].maxAmmo;
        this.isReloading = false;
        this.scene.events.emit('weapon-switch', index);
    }

    reload() {
        if (this.isReloading || this.currentAmmo === this.weapon.maxAmmo) return;
        this.isReloading = true;
        this.scene.time.delayedCall(this.weapon.reloadTime, () => {
            this.currentAmmo = this.weapon.maxAmmo;
            this.isReloading = false;
            this.scene.events.emit('ammo-change', this.currentAmmo, this.weapon.maxAmmo);
        });
    }

    update(_time?: number, _delta?: number) {
        if (!this.body) return;

        // Weapon switching
        if (this.weaponKeys) {
            if (Phaser.Input.Keyboard.JustDown(this.weaponKeys.key1)) this.switchWeapon(0);
            if (Phaser.Input.Keyboard.JustDown(this.weaponKeys.key2)) this.switchWeapon(1);
            if (Phaser.Input.Keyboard.JustDown(this.weaponKeys.reload)) this.reload();
        }

        let velocityX = 0;
        let velocityY = 0;

        // Horizontal movement
        if (this.cursors.left.isDown || this.wasd.left.isDown) velocityX = -1;
        else if (this.cursors.right.isDown || this.wasd.right.isDown) velocityX = 1;

        // Vertical movement
        if (this.cursors.up.isDown || this.wasd.up.isDown) velocityY = -1;
        else if (this.cursors.down.isDown || this.wasd.down.isDown) velocityY = 1;

        // Mobile input overrides
        if (this.moveStick && this.moveStick.force > 0) {
            velocityX = this.moveStick.forceX / this.moveStick.force;
            velocityY = this.moveStick.forceY / this.moveStick.force;
        }

        // Normalize
        const mag = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (mag > 0) {
            velocityX = (velocityX / mag) * this.speed;
            velocityY = (velocityY / mag) * this.speed;
        }

        this.setVelocity(velocityX, velocityY);

        // Rotation and Shooting
        const pointer = this.scene.input.activePointer;
        let isShooting = false;
        let angle = this.rotation;

        if (this.shootStick && this.shootStick.force > 0) {
            if (this.shootStick.force > 10) {
                angle = Math.atan2(this.shootStick.forceY, this.shootStick.forceX);
                isShooting = true;
            }
            this.setRotation(angle);
        } else if (pointer.isDown && (pointer as any).pointerType === 'mouse') {
            angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
            this.setRotation(angle);
            isShooting = true;
        }

        // Shooting action logic
        const wp = this.weapon;
        if (this.active && isShooting && !this.isReloading && this.currentAmmo > 0 && this.scene.time.now > this.lastFired) {
            this.lastFired = this.scene.time.now + wp.fireRate;
            this.currentAmmo--;

            // For multi-bullet weapons (shotgun), fire spread
            if (wp.bulletsPerShot > 1) {
                const halfSpread = wp.spread / 2;
                for (let i = 0; i < wp.bulletsPerShot; i++) {
                    const spreadAngle = angle - halfSpread + (wp.spread * i / (wp.bulletsPerShot - 1));
                    this.scene.events.emit('player-shoot', this.x, this.y, spreadAngle, this.currentWeaponIndex);
                }
            } else {
                this.scene.events.emit('player-shoot', this.x, this.y, angle, this.currentWeaponIndex);
            }

            this.scene.events.emit('ammo-change', this.currentAmmo, wp.maxAmmo);

            // Auto-reload when empty
            if (this.currentAmmo <= 0) {
                this.reload();
            }
        }
    }
}
