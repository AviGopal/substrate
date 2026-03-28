export function greet(name: string = 'World'): string {
  return `Hello, ${name}!`;
}

export function greetWithTime(name: string = 'World'): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${timeOfDay}, ${name}!`;
}