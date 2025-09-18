export class TokenExtractor {
  readonly regex: RegExp;

  constructor() {
    const keywordOrAbility = '(?:(?:\\w+(?: strike)?)|(?:".+?"))';
    this.regex = new RegExp([
      '[cC]reates?',
      '( [A-Z]\\w*,)?',
      ' (?:a(?: number of)?|that many|X|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)',
      '(?: tapped and attacking)?',
      '(?: tapped)?',
      '((?: [a-zA-Z0-9/ ]+)? token)',
      '(?:s)?',
      '( with ' + keywordOrAbility + '?(?: and ' + keywordOrAbility + '?)*)?',
      "( that[']s a copy)?",
    ].join(''), 'g');
  }

  extractTokensFromAbility(ability: string, depth = 0): string[] {
    // eslint-disable-next-line max-len
    const match = ability.matchAll(this.regex);
    return Array.from(match).map(m => {
      // return concat of all matches that are not undefined or empty
      const result = m.slice(1).filter(s => s !== undefined && s !== '').join('').trim();
      if (result === 'token that\'s a copy' || result === 'token that’s a copy') {
        return 'Copy token';
      }
      return result;
    }).flatMap(r => depth < 2 ? [r, ...this.extractTokensFromAbility(r, depth + 1)] : [r]);
  }
}
