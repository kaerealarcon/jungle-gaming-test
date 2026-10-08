export const maxNameLength = 10;
export const defaultCaptainName = 'CAPTAIN JACK';
export const captainDisplayName = defaultCaptainName;
const blocked = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'nigger', 'nigga', 'faggot', 'nazista', 'hitler', 'caralho', 'porra', 'merda', 'puta', 'puto', 'buceta', 'piranha', 'viado', 'veado', 'racista'];
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[013457]/g, digit => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' })[digit]!);

export function validateCaptainName(raw: string): string | null {
  const name = raw.trim();
  if (name === defaultCaptainName) return null;
  if (!name) return 'Enter your captain name.';
  if ([...name].length > maxNameLength) return 'Use no more than 10 characters.';
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return 'Use letters, numbers, spaces, hyphens or underscores.';
  const normalized = normalize(name);
  const words = normalized.split(/[ _-]+/);
  const compact = normalized.replace(/[ _-]/g, '');
  if (blocked.some(term => words.includes(term) || compact === term || (term.length >= 5 && compact.includes(term)))) return 'Choose an appropriate captain name.';
  return null;
}

export function loadCaptainName(): string {
  return defaultCaptainName;
}
