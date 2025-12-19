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
  regex: RegExp;

  constructor(data: SerializableKeyword) {
    this.name = data.name;
    this.reminder = data.reminder;
    this.variables = (this.name.match(/\[([a-z-]+)]/g) || []).map(v => v.slice(1, -1));
    this.regex = new RegExp(
      '^' + this.name
        .replace(/\[n]/, '([1-9][0-9]*)')
        .replace(/\[color]/, '(white|blue|black|red|green|colorless)')
        .replace(/\[mana-cost]/, '((?:\\{[wubrgx0-9]+\\})+)')
      + '$',
      'i',
    );

    // TODO:
    //   - Validate that there are no duplicate variables
    //   - Validate that all variables in reminder are defined in name
  }

  apply(input: string): string | undefined {
    const result = this.regex[Symbol.match](input);
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
}

export class AutoReminderText {
  private keywords: Keyword[];

  constructor(keywords: SerializableKeyword[]) {
    this.keywords = keywords.map(k => new Keyword(k));
  }

  /*
   * Given keyword string as input, return the reminder text, if it is available for that keyword.
   */
  for(input: string): string | undefined {
    return this.keywords
      .map(keyword => keyword.apply(input))
      .filter(r => r !== undefined)
      .pop();
  }
}
