// Refactored version using reduce
function calculateTotal(items) {
  return items.reduce((total, item) => total + item.price, 0);
}

module.exports = { calculateTotal };
