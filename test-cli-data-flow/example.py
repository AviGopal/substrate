def calculate_total(items):
    total = 0
    for item in items:
        total = total + item
    return total

def unused_function():
    x = 10
    y = 20
    # This function is never called
    return x + y

# Potential bug: division by zero
def divide(a, b):
    return a / b

# Using eval (security issue)  
def run_code(code_str):
    return eval(code_str)

print("Test file for CLI analysis")
