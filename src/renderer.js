import { RECIPES } from './recipes.js';

export default class Renderer {
    constructor(ctx, tileSize = 64) {
        this.ctx = ctx;
        this.tileSize = tileSize;
        this.floatingTexts = [];
        this.images = {};
        this.preloadImages();
    }

    preloadImages() {
        const types = ['potato', 'pork', 'tomato', 'egg', 'onion', 'garlic', 'trash'];
        types.forEach(type => {
            const img = new Image();
            img.src = `img/${type}.png`;
            img.onload = () => { this.images[type] = img; };
            // No error handler needed, plain check in draw
        });
    }

    draw(grid, units, highlights = []) {
        this.drawGrid(grid);
        this.drawHighlights(highlights);
        this.drawUnits(units);
        this.drawEffects(1 / 60); // Approx dt
    }

    drawGrid(grid) {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        for (let c = 0; c <= grid.cols; c++) {
            this.ctx.beginPath();
            this.ctx.moveTo(c * this.tileSize, 0);
            this.ctx.lineTo(c * this.tileSize, grid.rows * this.tileSize);
            this.ctx.stroke();
        }
        for (let r = 0; r <= grid.rows; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, r * this.tileSize);
            this.ctx.lineTo(grid.cols * this.tileSize, r * this.tileSize);
            this.ctx.stroke();
        }
    }

    drawHighlights(highlights) {
        highlights.forEach(h => {
            const x = h.col * this.tileSize;
            const y = h.row * this.tileSize;

            this.ctx.fillStyle = h.color || 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
        });
    }

    drawUnits(units) {
        units.forEach(unit => this.drawUnit(unit));
    }

    drawUnit(unit, cx, cy) {
        if (unit.hp <= 0) return;

        if (cx === undefined) cx = unit.visualCol * this.tileSize + this.tileSize / 2;
        if (cy === undefined) cy = unit.visualRow * this.tileSize + this.tileSize / 2;

        let r = this.tileSize * 0.4;
        if (unit.type === 'kitchen_demon') r *= 1.5; // Kitchen Demon is huge

        // Turn over? Darken
        if (unit.isTurnOver() && unit.owner === 'player') {
            this.ctx.globalAlpha = 0.6;
        }

        // Draw Image or Fallback Circle
        if (this.images[unit.type]) {
            const size = this.tileSize * 0.8;
            this.ctx.drawImage(this.images[unit.type], cx - size / 2, cy - size / 2, size, size);
        } else {
            // Body Fallback
            this.ctx.fillStyle = unit.color;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1.0;

        // HP Bar
        const hpW = 30;
        const hpH = 4;
        const barTop = cy + r + 5;
        this.ctx.fillStyle = '#f00';
        this.ctx.fillRect(cx - hpW / 2, barTop, hpW, hpH);
        this.ctx.fillStyle = '#0f0';
        this.ctx.fillRect(cx - hpW / 2, barTop, hpW * (unit.hp / unit.maxHp), hpH);

        // Name
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeText(unit.getName(), cx, cy);
        this.ctx.fillText(unit.getName(), cx, cy);

        // Turn Over Indicator
        if (unit.isTurnOver() && unit.owner === 'player') {
            this.ctx.fillStyle = '#bbb';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText("Zzz", cx + r, cy - r);
        }

        // Stun Indicator
        if (unit.stunnedTurns > 0) {
            this.ctx.fillStyle = '#ff00ff'; // Magenta for stun
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText("晕", cx, cy - r - 15);
        }

        // Level Indicator (Stars)
        if (unit.level > 1) {
            this.ctx.fillStyle = '#FFD700'; // Gold
            this.ctx.font = 'bold 16px Arial';
            this.ctx.shadowColor = '#000';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText("★".repeat(unit.level - 1), cx, cy - r - 8);
            this.ctx.shadowBlur = 0;
        }

        // Cooldown Indicator
        if (unit.recipeCooldown > 0) {
            this.ctx.fillStyle = '#ff4444';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText("CD", cx + r, cy + r);
        }
    }

    // Effect logic reused but simplified
    addFloatingText(text, col, row, color) {
        const x = col * this.tileSize + this.tileSize / 2;
        const y = row * this.tileSize;
        this.floatingTexts.push({ text, x, y, color, life: 1.0 });
    }

    drawEffects(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y -= 0.5; // Float up

            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            this.ctx.globalAlpha = ft.life;
            this.ctx.fillStyle = ft.color;
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.globalAlpha = 1.0;
        }
    }

    drawConnectors(connectors) {
        this.ctx.save();
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#ffd700'; // Gold color

        connectors.forEach(c => {
            const x1 = c.c1 * this.tileSize + this.tileSize / 2;
            const y1 = c.r1 * this.tileSize + this.tileSize / 2;
            const x2 = c.c2 * this.tileSize + this.tileSize / 2;
            const y2 = c.r2 * this.tileSize + this.tileSize / 2;

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();

            // Draw small icon in middle?
            // For now just line is enough
        });

        this.ctx.restore();
    }

    drawGhost(ghost) {
        if (!ghost) return;

        const x = ghost.col * this.tileSize;
        const y = ghost.row * this.tileSize;

        // Draw Ghost BG
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);

        // Draw Recipe Name
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("菜谱预览:", x + this.tileSize / 2, y + this.tileSize / 2 - 10);

        if (ghost.recipe) {
            this.ctx.fillStyle = '#d00';
            this.ctx.font = 'bold 12px Arial';
            // Show Name
            this.ctx.fillText(ghost.recipe.name, x + this.tileSize / 2, y + this.tileSize / 2 + 5);

            // Show Effect (e.g. HEAL 5)
            this.ctx.fillStyle = 'gold';
            this.ctx.font = 'bold 10px Arial';
            const typeLabel = ghost.recipe.type === 'damage' ? '伤害' :
                ghost.recipe.type === 'heal' ? '治疗' :
                    ghost.recipe.type === 'aoe' ? '范围' :
                        ghost.recipe.type === 'stun' ? '眩晕' : '护盾';
            this.ctx.fillText(`${typeLabel}`, x + this.tileSize / 2, y + this.tileSize / 2 + 20);
        }

    }

    drawTooltip(unit, x, y) {
        if (!unit) return;

        const padding = 10;
        const lineHeight = 18;
        const width = 130;
        const height = 135;

        // Prevent off-screen
        if (x + width > this.ctx.canvas.width) x -= width;
        if (y + height > this.ctx.canvas.height) y -= height;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);

        // Text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        let py = y + padding;

        // Name
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillStyle = unit.getColor();
        this.ctx.fillText(unit.getName(), x + padding, py);
        py += lineHeight + 4;

        // Stats
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(`生命: ${unit.hp}/${unit.maxHp}`, x + padding, py);
        py += lineHeight;
        this.ctx.fillText(`攻击: ${unit.attack}`, x + padding, py);
        py += lineHeight;
        this.ctx.fillText(`防御: ${unit.defense || 0}`, x + padding, py);
        py += lineHeight;
        this.ctx.fillText(`移动: ${unit.moveRange}`, x + padding, py);
        py += lineHeight;
        this.ctx.fillText(`射程: ${unit.attackRange}`, x + padding, py);
    }

    // Helper to find recipes for shop card
    getRecipesForType(type) {
        return RECIPES.filter(r => r.ingredients.includes(type));
    }
}
