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
        const types = ['potato', 'pork', 'tomato', 'egg', 'onion', 'garlic', 'trash', 'kitchen_demon'];
        types.forEach(type => {
            const img = new Image();
            img.src = `img/${type}.png`;
            img.onload = () => { this.images[type] = img; };
            // No error handler needed, plain check in draw
        });
    }

    drawImageCentered(img, cx, cy, maxSize) {
        if (!img || !img.complete || img.naturalWidth === 0) return;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        let w, h;

        if (imgRatio > 1) {
            // Wide image
            w = maxSize;
            h = maxSize / imgRatio;
        } else {
            // Tall or square image
            h = maxSize;
            w = maxSize * imgRatio;
        }

        this.ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
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

        if (cx === undefined) cx = unit.visualCol * this.tileSize + this.tileSize / 2 + (unit.animOffset?.x || 0);
        if (cy === undefined) cy = unit.visualRow * this.tileSize + this.tileSize / 2 + (unit.animOffset?.y || 0);

        let r = this.tileSize * 0.4;
        if (unit.type === 'kitchen_demon') r *= 1.5; // Kitchen Demon is huge

        // 1. Draw Team Base (Ring under feet)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy + r * 0.8, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = unit.owner === 'player' ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
        this.ctx.fill();
        this.ctx.restore();

        // 2. Turn over? Stronger Darken
        const isExhausted = unit.isTurnOver() && unit.owner === 'player';
        if (isExhausted) {
            this.ctx.globalAlpha = 0.45;
        }

        // 3. Draw Image or Fallback Circle
        if (this.images[unit.type]) {
            this.drawImageCentered(this.images[unit.type], cx, cy, this.tileSize * 0.8);
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

        if (isExhausted) {
            // Add a slight grey tint overlay to further distinguish exhausted state
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1.0;

        // 4. HP Bar (Color-coded by side)
        const hpW = 38;
        const hpH = 4;
        const barTop = cy + r - 2;
        this.ctx.fillStyle = '#444'; // Background of bar
        this.ctx.fillRect(cx - hpW / 2, barTop, hpW, hpH);

        // Fill color based on owner
        this.ctx.fillStyle = unit.owner === 'player' ? '#0f0' : '#f00';
        this.ctx.fillRect(cx - hpW / 2, barTop, hpW * (unit.hp / unit.maxHp), hpH);

        // Name (At the very bottom of the tile)
        const nameY = cy + r + 4;
        this.ctx.fillStyle = isExhausted ? '#888' : '#fff';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeText(unit.getName(), cx, nameY);
        this.ctx.fillText(unit.getName(), cx, nameY);

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

    drawCutin(data, timer) {
        // Use logical pixels (clientWidth/Height) instead of buffer pixels (width/height)
        const width = this.ctx.canvas.clientWidth || 800;
        const height = this.ctx.canvas.clientHeight || 600;
        const progress = 1.0 - timer; // 0 to 1

        // 1. Dim Background
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);

        // 2. Banner Strip
        this.ctx.fillStyle = 'rgba(218, 165, 32, 0.8)'; // Goldenrod
        const bannerH = 120;
        const bannerY = height / 2 - bannerH / 2;
        this.ctx.fillRect(0, bannerY, width, bannerH);

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, bannerY);
        this.ctx.lineTo(width, bannerY);
        this.ctx.moveTo(0, bannerY + bannerH);
        this.ctx.lineTo(width, bannerY + bannerH);
        this.ctx.stroke();

        // 3. Portait Animations (In from sides)
        const portraitSize = 240;
        const slideDist = width * 0.25;

        // Easing for slide (first 0.4s)
        const slideProgress = Math.min(1.0, progress * 2.5);
        const easeOut = 1 - Math.pow(1 - slideProgress, 3);

        // Position: Meet in the middle-ish
        const leftX = -portraitSize / 2 + (slideDist + portraitSize / 2) * easeOut;
        const rightX = width + portraitSize / 2 - (slideDist + portraitSize / 2) * easeOut;
        const portraitY = height / 2;

        // Draw Left (Source)
        if (this.images[data.sourceType]) {
            this.drawImageCentered(this.images[data.sourceType], leftX, portraitY, portraitSize);
        }

        // Draw Right (Partner)
        if (data.partnerType && this.images[data.partnerType]) {
            this.drawImageCentered(this.images[data.partnerType], rightX, portraitY, portraitSize);
        }

        // 4. Skill Name text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'italic bold 40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Shadow for text
        this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
        this.ctx.shadowBlur = 10;
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeText(data.recipeName, width / 2, height / 2);
        this.ctx.fillText(data.recipeName, width / 2, height / 2);

        this.ctx.restore();
    }
}
