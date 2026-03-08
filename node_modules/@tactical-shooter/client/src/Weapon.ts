export interface WeaponConfig {
    name: string;
    fireRate: number;      // ms between shots
    bulletsPerShot: number;
    spread: number;        // radians of spread for multi-bullet weapons
    damage: number;
    bulletSpeed: number;
    maxAmmo: number;
    reloadTime: number;    // ms
    bulletColor: number;
}

export const WEAPONS: WeaponConfig[] = [
    {
        name: 'Pistol',
        fireRate: 250,
        bulletsPerShot: 1,
        spread: 0,
        damage: 25,
        bulletSpeed: 900,
        maxAmmo: 12,
        reloadTime: 1200,
        bulletColor: 0xffff00,
    },
    {
        name: 'Shotgun',
        fireRate: 800,
        bulletsPerShot: 5,
        spread: 0.35, // ~20 degrees total spread
        damage: 15,
        bulletSpeed: 700,
        maxAmmo: 6,
        reloadTime: 2000,
        bulletColor: 0xff8800,
    },
];
