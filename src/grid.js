export default class Grid {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.cells = new Array(cols * rows).fill(null);
    }

    isValid(col, row) {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }

    getIndex(col, row) {
        return row * this.cols + col;
    }

    get(col, row) {
        if (!this.isValid(col, row)) return null;
        return this.cells[this.getIndex(col, row)];
    }

    set(col, row, entity) {
        if (!this.isValid(col, row)) return;
        this.cells[this.getIndex(col, row)] = entity;
    }
}
