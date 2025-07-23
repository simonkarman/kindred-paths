export const CardTagsInput = (props: {
  tags: undefined | { [key: string]: string | number | boolean },
  setTags: (value: undefined | { [key: string]: string | number | boolean }) => void,
  getErrorMessage: () => string | undefined,
}) => {
  // Convert tags object to array for easier manipulation
  const tagsArray = props.tags !== undefined
    ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
    : [];

  const convertArrayToTags = (array: { key: string, value: string | number | boolean }[]) => {
    if (array.length === 0) return undefined;

    const result: { [key: string]: string | number | boolean } = {};
    array.forEach(({ key, value }) => {
      result[key] = value;
    });

    return Object.keys(result).length === 0 ? undefined : result;
  };

  const updateTag = (index: number, field: 'key' | 'value', newValue: string | number | boolean) => {
    const newArray = [...tagsArray];
    newArray[index] = { ...newArray[index], [field]: newValue };
    props.setTags(convertArrayToTags(newArray));
  };

  const updateValueType = (index: number, type: 'string' | 'number' | 'boolean') => {
    const currentValue = tagsArray[index].value;
    let newValue: string | number | boolean;

    switch (type) {
      case 'string':
        newValue = String(currentValue || '');
        break;
      case 'number':
        newValue = typeof currentValue === 'number' ? currentValue : 0;
        break;
      case 'boolean':
        newValue = typeof currentValue === 'boolean' ? currentValue : false;
        break;
    }

    updateTag(index, 'value', newValue);
  };

  const removeTag = (index: number) => {
    const newArray = tagsArray.filter((_, i) => i !== index);
    props.setTags(convertArrayToTags(newArray));
  };

  const moveTag = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === tagsArray.length - 1)
    ) {
      return;
    }

    const newArray = [...tagsArray];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newArray[index], newArray[targetIndex]] = [newArray[targetIndex], newArray[index]];
    props.setTags(convertArrayToTags(newArray));
  };

  const addTag = () => {
    const newTag = { key: 'key', value: '' as string };
    const newArray = [...tagsArray, newTag];
    props.setTags(convertArrayToTags(newArray));
  };

  const getValueType = (value: string | number | boolean | undefined): string => {
    if (value === undefined) return 'undefined';
    return typeof value;
  };

  const renderValueInput = (tag: { key: string, value: string | number | boolean | undefined }, index: number) => {
    const valueType = getValueType(tag.value);

    switch (valueType) {
      case 'boolean':
        return (
          <select
            value={tag.value ? 'true' : 'false'}
            onChange={(e) => updateTag(index, 'value', e.target.value === 'true')}
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={tag.value as number}
            onChange={(e) => updateTag(index, 'value', parseFloat(e.target.value) || 0)}
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      default: // string
        return (
          <input
            type="text"
            value={tag.value as string}
            onChange={(e) => updateTag(index, 'value', e.target.value)}
            placeholder="Enter value..."
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-800">
        Card Tags
      </label>

      <div className="space-y-2">
        {tagsArray.map((tag, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-gray-50">
            {/* Key Input */}
            <input
              type="text"
              value={tag.key}
              onChange={(e) => updateTag(index, 'key', e.target.value)}
              placeholder="Key..."
              className="w-32 px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Type Selector */}
            <select
              value={getValueType(tag.value)}
              onChange={(e) => updateValueType(index, e.target.value as 'string' | 'number' | 'boolean')}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>

            {/* Value Input */}
            <div className="flex-1">
              {renderValueInput(tag, index)}
            </div>

            {/* Move Up Button */}
            <button
              onClick={() => moveTag(index, 'up')}
              disabled={index === 0}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move up"
            >
              ↑
            </button>

            {/* Move Down Button */}
            <button
              onClick={() => moveTag(index, 'down')}
              disabled={index === tagsArray.length - 1}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move down"
            >
              ↓
            </button>

            {/* Remove Button */}
            <button
              onClick={() => removeTag(index)}
              className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Remove tag"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add Tag Button */}
        <button
          onClick={addTag}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Tag
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
