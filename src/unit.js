import { INGREDIENT_NAMES } from './recipes.js';

export default class Unit {
    constructor(type, col, row, owner = 'player') {
        this.type = type;
        this.col = col;
        this.row = row;
        // Visual Position (Interpolated)
        this.visualCol = col;
        this.visualRow = row;

        this.owner = owner; // 'player', 'enemy'

        // Stats Defaults
        this.level = 1;
        this.maxHp = 20;
        this.attack = 3;
        this.defense = 0; // New Stat
        this.moveRange = 3;
        this.attackRange = 1;
        this.stunnedTurns = 0; // Turns remaining of stun

        // Custom Stats
        switch (type) {
            case 'trash':
                this.maxHp = 25; this.attack = 5; this.defense = 1; this.moveRange = 1; // Significantly Buffed
                break;
            case 'kitchen_demon':
                this.maxHp = 70; this.attack = 8; this.defense = 2; this.moveRange = 1; // BOSS
                break;
            case 'egg':
                this.maxHp = 12; this.attack = 1; this.defense = 0; this.moveRange = 4; // Fast
                break;
            case 'onion':
                this.maxHp = 22; this.attack = 2; this.defense = 1; this.moveRange = 3; this.attackRange = 2; // Mid-Range
                break;
            case 'garlic':
                this.maxHp = 18; this.attack = 1; this.defense = 2; this.moveRange = 2; // Tanky but slow
                break;
            case 'pork':
                this.maxHp = 28; this.attack = 4; this.defense = 1; this.moveRange = 3;
                break;
            case 'potato':
                this.maxHp = 40; this.attack = 2; this.defense = 2; this.moveRange = 2; // Tank
                break;
            case 'tomato':
                this.maxHp = 18; this.attack = 2; this.defense = 0; this.moveRange = 3; this.attackRange = 3; // Ranger
                break;
        }
        this.hp = this.maxHp;

        // Turn State
        this.hasMoved = false;
        this.hasAttacked = false;

        // Cooldowns
        this.skillCooldown = 0;
        this.recipeCooldown = 0; // Turns until can use recipe again
        this.maxRecipeCooldown = 2; // Default CD

        // Visual
        this.color = this.getColor();
    }

    getName() {
        return INGREDIENT_NAMES[this.type] || this.type.toUpperCase();
    }

    getColor() {
        if (this.type === 'kitchen_demon') return '#8b0000'; // Boss Red
        if (this.owner === 'enemy') return '#555';
        switch (this.type) {
            case 'potato': return '#d2b48c'; // Tan
            case 'pork': return '#ffb6c1'; // Light Pink
            case 'tomato': return '#ff6347'; // Tomato Red
            case 'egg': return '#fffacd'; // Lemon Chiffon (Yellow-ish White)
            case 'onion': return '#da70d6'; // Orchid (Purple)
            case 'garlic': return '#f5f5dc'; // Beige
            default: return '#fff';
        }
    }

    resetTurn() {
        this.hasMoved = false;
        this.hasAttacked = false;
        if (this.stunnedTurns > 0) this.stunnedTurns--;
    }

    isTurnOver() {
        return (this.hasMoved && this.hasAttacked) || this.stunnedTurns > 0;
    }

    upgrade() {
        this.level++;

        // Scale Stats (1.5x)
        this.maxHp = Math.floor(this.maxHp * 1.5);
        this.attack = Math.floor(this.attack * 1.5);
        this.defense += 1;

        // Full Heal
        this.hp = this.maxHp;

        // Reset turn state to allow immediate use if desired?
        // Or keep it used? Let's keep it used if it moved.
        // Actually, merging usually ends turn.
    }
}
