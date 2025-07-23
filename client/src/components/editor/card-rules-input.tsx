import { RuleVariant, ruleVariants } from 'kindred-paths';
import { capitalize } from '@/utils/typography';

export const CardRulesInput = (props: {
  rules?: { variant: RuleVariant, content: string }[],
  setRules: (value: { variant: RuleVariant, content: string }[] | undefined) => void,
  getErrorMessage: () => string | undefined,
}) => {
  const rules = props.rules || [];

  const updateRule = (index: number, field: 'variant' | 'content', value: string | RuleVariant) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
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

  const addRule = () => {
    const newRule = { variant: 'ability' as RuleVariant, content: '' };
    props.setRules([...rules, newRule]);
  };

  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-800">
        Card Rules
      </label>

      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-gray-50">
            {/* Variant Selector */}
            <select
              value={rule.variant}
              onChange={(e) => updateRule(index, 'variant', e.target.value as RuleVariant)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ruleVariants.map(variant => (
                <option key={variant} value={variant}>
                  {variant.split('-').map(capitalize).join(' ')}
                </option>
              ))}
            </select>

            {/* Rule Content Input */}
            <input
              type="text"
              value={rule.content}
              onChange={(e) => updateRule(index, 'content', e.target.value)}
              placeholder="Enter rule content..."
              className="flex-1 px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Move Up Button */}
            <button
              onClick={() => moveRule(index, 'up')}
              disabled={index === 0}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move up"
            >
              ↑
            </button>

            {/* Move Down Button */}
            <button
              onClick={() => moveRule(index, 'down')}
              disabled={index === rules.length - 1}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        ))}

        {/* Add Rule Button */}
        <button
          onClick={addRule}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Rule
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
