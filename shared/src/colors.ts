export type CardColor = 'white' | 'blue' | 'black' | 'red' | 'green';
export type Mana = CardColor | 'colorless';
export const cardColors = ['white', 'blue', 'black', 'red', 'green'] as const;
export const wubrg = ['w', 'u', 'b', 'r', 'g'] as const;
export type CardColorCharacter = typeof wubrg[number];

export const colorToShort = (color: CardColor): CardColorCharacter => {
  switch (color) {
    case 'white': return 'w';
    case 'blue': return 'u';
    case 'black': return 'b';
    case 'red': return 'r';
    case 'green': return 'g';
  }
}

export const colorToLong = (color: CardColorCharacter): CardColor => {
  switch (color) {
    case 'w': return 'white';
    case 'u': return 'blue';
    case 'b': return 'black';
    case 'r': return 'red';
    case 'g': return 'green';
    default: throw new Error(`Unknown color: ${color}`);
  }
}

export const toOrderedColors = (_colors: CardColor[]): CardColor[] => {
  // Break early for empty or single color arrays
  if (_colors.length === 0) return [];
  if (_colors.length === 1) return [..._colors];

  // Check for duplicates
  const uniqueColors = new Set(_colors);
  if (uniqueColors.size !== _colors.length) {
    throw new Error(`duplicate colors found in: [${_colors.join(', ')}]`);
  }

  // Check that each color in set is a valid card color
  for (const color of uniqueColors) {
    if (!cardColors.includes(color)) {
      throw new Error(`invalid color "${color}" found in: [${_colors.join(', ')}]`);
    }
  }
  const wubrgOrdered = cardColors.filter(color => uniqueColors.has(color));

  // If two colors are present, ...
  if (wubrgOrdered.length === 2) {
    const indexA = cardColors.indexOf(wubrgOrdered[0]);
    const indexB = cardColors.indexOf(wubrgOrdered[1]);

    // If their neighboring colors are present, return them in WUBRG order, and for green/white return them in reverse order
    if ((indexB - indexA) === 1) {
      return wubrgOrdered;
    }
    if (indexA === 0 && indexB === 4) {
      return wubrgOrdered.reverse();
    }

    // If the two colors are not neighboring, return them in WUBRG order, except for white/red and blue/green which should be reversed
    if ((indexB - indexA) === 2) {
      return wubrgOrdered;
    }
    if ((indexA === 0 && indexB === 3) || (indexA === 1 && indexB === 4)) {
      return wubrgOrdered.reverse();
    }
  }

  // If three colors are present, ...
  if (wubrgOrdered.length === 3) {
    const indexA = cardColors.indexOf(wubrgOrdered[0]);
    const indexB = cardColors.indexOf(wubrgOrdered[1]);
    const indexC = cardColors.indexOf(wubrgOrdered[2]);

    // If the colors are in a sequence, return them in WUBRG order
    if ((indexB - indexA) === 1 && (indexC - indexB) === 1) {
      return wubrgOrdered;
    }
    if ((indexA === 0 && indexB === 1 && indexC === 4)) {
      return ['green', 'white', 'blue'];
    }
    if ((indexA === 0 && indexB === 3 && indexC === 4)) {
      return ['red', 'green', 'white'];
    }

    // Otherwise, find the color that is not neighboring one of the others
    const [missingIndexA, missingIndexB] = [0, 1, 2, 3, 4].filter(colorIndex => !wubrgOrdered.includes(cardColors[colorIndex]));
    const enemyColorIndex = (missingIndexB - missingIndexA) === 2
      ? missingIndexA + 1
      : (missingIndexB + 1) % cardColors.length;

    // And return the enemy color in the middle of the other two colors
    return [
      cardColors[(enemyColorIndex + 3) % cardColors.length],
      cardColors[enemyColorIndex],
      cardColors[(enemyColorIndex + 2) % cardColors.length]
    ]
  }

  // If four colors are present, return them in WUBRG order starting the loop after the missing color
  if (wubrgOrdered.length === 4) {
    const missingColor = cardColors.find(color => !uniqueColors.has(color));
    if (!missingColor) throw new Error(`missing color not found in four-color set: [${_colors.join(', ')}]`);
    const startIndex = (cardColors.indexOf(missingColor) + 1) % cardColors.length;
    return [
      ...cardColors.slice(startIndex, startIndex + 4),
      ...cardColors.slice(0, Math.max(0, startIndex - 1))
    ];
  }

  // If all colors are present, return them in WUBRG order
  if (_colors.length === 5) {
    return wubrgOrdered;
  }

  // This should never happen
  throw new Error(`unhandled case in toOrderedColors for [${_colors.join(', ')}]`);
}
