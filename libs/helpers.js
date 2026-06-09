'use strict';

function snakeToClassName(snake) {
    return snake.split('_').map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join('');
}

function railsStyleKey(str) {
    const titleized = str
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    const stripped = titleized.replace(/[^0-9a-zA-Z]/g, '');
    const underscored = stripped
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z\d])([A-Z])/g, '$1_$2')
        .toLowerCase();
    return underscored;
}

module.exports = { snakeToClassName, railsStyleKey };
