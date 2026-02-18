export interface NameValidationResult {
  valid: boolean;
  errors: string[];
}

export const PROTECTED_NAMES: string[] = [
  "Secretariat", "Man o War", "Citation", "Seattle Slew", "Affirmed",
  "American Pharoah", "Justify", "Seabiscuit", "War Admiral", "Whirlaway",
  "Count Fleet", "Assault", "Gallant Fox", "Omaha", "Sir Barton",
  "Ruffian", "Zenyatta", "Winx", "Frankel", "Black Caviar",
  "Kelso", "Forego", "Spectacular Bid", "Alysheba", "Sunday Silence",
  "Cigar", "Curlin", "Rachel Alexandra", "California Chrome", "Arrogate",
];

export function validateHorseName(name: string): NameValidationResult {
  const errors: string[] = [];

  if (name.length > 18) {
    errors.push("Name exceeds 18 characters");
  }

  if (/\d/.test(name)) {
    errors.push("Name must not contain digits");
  }

  if (name.includes(".")) {
    errors.push("Name must not contain periods");
  }

  if (PROTECTED_NAMES.some((p) => p.toLowerCase() === name.toLowerCase())) {
    errors.push("Name is protected (registered champion)");
  }

  if (!/[a-zA-Z]/.test(name)) {
    errors.push("Name must contain at least one letter");
  }

  if (name !== name.trim()) {
    errors.push("Name must not have leading or trailing whitespace");
  }

  if (/  /.test(name)) {
    errors.push("Name must not contain consecutive spaces");
  }

  return { valid: errors.length === 0, errors };
}
