import { RuleVariant, ruleVariants, capitalize, SerializableMechanics, AutoReminderText } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

export const CardRulesInput = (props: {
  rules?: { variant: RuleVariant, content: string }[],
  setRules: (value: { variant: RuleVariant, content: string }[] | undefined) => void,
  mechanics: SerializableMechanics,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const rules = props.rules || [];

  const updateRule = (index: number, field: 'variant' | 'content', value: string | RuleVariant) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    if (newRules[index].variant === 'keyword') {
      newRules[index].content = newRules[index].content.toLowerCase();
    }
    props.setRules(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    props.setRules(newRules.length === 0 ? undefined : newRules);
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === rules.length - 1)
    ) {
      return;
    }

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];
    props.setRules(newRules);
  };

  const addRuleTop = () => {
    const newRule = { variant: 'ability' as RuleVariant, content: '' };
    props.setRules([newRule, ...rules]);
  };

  const addRuleBottom = () => {
    const newRule = { variant: 'ability' as RuleVariant, content: '' };
    props.setRules([...rules, newRule]);
  };

  return (
    <div className="space-y-1">
      <InputHeader propertyName="rules" isChanged={props.isChanged} revert={props.revert} />

      <div className="space-y-5">
        {rules.length > 0 && <button
          onClick={addRuleTop}
          className="w-full px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add rule at the top
        </button>}

        {rules.map((rule, index) => {
          let auto: string | undefined = undefined;
          const previousRule = index === 0 ? undefined : rules[index - 1];
          if (rule.variant === 'inline-reminder' && previousRule?.variant === 'keyword') {
            auto = new AutoReminderText(props.mechanics.keywords).for(previousRule.content);
          }
          return <div key={index} className="flex flex-col gap-1 border-zinc-200 rounded hover:bg-zinc-50">
            <div key={index} className="flex items-center gap-2">
              {/* Variant Selector */}
              <select
                value={rule.variant}
                onChange={(e) => updateRule(index, 'variant', e.target.value as RuleVariant)}
                className="flex-1 px-1 py-1 border border-zinc-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ruleVariants.map(variant => (
                  <option key={variant} value={variant}>
                    {variant.split('-').map(capitalize).join(' ')}
                  </option>
                ))}
              </select>

              {/* Autofill Button */}
              {auto && (
                <button
                  onClick={() => updateRule(index, 'content', auto)}
                  disabled={auto === rule.content}
                  className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 border border-green-300 disabled:border-gray-300 rounded not-disabled:hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
                  title="Autofill reminder text"
                >
                  {auto === rule.content ? 'Autofilled' : 'Autofill'}
                </button>
              )}

              {/* Move Up Button */}
              <button
                onClick={() => moveRule(index, 'up')}
                disabled={index === 0}
                className="px-2 py-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Move up"
              >
                ↑
              </button>

              {/* Move Down Button */}
              <button
                onClick={() => moveRule(index, 'down')}
                disabled={index === rules.length - 1}
                className="px-2 py-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Move down"
              >
                ↓
              </button>

              {/* Remove Button */}
              <button
                onClick={() => removeRule(index)}
                className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Remove rule"
              >
                ×
              </button>
            </div>

            {/* Rule Content Input */}
            {rule.variant === 'keyword' ? (
              <input
                type="text"
                value={capitalize(rule.content)}
                onChange={(e) => updateRule(index, 'content', e.target.value)}
                placeholder="Enter keyword..."
                className="text-sm px-2 py-1 border border-zinc-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <textarea
                rows={Math.max(2, Math.ceil(rule.content.length / 65))}
                value={rule.content}
                onChange={(e) => updateRule(index, 'content', e.target.value.replace(/\n/g, ''))}
                placeholder={`Enter ${rule.variant} content...`}
                className="text-sm px-2 py-1 border border-zinc-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>;
        })}

        {/* Add Rule Button */}
        <button
          onClick={addRuleBottom}
          className="w-full px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add rule{rules.length > 0 ? ' at the bottom' : ''}
        </button>
      </div>

      {/* Error Message */}
      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
