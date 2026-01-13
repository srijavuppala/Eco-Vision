export function randomId(prefix = "app") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

