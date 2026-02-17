export const INGREDIENT_NAMES = {
    'potato': '土豆',
    'pork': '猪肉',
    'tomato': '番茄',
    'egg': '鸡蛋',
    'onion': '洋葱',
    'garlic': '大蒜',
    'trash': '边角料'
};

export const RECIPES = [
    {
        name: "土豆炖肉",
        ingredients: ['potato', 'pork'],
        powerRatio: 2.5,
        type: 'damage'
    },
    {
        name: "番茄炒蛋",
        ingredients: ['tomato', 'egg'],
        powerRatio: 2.0,
        type: 'heal'
    },
    {
        name: "小炒肉",
        ingredients: ['pork', 'onion'],
        powerRatio: 2.0,
        type: 'aoe'
    },
    {
        name: "炸洋葱圈",
        ingredients: ['potato', 'onion'],
        powerRatio: 1.0,
        type: 'stun'
    },
    {
        name: "蒜泥土豆泥",
        ingredients: ['potato', 'garlic'],
        powerRatio: 2.5,
        type: 'stun'
    }
];

export class RecipeSystem {
    constructor() {
        // Map for quick lookup? 
        // Or just iterate since recipe list is short.
    }

    // Returns a list of available actions/recipes based on the grid state
    detectRecipes(grid) {
        const actions = [];

        // Iterate all cells
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const unit = grid.get(c, r);
                if (!unit || unit.owner !== 'player') continue;

                // Check ONLY Right and Down neighbors to avoid duplicates (A-B vs B-A)
                const neighbors = [
                    { c: c + 1, r: r }, // Right
                    { c: c, r: r + 1 }  // Down
                ];

                for (const n of neighbors) {
                    const neighborUnit = grid.get(n.c, n.r);
                    if (neighborUnit && neighborUnit.owner === 'player') {
                        const recipe = this.findRecipe(unit.type, neighborUnit.type);
                        if (recipe) {
                            actions.push({
                                source: unit,
                                target: neighborUnit,
                                recipe: recipe,
                                pos: { c, r }, // Position of Source
                                pairPos: { c1: c, r1: r, c2: n.c, r2: n.r } // For drawing lines
                            });
                        }
                    }
                }
            }
        }
        return actions;
    }

    findRecipe(typeA, typeB) {
        return RECIPES.find(r =>
            (r.ingredients[0] === typeA && r.ingredients[1] === typeB) ||
            (r.ingredients[0] === typeB && r.ingredients[1] === typeA)
        );
    }

    checkCompatibility(typeA, typeB) {
        return !!this.findRecipe(typeA, typeB);
    }
}
