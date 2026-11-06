/** Building and clothing style for each age (index into EPOCHS + 1): mud, stone, timber, brick, towers (and the future). */
export function styleFor(age: number): 0 | 1 | 2 | 3 | 4 {
  return age >= 8 ? 4 : age >= 7 ? 3 : age >= 5 ? 2 : age >= 3 ? 1 : 0;
}
