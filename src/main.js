import Game from './game.js';

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Initialize Game
    const game = new Game(canvas, ctx);

    // UI is now handled by Game class internally

    // Game Loop
    let lastTime = 0;
    function animate(timeStamp) {
        const deltaTime = timeStamp - lastTime;
        lastTime = timeStamp;

        game.update(deltaTime);
        game.draw(deltaTime); // Pass deltaTime

        requestAnimationFrame(animate);
    }

    animate(0);
});
