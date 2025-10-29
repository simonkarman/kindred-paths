export const capitalize = (str: string) => !str || str.length === 0 ? '' : str.charAt(0).toUpperCase() + str.slice(1);

export const enumerate = (values: string[], options?: { separator?: string, lastSeparator?: string }): string => {
  const separator = options?.separator ?? ',';
  const lastSeparator = options?.lastSeparator ?? 'and';
  if (!values || values.length === 0) {
    return '';
  } else if (values.length === 1) {
    return values[0];
  } else if (values.length === 2) {
    return `${values[0]} ${lastSeparator} ${values[1]}`;
  } else {
    return `${values.slice(0, -1).join(separator + ' ')}${separator} ${lastSeparator} ${values[values.length - 1]}`;
  }
};
