export interface User {
  id: string;
  name: string;
  email: string;
}

export function getUserProfile(user: User): { name: string; email: string } {
  // BUG: No null check - crashes if user is null
  return {
    name: user.name,
    email: user.email
  };
}

export function authenticate(email: string, password: string): User | null {
  // Simplified auth logic
  if (email && password === "test123") {
    return { id: "1", name: "Test User", email };
  }
  return null;
}
