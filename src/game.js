import Grid from './grid.js';
import Unit from './unit.js';
import Renderer from './renderer.js';
import { RecipeSystem, RECIPES, INGREDIENT_NAMES } from './recipes.js';

export default class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Config
        this.cols = 6;
        this.rows = 6;
        this.tileSize = 80;

        // Systems
        this.grid = new Grid(this.cols, this.rows);
        this.renderer = new Renderer(this.ctx, this.tileSize);
        this.recipeSystem = new RecipeSystem();
        this.units = [];
        this.gold = 10;
        this.benchUnits = []; // Store Unit instances
        this.battleLevel = 1; // Current Level Count

        // Turn State
        this.turn = 'PLAYER'; // PLAYER, ENEMY
        this.state = 'IDLE'; // IDLE, MOVE, ACTION_SELECT, TARGETING

        this.selectedUnit = null;
        this.actionSource = null; // Unit performing action
        this.actionType = null; // 'ATTACK', 'SKILL'

        this.highlights = [];
        this.aoeHighlights = []; // For AOE splash preview
        this.ghostPreview = null; // For recipe preview

        // UI Wrapper
        this.uiLayer = document.createElement('div');
        this.uiLayer.style.position = 'absolute';
        this.uiLayer.style.top = '0';
        this.uiLayer.style.left = '0';
        this.uiLayer.style.width = '100vw';
        this.uiLayer.style.height = '100vh';
        this.uiLayer.style.pointerEvents = 'none'; // Init
        document.body.appendChild(this.uiLayer);

        // Input
        this.canvas.addEventListener('click', e => this.handleClick(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));

        // Init
        this.initLevel();

        // Initialize Recipe Book Button
        this.createRecipeBookButton();

        // End Turn Button
        this.createEndTurnButton();
    }

    initLevel() {
        // Balance: Smaller start, closer enemies
        this.addUnit('potato', 1, 1, 'player');
        this.addUnit('pork', 1, 2, 'player');

        // Enemies
        this.addUnit('trash', 4, 1, 'enemy');
        this.addUnit('trash', 5, 3, 'enemy');
        this.addUnit('trash', 4, 2, 'enemy');
    }

    addUnit(type, col, row, owner) {
        const u = new Unit(type, col, row, owner);
        this.units.push(u);
        return u;
    }

    update(dt) {
        // Animation Interpolation
        const speed = 10 * (dt / 1000); // 10 tiles per second approx
        this.units.forEach(u => {
            const dr = u.row - u.visualRow;
            const dc = u.col - u.visualCol;

            if (Math.abs(dr) < 0.05) u.visualRow = u.row;
            else u.visualRow += dr * 0.2; // Ease In

            if (Math.abs(dc) < 0.05) u.visualCol = u.col;
            else u.visualCol += dc * 0.2;
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'SHOP') {
            this.drawShop();
            return;
        }

        this.renderer.draw(this.grid, this.units, this.highlights);

        // Draw AOE Highlights
        if (this.aoeHighlights.length > 0) {
            this.renderer.drawHighlights(this.aoeHighlights);
        }

        // Draw Visual Connectors
        const connectorSources = [];
        if (this.selectedUnit) {
            connectorSources.push(this.selectedUnit);
        }

        // Also show for hovered unit if not selected
        const hoveredSource = this.getUnitAt(this.hoverCol, this.hoverRow);
        if (hoveredSource && hoveredSource.owner === 'player' && hoveredSource !== this.selectedUnit) {
            connectorSources.push(hoveredSource);
        }

        if (connectorSources.length > 0) {
            const connectors = [];

            connectorSources.forEach(source => {
                const players = this.units.filter(u => u.owner === 'player' && u !== source);
                players.forEach(p => {
                    // Check direct neighbors for immediate feedback? 
                    // Or global compatibility? Let's do global for now as per design doc (visual connectors)
                    // COOLDOWN CHECK VISUAL
                    if (source.recipeCooldown > 0 || p.recipeCooldown > 0) return;

                    if (this.recipeSystem.checkCompatibility(source.type, p.type)) {
                        connectors.push({
                            c1: source.col, r1: source.row,
                            c2: p.col, r2: p.row
                        });
                    }
                });
            });
            this.renderer.drawConnectors(connectors);
        }

        // Draw Ghost Preview
        if (this.ghostPreview) {
            this.renderer.drawGhost(this.ghostPreview);
        }

        // Draw Tooltip for Hover Unit
        const hoverUnit = this.getUnitAt(this.hoverCol, this.hoverRow);
        if (hoverUnit) {
            // Need mouse coordinates from handleMouseMove
            this.renderer.drawTooltip(hoverUnit, this.mouseX, this.mouseY);
        }

        // Draw Bench
        if (this.turn === 'PLAYER' && (this.state === 'IDLE' || this.state === 'MOVE' || this.state === 'SELECT_DEPLOY')) {
            this.drawBench();
        }
    }

    // --- INPUT ---

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.hoverCol = Math.floor(this.mouseX / this.tileSize);
        this.hoverRow = Math.floor(this.mouseY / this.tileSize);

        // Ghost Recipe Logic
        this.ghostPreview = null;
        if (this.selectedUnit && this.state === 'MOVE') {
            // If we moved selected unit here, would it form a recipe?
            const u = this.selectedUnit;

            // CD Check
            if (u.recipeCooldown > 0) return;

            // Check neighbors of hover tile
            const neighbors = [
                { c: this.hoverCol + 1, r: this.hoverRow },
                { c: this.hoverCol - 1, r: this.hoverRow },
                { c: this.hoverCol, r: this.hoverRow + 1 },
                { c: this.hoverCol, r: this.hoverRow - 1 }
            ];

            for (const n of neighbors) {
                const neighbor = this.getUnitAt(n.c, n.r);
                if (neighbor && neighbor !== u && neighbor.owner === 'player') {
                    // CD Check Neighbor
                    if (neighbor.recipeCooldown > 0) continue;

                    const recipe = this.recipeSystem.findRecipe(u.type, neighbor.type);
                    if (recipe) {
                        this.ghostPreview = {
                            col: this.hoverCol,
                            row: this.hoverRow,
                            recipe: recipe
                        };
                        break;
                    }
                }
            }
        }

        // AOE Targeting Preview
        this.aoeHighlights = [];
        if (this.state === 'TARGETING' && this.currentRecipe && this.currentRecipe.type === 'aoe') {
            // Check if hover cell is within attack highlights
            const isValidTarget = this.highlights.find(h => h.col === this.hoverCol && h.row === this.hoverRow);
            if (isValidTarget) {
                // Add Cross Pattern
                const splash = [
                    { col: this.hoverCol, row: this.hoverRow },
                    { col: this.hoverCol + 1, row: this.hoverRow },
                    { col: this.hoverCol - 1, row: this.hoverRow },
                    { col: this.hoverCol, row: this.hoverRow + 1 },
                    { col: this.hoverCol, row: this.hoverRow - 1 }
                ];
                splash.forEach(s => {
                    if (this.grid.isValid(s.col, s.row)) {
                        this.aoeHighlights.push({ col: s.col, row: s.row, color: 'rgba(255, 165, 0, 0.5)' }); // Orange
                    }
                });
            }
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);

        if (this.state === 'SHOP') {
            this.handleShopClick(x, y);
            return;
        }

        // Bench Click Detection (Y > rows * tileSize)
        if (y > 480) {
            this.handleBenchClick(x, y);
            return;
        }

        if (!this.grid.isValid(col, row)) return;

        if (this.turn !== 'PLAYER') return;

        if (this.state === 'IDLE') {
            this.handleSelect(col, row);
        } else if (this.state === 'MOVE') {
            this.handleMove(col, row);
        } else if (this.state === 'TARGETING') {
            this.handleTarget(col, row);
        }
    }

    handleSelect(col, row) {
        const unit = this.getUnitAt(col, row);
        if (unit && unit.owner === 'player' && !unit.isTurnOver()) {
            this.selectedUnit = unit;
            // Store original position for Cancel
            this.originalPos = { col: unit.col, row: unit.row };

            if (!unit.hasMoved) {
                this.state = 'MOVE';
                this.calculateMoveRange(unit);
            } else {
                // Already moved, skip to action
                this.showActionMenu(unit);
            }
        }
    }

    handleMove(col, row) {
        // Validation for Bench Deployment
        const isFromBench = this.selectedUnit.col === -1;
        if (isFromBench) {
            // Can only deploy to player side (col < 3)
            if (col >= 3) {
                this.renderer.addFloatingText("Too far!", col, row, 'red');
                return;
            }
        }

        // Check if valid move (if from bench, we might want custom highlight, but for now reuse or check empty)
        const valid = this.highlights.length === 0 || this.highlights.find(h => h.col === col && h.row === row);

        // If from bench and no highlights (meaning we just clicked a bench unit), we should have "Deploy" highlights.
        // Let's assume calculateMoveRange for bench units highlights col 0-2? 
        // Actually, let's keep it simple: allow any empty/mergeable in col 0-2.

        if (valid || isFromBench) {
            const targetUnit = this.getUnitAt(col, row);

            // MERGE CHECK
            if (targetUnit && targetUnit !== this.selectedUnit &&
                targetUnit.owner === this.selectedUnit.owner &&
                targetUnit.type === this.selectedUnit.type &&
                targetUnit.level === this.selectedUnit.level) {

                // Perform Merge
                targetUnit.upgrade();
                this.renderer.addFloatingText("MERGE!", col, row, 'gold');

                // Remove selected unit
                if (isFromBench) {
                    this.benchUnits = this.benchUnits.filter(u => u !== this.selectedUnit);
                } else {
                    this.units = this.units.filter(u => u !== this.selectedUnit);
                }

                // End Action
                this.selectedUnit = null;
                this.highlights = [];
                this.state = 'IDLE';

                targetUnit.hasMoved = true;
                targetUnit.hasAttacked = true;
                return;
            }

            // Normal Move / Deploy
            if (!targetUnit || targetUnit === this.selectedUnit) {
                if (isFromBench) {
                    // Move from bench to board
                    this.benchUnits = this.benchUnits.filter(u => u !== this.selectedUnit);
                    this.units.push(this.selectedUnit);
                    this.selectedUnit.col = col;
                    this.selectedUnit.row = row;
                    this.selectedUnit.hasMoved = true;
                    this.selectedUnit.hasAttacked = false; // Allow attack after deploy?
                } else {
                    this.selectedUnit.col = col;
                    this.selectedUnit.row = row;
                    this.selectedUnit.hasMoved = true;
                }

                this.highlights = [];
                this.showActionMenu(this.selectedUnit);
            }
        }

        // Cancel if invalid
        if (!valid && !isFromBench) {
            this.selectedUnit = null;
            this.highlights = [];
            this.state = 'IDLE';
        }
    }

    handleTarget(col, row) {
        // Check valid target
        const target = this.getUnitAt(col, row);
        const valid = this.highlights.find(h => h.col === col && h.row === row);

        if (valid && target && target.owner === 'enemy') {
            this.performAction(target);
        } else {
            // Cancel targeting
            this.state = 'IDLE';
            this.highlights = [];
            this.showActionMenu(this.selectedUnit); // Re-show menu
        }
    }

    // --- ACTIONS & MENU ---

    showActionMenu(unit) {
        this.state = 'ACTION_SELECT';
        this.highlights = []; // Clear move highlights

        // Position Menu near unit
        const screenX = this.canvas.offsetLeft + unit.col * this.tileSize + this.tileSize;
        const screenY = this.canvas.offsetTop + unit.row * this.tileSize;

        // Clear old menu
        this.uiLayer.innerHTML = '';
        this.uiLayer.style.pointerEvents = 'auto';

        const menu = document.createElement('div');
        menu.style.position = 'absolute';
        menu.style.left = screenX + 'px';
        menu.style.top = screenY + 'px';
        menu.style.background = '#333';
        menu.style.padding = '5px';
        menu.style.border = '1px solid #fff';

        // Attack Button
        if (!unit.hasAttacked) {
            const btnAtk = document.createElement('button');
            btnAtk.innerText = "普通攻击";
            btnAtk.onclick = () => this.startTargeting(unit, 'ATTACK');
            menu.appendChild(btnAtk);

            // Recipe Check
            const recipes = this.checkRecipes(unit);
            if (recipes.length > 0) {
                const btnSkill = document.createElement('button');
                const entry = recipes[0]; // { recipe, partner }
                const r = entry.recipe;
                const partner = entry.partner;

                // Calculate Power
                const power = Math.floor((unit.attack + partner.attack) * r.powerRatio);

                const typeLabel = r.type === 'damage' ? '伤害' :
                    r.type === 'heal' ? '治疗' :
                        r.type === 'aoe' ? '范围' :
                            r.type === 'stun' ? '眩晕' : '护盾';

                btnSkill.innerText = `技能: ${r.name}\n(${typeLabel} ${power})`; // Dynamic Power
                btnSkill.style.color = 'gold';
                btnSkill.onclick = () => this.startTargeting(unit, 'SKILL', r, partner);
                menu.appendChild(btnSkill);
            }
        }

        // Wait Button
        const btnWait = document.createElement('button');
        btnWait.innerText = "待机";
        btnWait.onclick = () => {
            unit.hasMoved = true;
            unit.hasAttacked = true;
            this.closeMenu();
        };
        menu.appendChild(btnWait);

        // Cancel Button
        const btnCancel = document.createElement('button');
        btnCancel.innerText = "取消";
        btnCancel.style.color = '#aaa';
        btnCancel.onclick = () => this.cancelMove();
        menu.appendChild(btnCancel);

        this.uiLayer.appendChild(menu);
    }

    cancelMove() {
        if (this.selectedUnit && this.originalPos) {
            this.selectedUnit.col = this.originalPos.col;
            this.selectedUnit.row = this.originalPos.row;
            this.selectedUnit.hasMoved = false;

            // Visual Snap
            this.selectedUnit.visualCol = this.originalPos.col;
            this.selectedUnit.visualRow = this.originalPos.row;

            this.selectedUnit = null;
            this.originalPos = null;
            this.state = 'IDLE';
            this.closeUI();
            this.highlights = [];
        }
    }

    startTargeting(unit, type, recipe = null, partner = null) {
        this.closeUI();
        this.state = 'TARGETING';
        this.actionSource = unit;
        this.actionPartner = partner; // Store partner for calculation
        this.actionType = type;
        this.currentRecipe = recipe;

        // Calculate Range
        const range = type === 'SKILL' ? 3 : unit.attackRange; // Skill has generic range 3 for now
        this.calculateAttackRange(unit, range);
    }

    handleTarget(col, row) {
        // Check valid target
        const target = this.getUnitAt(col, row);
        const valid = this.highlights.find(h => h.col === col && h.row === row);

        if (valid && target) {
            // Allow Enemy targeting ALWAYS
            // Allow Player targeting ONLY if Heal/Shield
            const isEnemy = target.owner === 'enemy';
            const isAlly = target.owner === 'player';
            const isSupport = this.currentRecipe && (this.currentRecipe.type === 'heal' || this.currentRecipe.type === 'shield');

            if (isEnemy || (isAlly && isSupport)) {
                this.performAction(target);
                return;
            }
        }

        // Cancel targeting if invalid click (or empty tile)
        this.state = 'IDLE';
        this.highlights = [];
        this.aoeHighlights = [];
        this.showActionMenu(this.selectedUnit); // Re-show menu
    }

    performAction(target) {
        const source = this.actionSource;
        const partner = this.actionPartner;
        const type = this.actionType === 'SKILL' && this.currentRecipe ? this.currentRecipe.type : 'damage';

        let power = source.attack;

        if (this.actionType === 'SKILL') {
            const partnerAtk = partner ? partner.attack : 0;
            power = Math.floor((source.attack + partnerAtk) * this.currentRecipe.powerRatio);
            this.renderer.addFloatingText(this.currentRecipe.name + "!", source.col, source.row, 'gold');

            // Set Cooldown
            source.recipeCooldown = source.maxRecipeCooldown;
            if (partner) partner.recipeCooldown = partner.maxRecipeCooldown;
        }

        switch (type) {
            case 'damage':
                this.dealDamage(target, power);
                break;
            case 'heal':
                target.hp = Math.min(target.maxHp, target.hp + power);
                this.renderer.addFloatingText(`+${power}`, target.col, target.row, 'green');
                break;
            case 'aoe':
                // Target + Neighbors
                const neighbors = [
                    target,
                    this.getUnitAt(target.col + 1, target.row),
                    this.getUnitAt(target.col - 1, target.row),
                    this.getUnitAt(target.col, target.row + 1),
                    this.getUnitAt(target.col, target.row - 1)
                ];
                neighbors.forEach(n => {
                    if (n && n.owner === target.owner) {
                        this.dealDamage(n, power);
                    }
                });
                break;
            case 'stun':
                this.dealDamage(target, power);
                target.stunnedTurns = 1;
                this.renderer.addFloatingText("眩晕!", target.col, target.row, 'yellow');
                break;
            case 'shield':
                // Temp HP or similar. For now just heal overhead
                target.hp += power;
                this.renderer.addFloatingText(`+${power} Shield`, target.col, target.row, 'cyan');
                break;
        }

        source.hasAttacked = true;
        source.hasMoved = true; // Ensure logic
        this.highlights = [];
        this.aoeHighlights = [];
        this.selectedUnit = null;
        this.state = 'IDLE';

        // Check Win after player action
        this.checkWinCondition();
    }

    dealDamage(target, amount) {
        // Damage Formula: Atk - Def, min 1
        const finalDamage = Math.max(1, amount - (target.defense || 0));
        target.hp -= finalDamage;
        this.renderer.addFloatingText(`-${finalDamage}`, target.col, target.row, 'red');

        // Check Dead
        if (target.hp <= 0) {
            this.renderer.addFloatingText("击杀!", target.col, target.row, '#555');
            this.units = this.units.filter(u => u !== target);
        }
    }

    checkWinCondition() {
        const enemies = this.units.filter(u => u.owner === 'enemy');
        // Bench units don't count for combat
        if (enemies.length === 0 && this.state !== 'SHOP') {
            // Short delay to let animations/floating text play out
            setTimeout(() => {
                if (this.units.filter(u => u.owner === 'enemy').length === 0) {
                    this.enterShop();
                }
            }, 500);
            return true;
        }
        return false;
    }

    checkRecipes(unit) {
        // Check CD
        if (unit.recipeCooldown > 0) return [];

        // Check adjacent Unit
        const adjacent = [
            { c: 0, r: 1 }, { c: 0, r: -1 }, { c: 1, r: 0 }, { c: -1, r: 0 }
        ];

        let found = [];
        for (const dir of adjacent) {
            const u = this.getUnitAt(unit.col + dir.c, unit.row + dir.r);
            if (u && u.owner === unit.owner) {
                // Partner CD Check
                if (u.recipeCooldown > 0) continue;

                const recipe = this.recipeSystem.findRecipe(unit.type, u.type);
                if (recipe) {
                    found.push({ recipe, partner: u });
                }
            }
        }
        return found;
    }

    // --- UTILS ---

    closeMenu() {
        this.closeUI();
        this.selectedUnit = null;
        this.state = 'IDLE';
    }

    closeUI() {
        this.uiLayer.innerHTML = '';
        this.uiLayer.style.pointerEvents = 'none';
        this.aoeHighlights = [];
        this.createEndTurnButton(); // Refill End Turn
        this.createRecipeBookButton(); // Refill Recipe Book
    }

    createEndTurnButton() {
        const btn = document.createElement('button');
        btn.innerText = "结束回合";
        btn.style.position = 'absolute';
        btn.style.bottom = '10px';
        btn.style.right = '10px';
        btn.style.pointerEvents = 'auto';
        btn.style.padding = '10px 20px';
        btn.style.fontSize = '16px';
        btn.onclick = () => this.endTurn();
        this.uiLayer.appendChild(btn);

        // CHEAT BUTTON
        const btnWin = document.createElement('button');
        btnWin.innerText = "一键胜利";
        btnWin.style.position = 'absolute';
        btnWin.style.bottom = '10px';
        btnWin.style.left = '10px';
        btnWin.style.pointerEvents = 'auto';
        btnWin.style.padding = '5px 10px';
        btnWin.style.fontSize = '12px';
        btnWin.style.background = '#000';
        btnWin.style.color = '#333';
        btnWin.onclick = () => {
            this.units = this.units.filter(u => u.owner !== 'enemy');
            this.enterShop();
        };
        this.uiLayer.appendChild(btnWin);
    }

    createRecipeBookButton() {
        const btn = document.createElement('button');
        btn.innerText = "菜谱图鉴";
        btn.style.position = 'absolute';
        btn.style.top = '10px';
        btn.style.right = '10px';
        btn.style.pointerEvents = 'auto';
        btn.style.padding = '5px 15px';
        btn.style.fontSize = '14px';
        btn.style.background = '#ffd700';
        btn.onclick = () => this.showRecipeBook();
        this.uiLayer.appendChild(btn);
    }

    endTurn() {
        if (this.turn === 'PLAYER') {
            this.turn = 'ENEMY';
            this.state = 'ENEMY_ACTING';

            // Dec Cooldowns
            this.units.filter(u => u.owner === 'player').forEach(u => {
                if (u.recipeCooldown > 0) u.recipeCooldown--;
            });

            setTimeout(() => this.runEnemyTurn(), 1000);
        }
    }

    async runEnemyTurn() {
        const enemies = this.units.filter(u => u.owner === 'enemy');

        for (const enemy of enemies) {
            if (enemy.hp <= 0 || enemy.isTurnOver()) continue;

            // Wait specific time for turn start/between actions
            await new Promise(r => setTimeout(r, 300));

            // 1. Find Target
            const players = this.units.filter(u => u.owner === 'player');
            if (players.length === 0) break;

            let target = null;
            let minD = Infinity;

            // Simple: Find nearest player unit
            for (const p of players) {
                const d = Math.abs(p.col - enemy.col) + Math.abs(p.row - enemy.row);
                if (d < minD) {
                    minD = d;
                    target = p;
                }
            }

            if (!target) continue;

            // 2. Move (if not already in range 1)
            let distToTarget = Math.abs(target.col - enemy.col) + Math.abs(target.row - enemy.row);

            if (distToTarget > 1) {
                const bestMove = this.findBestMove(enemy, target);
                if (bestMove) {
                    enemy.col = bestMove.col;
                    enemy.row = bestMove.row;
                    // Wait for move anim
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // 3. Attack (if in range 1)
            distToTarget = Math.abs(target.col - enemy.col) + Math.abs(target.row - enemy.row);
            if (distToTarget <= 1) {
                this.dealDamage(target, enemy.attack);
            }
        }

        // End Turn
        setTimeout(() => {
            // Check Win Condition
            if (!this.checkWinCondition()) {
                this.units.filter(u => u.owner === 'player').forEach(u => u.resetTurn());
                this.turn = 'PLAYER';
                this.state = 'IDLE';
            }
        }, 500);
    }

    findBestMove(unit, target) {
        const neighbors = [
            { c: unit.col + 1, r: unit.row },
            { c: unit.col - 1, r: unit.row },
            { c: unit.col, r: unit.row + 1 },
            { c: unit.col, r: unit.row - 1 }
        ];

        let best = null;
        let minD = Infinity;

        for (const n of neighbors) {
            if (n.c < 0 || n.c >= this.cols || n.r < 0 || n.r >= this.rows) continue;
            if (this.getUnitAt(n.c, n.r)) continue;

            const d = Math.abs(n.c - target.col) + Math.abs(n.r - target.row);
            if (d < minD) {
                minD = d;
                best = { col: n.c, row: n.r };
            }
        }
        return best;
    }

    calculateMoveRange(unit) {
        // Simple Manhattan, no walls
        this.highlights = [];
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                const dist = Math.abs(c - unit.col) + Math.abs(r - unit.row);

                if (dist <= unit.moveRange) {
                    const target = this.getUnitAt(c, r);

                    if (!target) {
                        // Empty Tile
                        this.highlights.push({ col: c, row: r, color: 'rgba(0, 0, 255, 0.3)' });
                    } else if (target !== unit &&
                        target.owner === unit.owner &&
                        target.type === unit.type &&
                        target.level === unit.level) {
                        // Merge Target
                        this.highlights.push({ col: c, row: r, color: 'rgba(0, 255, 0, 0.5)' });
                    }
                }
            }
        }
        // Add Self (Wait)
        this.highlights.push({ col: unit.col, row: unit.row, color: 'rgba(0, 0, 255, 0.3)' });
    }

    calculateAttackRange(unit, range) {
        this.highlights = [];
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                const dist = Math.abs(c - unit.col) + Math.abs(r - unit.row);
                if (dist <= range) {
                    this.highlights.push({ col: c, row: r, color: 'rgba(255, 0, 0, 0.3)' });
                }
            }
        }
    }

    getUnitAt(col, row) {
        return this.units.find(u => u.col === col && u.row === row);
    }

    // --- SHOP SYSTEM ---

    enterShop() {
        this.state = 'SHOP';
        this.highlights = [];
        this.selectedUnit = null;
        this.closeUI(); // Clear combat UI

        // Award Gold for Win
        this.gold += 10;
        // Maybe some notification?
        // "Victory! +10G"

        // Reroll immediately on entry? Or keep previous if we want persistence?
        // For now, auto-reroll on entry
        this.rerollShop(true);
    }

    rerollShop(free = false) {
        if (!free && this.gold < 2) return; // Cost 2

        if (!free) this.gold -= 2;

        const types = ['potato', 'pork', 'tomato', 'egg', 'onion', 'garlic'];
        this.shopCards = [];

        for (let i = 0; i < 3; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            // Random stats variance? Later.
            this.shopCards.push({
                type: type,
                cost: 3,
                id: Math.random() // Unique ID for keying
            });
        }
    }

    buyUnit(card) {
        if (this.gold >= card.cost) {
            this.gold -= card.cost;

            // Add to bench
            const unit = new Unit(card.type, -1, this.benchUnits.length, 'player');
            this.benchUnits.push(unit);

            // Remove from shop
            this.shopCards = this.shopCards.filter(c => c !== card);
        }
    }

    nextBattle() {
        this.state = 'IDLE';
        this.turn = 'PLAYER';
        this.battleLevel++;
        this.highlights = [];

        // 1. Reset Survivor Positions (Top-Left 2x3 area)
        const survivors = this.units.filter(u => u.owner === 'player');
        this.units = []; // Clear board for re-deployment

        survivors.forEach((u, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            u.col = col;
            u.row = row;
            u.visualCol = col;
            u.visualRow = row;
            u.hp = u.maxHp;
            u.resetTurn();
            this.units.push(u);
        });

        // 2. Generate New Enemies (Buffed)
        const enemyCount = Math.min(6, 3 + Math.floor(this.battleLevel / 2) + Math.floor(Math.random() * 2));
        for (let i = 0; i < enemyCount; i++) {
            const r = Math.floor(Math.random() * this.rows);
            const c = 3 + Math.floor(Math.random() * 3); // Spread in col 3-5
            if (!this.getUnitAt(c, r)) {
                const enemy = this.addUnit('trash', c, r, 'enemy');
                const targetLevel = Math.max(1, Math.floor(this.battleLevel / 1.2)); // Aggressive scaling
                while (enemy.level < targetLevel) {
                    enemy.upgrade();
                }
            }
        }
    }

    drawShop() {
        // Dark BG
        this.ctx.fillStyle = 'rgba(0,0,0,0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Title
        this.ctx.fillStyle = 'gold';
        this.ctx.font = 'bold 30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`料理商店 - 金币: ${this.gold}`, this.canvas.width / 2, 50);

        // Cards
        const cardW = 150;
        const cardH = 280; // Taller for recipes
        const gap = 20;
        const startX = (this.canvas.width - (3 * cardW + 2 * gap)) / 2;
        const startY = 60; // Moved up slightly

        this.shopCards.forEach((card, i) => {
            const x = startX + i * (cardW + gap);
            const y = startY;

            // Card BG
            this.ctx.fillStyle = '#444';
            this.ctx.fillRect(x, y, cardW, cardH);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(x, y, cardW, cardH);

            // Icon (Circle/Image)
            const cx = x + cardW / 2;
            const cy = y + 60;

            // Re-use unit drawing logic slightly?
            // Just draw manually for now
            this.ctx.fillStyle = this.getUnitColor(card.type);
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 30, 0, Math.PI * 2);
            this.ctx.fill();

            // Text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(card.type.toUpperCase(), cx, y + 110);

            this.ctx.fillStyle = 'gold';
            this.ctx.fillText(`Cost: ${card.cost}`, cx, y + 140);

            // Buy Button visual
            this.ctx.fillStyle = this.gold >= card.cost ? '#28a745' : '#555';
            this.ctx.fillRect(x + 10, y + 160, cardW - 20, 30);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px Arial';
            this.ctx.fillText("BUY", cx, y + 180);

            // Recipe Hints (Improved)
            const recipes = this.renderer.getRecipesForType(card.type);
            if (recipes.length > 0) {
                this.ctx.fillStyle = '#ccc';
                this.ctx.font = 'italic 12px Arial';
                this.ctx.fillText("可合成:", cx, y + 210);

                this.ctx.fillStyle = '#fff';
                this.ctx.font = '11px Arial';
                recipes.forEach((r, idx) => {
                    const partnerType = r.ingredients.find(ing => ing !== card.type) || card.type;
                    const partnerName = INGREDIENT_NAMES[partnerType];
                    this.ctx.fillText(`${partnerName} -> ${r.name}`, cx, y + 225 + idx * 14);
                });
            }

            // store rect for click
            card.rect = { x, y, w: cardW, h: cardH };
        });

        // Reroll Button
        this.ctx.fillStyle = '#f39c12';
        this.ctx.fillRect(this.canvas.width / 2 - 100, 350, 200, 40);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillText(`刷新 (2G)`, this.canvas.width / 2, 377);

        // Next Battle Button
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(this.canvas.width / 2 - 100, 410, 200, 40);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(`进入下一关`, this.canvas.width / 2, 437);
    }

    handleShopClick(x, y) {
        // Check Cards
        for (const card of this.shopCards) {
            if (card.rect && x >= card.rect.x && x <= card.rect.x + card.rect.w &&
                y >= card.rect.y && y <= card.rect.y + card.rect.h) {
                this.buyUnit(card);
                return;
            }
        }

        const cx = this.canvas.width / 2;
        if (x >= cx - 100 && x <= cx + 100 && y >= 350 && y <= 390) this.rerollShop();
        if (x >= cx - 100 && x <= cx + 100 && y >= 410 && y <= 450) this.nextBattle();
    }

    drawBench() {
        // Panel at bottom
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, 512, this.canvas.width, 88);
        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(0, 512, this.canvas.width, 88);

        this.benchUnits.forEach((u, i) => {
            const bx = i * (this.tileSize + 10) + 40;
            const by = 512 + 40;

            // Highlight if selected
            if (this.selectedUnit === u) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(bx - 32, by - 32, 64, 64);
            }

            this.renderer.drawUnit(u, bx, by);
        });
    }

    handleBenchClick(x, y) {
        const index = Math.floor((x - 10) / (this.tileSize + 10));
        if (index >= 0 && index < this.benchUnits.length) {
            const unit = this.benchUnits[index];
            this.selectedUnit = unit;
            this.state = 'MOVE';
            // Highlights for deployment
            this.highlights = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < 3; c++) {
                    this.highlights.push({ col: c, row: r, color: 'rgba(0, 255, 0, 0.2)' });
                }
            }
        } else {
            this.selectedUnit = null;
            this.state = 'IDLE';
            this.highlights = [];
        }
    }

    showRecipeBook() {
        this.closeUI();
        this.state = 'RECIPE_BOOK';
        this.uiLayer.style.pointerEvents = 'auto';

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '10%';
        overlay.style.left = '10%';
        overlay.style.width = '80%';
        overlay.style.height = '80%';
        overlay.style.background = 'rgba(0,0,0,0.95)';
        overlay.style.color = '#fff';
        overlay.style.padding = '20px';
        overlay.style.border = '2px solid gold';
        overlay.style.overflowY = 'auto';
        overlay.style.zIndex = '1000';

        const title = document.createElement('h2');
        title.innerText = "料理图鉴";
        title.style.textAlign = 'center';
        title.style.color = 'gold';
        overlay.appendChild(title);

        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        list.style.gap = '15px';
        list.style.marginTop = '20px';

        RECIPES.forEach(r => {
            const card = document.createElement('div');
            card.style.border = '1px solid #555';
            card.style.padding = '10px';
            card.style.background = '#222';

            const rName = document.createElement('div');
            rName.style.fontWeight = 'bold';
            rName.style.color = 'gold';
            rName.innerText = r.name;
            card.appendChild(rName);

            const rIng = document.createElement('div');
            rIng.style.fontSize = '12px';
            rIng.innerText = `原料: ${INGREDIENT_NAMES[r.ingredients[0]]} + ${INGREDIENT_NAMES[r.ingredients[1]]}`;
            card.appendChild(rIng);

            const rEff = document.createElement('div');
            rEff.style.fontSize = '12px';
            rEff.style.color = '#0f0';
            const typeLabel = r.type === 'damage' ? '伤害' :
                r.type === 'heal' ? '治疗' :
                    r.type === 'aoe' ? '范围' :
                        r.type === 'stun' ? '眩晕' : '护盾';
            rEff.innerText = `效果: ${typeLabel} (倍率 ${r.powerRatio}x)`;
            card.appendChild(rEff);

            list.appendChild(card);
        });

        overlay.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.innerText = "关闭";
        closeBtn.style.marginTop = '20px';
        closeBtn.style.display = 'block';
        closeBtn.style.margin = '20px auto 0';
        closeBtn.onclick = () => {
            this.state = 'IDLE';
            this.closeUI();
        };
        overlay.appendChild(closeBtn);

        this.uiLayer.appendChild(overlay);
    }

    getUnitColor(type) {
        // Quick helper
        switch (type) {
            case 'potato': return '#daa520';
            case 'pork': return '#ffb6c1';
            case 'tomato': return '#ff6347';
            case 'egg': return '#fffacd';
            case 'onion': return '#da70d6';
            case 'garlic': return '#f5f5dc';
            default: return '#888';
        }
    }
}
