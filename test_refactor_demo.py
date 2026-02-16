"""Demo file for testing activity system refactoring."""


def calculate_total(items):
    """Calculate the total price of items."""
    total = 0
    for item in items:
        total = total + item["price"]
    return total


def apply_discount(total, discount_percent):
    """Apply discount to total."""
    discount_amount = total * (discount_percent / 100)
    final_total = total - discount_amount
    return final_total


if __name__ == "__main__":
    items = [{"name": "Widget", "price": 10.00}, {"name": "Gadget", "price": 25.00}]
    total = calculate_total(items)
    final = apply_discount(total, 10)
    print(f"Final price: ${final:.2f}")
