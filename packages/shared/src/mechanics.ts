import { z } from 'zod';

export const SerializedKeywordSchema = z.object({
  name: z.string(),
  reminder: z.string(),
});
export type SerializableKeyword = z.infer<typeof SerializedKeywordSchema>;

export const SerializableMechanicsSchema = z.object({
  keywords: z.array(SerializedKeywordSchema),
});
export type SerializableMechanics = z.infer<typeof SerializableMechanicsSchema>;

class Keyword {
  name: string;
  reminder: string;
  variables: string[];
  standaloneRegex: RegExp;
  inlineRegex: RegExp;

  constructor(data: SerializableKeyword) {
    this.name = data.name;
    this.reminder = data.reminder;
    this.variables = (this.name.match(/\[([a-z-]+)]/g) || []).map(v => v.slice(1, -1));
    const regex = this.name
      .replace(/\[n]/, '([1-9][0-9]*)')
      .replace(/\[color]/, '(white|blue|black|red|green|colorless)')
      .replace(/\[mana-cost]/, '((?:\\{[wubrgx0-9]+\\})+)');
    this.standaloneRegex = new RegExp('^' + regex + '$', 'i');
    this.inlineRegex = new RegExp(regex, 'i');

    // TODO:
    //   - Validate that there are no duplicate variables
    //   - Validate that all variables in reminder are defined in name
  }

  private extractReminder = (result: RegExpMatchArray | null) => {
    if (!result || result.length !== this.variables.length + 1) {
      return undefined;
    }
    const args: Record<string, string> = {};
    this.variables.forEach((variable, index) => {
      args[variable] = result[index + 1];
    });
    let reminder: string = this.reminder;
    if (args.n) {
      const numberAsWord = [
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
        'nineteen', 'twenty',
      ][parseInt(args.n, 10)] ?? args.n;
      reminder = reminder
        .replace(/\[n]/g, args.n)
        .replace(/\[[nN]\/(.*?)]/g, (_, subject) => {
          if (args.n === '1') return `a ${subject}`;
          return `${numberAsWord} ${subject}s`;
        });
    }
    if (args['mana-cost']) {
      reminder = reminder.replace(/\[mana-cost]/g, args['mana-cost']);
    }
    if (args.color) {
      reminder = reminder.replace(/\[color]/g, args.color);
    }
    return reminder;
  }

  applyStandalone(input: string): string | undefined {
    const result = this.standaloneRegex[Symbol.match](input);
    return this.extractReminder(result);
  }

  applyInline(rulesText: string): { reminder: string; index: number } | undefined {
    const result = this.inlineRegex.exec(rulesText);
    const reminder = this.extractReminder(result);
    if (reminder) {
      return { reminder, index: result?.index ?? -1 };
    }
    return undefined;
  }
}

export class AutoReminderText {
  private keywords: Keyword[];

  private standaloneCache: Map<string, string | undefined> = new Map();
  private inlineCache: Map<string, string> = new Map();

  constructor(keywords: SerializableKeyword[]) {
    this.keywords = keywords.map(k => new Keyword(k));
  }

  /*
   * Given keyword string as input, return the reminder text, if it is available for that keyword.
   */
  standaloneFor(input: string): string | undefined {
    if (this.standaloneCache.has(input)) {
      return this.standaloneCache.get(input);
    }
    const result = this.keywords
      .map(keyword => keyword.applyStandalone(input))
      .filter(r => r !== undefined)
      .pop();
    this.standaloneCache.set(input, result);
    return result;
  }

  /*
   * Given a rules text, returns the reminder text of each keyword match found in the text.
   */
  inlineFor(rulesText: string): string {
    if (this.inlineCache.has(rulesText)) {
      return this.inlineCache.get(rulesText) ?? '';
    }
    const result = this.keywords
      .filter(keyword => keyword.reminder.startsWith('To '))
      .map(keyword => keyword.applyInline(rulesText))
      .filter(r => r !== undefined)
      .toSorted((a, b) => a.index - b.index)
      .map(r => r.reminder)
      .join(' ');
    this.inlineCache.set(rulesText, result);
    return result;
  }
}
