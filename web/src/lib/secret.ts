export const SECRET_QUERY = 'sahra=addiction';

export function hasSecret(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sahra') === 'addiction';
}

export function withSecret(href: string): string {
  if (!hasSecret() || href.startsWith('#') || href.startsWith('http')) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${SECRET_QUERY}`;
}
