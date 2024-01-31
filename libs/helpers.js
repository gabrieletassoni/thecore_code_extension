function snakeToClassName(snake) {
    return snake.split('_').map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join('');
}

module.exports = {
    snakeToClassName,
};