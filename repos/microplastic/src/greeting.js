/**
 * Simple greeting function that returns a greeting message
 * @param {string} name - The name to greet (optional)
 * @returns {string} A greeting message
 */
function greeting(name = 'World') {
    return `Hello, ${name}!`;
}

// Export the function for use in other modules
module.exports = greeting;

// Example usage
if (require.main === module) {
    console.log(greeting()); // "Hello, World!"
    console.log(greeting('Alice')); // "Hello, Alice!"
    console.log(greeting('Bob')); // "Hello, Bob!"
}