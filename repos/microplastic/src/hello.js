function hello(name = 'World') {
    return `Hello, ${name}!`;
}

// Export for use in other modules
module.exports = hello;

// Example usage
if (require.main === module) {
    console.log(hello());
    console.log(hello('Alice'));
}