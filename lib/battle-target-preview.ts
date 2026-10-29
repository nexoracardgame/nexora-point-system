// A preview may be an unfinished prefix of an ordered, legal target sequence.
export function legalTargetPreview(options: string[], value: string) {
  if (!value) return true;
  const parts = value.split('>');
  return new Set(parts).size === parts.length && options.some(option => {
    const sequence = option.split('>');
    return parts.length <= sequence.length && parts.every((part, index) => part === sequence[index]);
  });
}
