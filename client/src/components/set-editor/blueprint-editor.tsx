"use client";

import { Fragment, ReactNode, useState } from 'react';
import {
  allCriteriaKeys,
  AnyCriteria,
  BlueprintCriteriaType,
  blueprintFields,
  defaultCriteriaFor,
  getCriteriaTypesForSerializableBlueprintField,
  NumberCriteria,
  SerializableBlueprint,
} from 'kindred-paths';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faPlus } from '@fortawesome/free-solid-svg-icons';

const criteriaInputStyle = 'font-mono font-bold tracking-wide text-center field-sizing-content text-sm border rounded px-2 py-0.5 bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200';

function StringArrayValueEditor(props: {
  prefix: string,
  separator: string,
  value: string[],
  setValue: (value: string[]) => void,
}){
  return <div className="flex flex-wrap items-baseline gap-2">
    {props.prefix}
    {props.value.map((value, valueIndex) => <Fragment
      key={valueIndex}
    >
      <input
        type="text"
        className={criteriaInputStyle}
        value={value}
        onChange={e => props.setValue(props.value.map((v, vi) => vi === valueIndex ? e.target.value : v).filter(v => v.trim() !== ''))}
      />
      <span
        className={props.value.length - 1 === valueIndex ? 'text-gray-300' : ''}
      >{props.separator}</span>
    </Fragment>)}
    <button
      onClick={() => props.setValue([...props.value, ''])}
      className="text-xs border font-bold bg-gray-50 hover:bg-green-50 text-gray-600 border-gray-300 hover:text-green-600 hover:border-green-600 rounded px-2 py-0.5 cursor-pointer"
    >
      add option
    </button>
  </div>;
}

function NumberArrayValueEditor(props: {
  prefix: string,
  separator: string,
  value: number[],
  setValue: (value: number[]) => void,
}) {
  return <div className="flex flex-wrap items-baseline gap-2">
    {props.prefix}
    {props.value.map((value, valueIndex) => <Fragment
      key={valueIndex}
    >
      <input
        type="number"
        className={criteriaInputStyle}
        value={value}
        onChange={e => props.setValue(props.value.map((v, vi) => vi === valueIndex ? e.target.valueAsNumber : v).filter(v => !isNaN(v)))}
      />
      <span
        className={props.value.length - 1 === valueIndex ? 'text-gray-300' : ''}
      >{props.separator}</span>
    </Fragment>)}
    <button
      onClick={() => props.setValue([...props.value, 0])}
      className="text-xs border font-bold bg-gray-50 hover:bg-green-50 text-gray-600 border-gray-300 hover:text-green-600 hover:border-green-600 rounded px-2 py-0.5 cursor-pointer"
    >
      add option
    </button>
  </div>;
}

function NumberCriteriaValueEditor(props: {
  prefix: string,
  value: NumberCriteria,
  setValue: (value: NumberCriteria) => void,
}) {

  const onChangeKey = (key: NumberCriteria['key']) => {
    if (props.value.key === key) {
      return;
    }
    const currentValue = typeof props.value.value === 'number' ? props.value.value : props.value.value[0];
    if (key === 'number/one-of') {
      props.setValue({ key, value: [currentValue] });
    } else if (key === 'number/at-least') {
      props.setValue({ key, value: currentValue });
    } else if (key === 'number/at-most') {
      props.setValue({ key, value: currentValue });
    } else if (key === 'number/between') {
      props.setValue({ key, value: [currentValue, currentValue + 2] });
    }
  };

  return <div className="flex items-baseline gap-2">
    {props.prefix}
    <select
      className={criteriaInputStyle}
      value={props.value.key}
      onChange={e => onChangeKey(e.target.value as NumberCriteria['key'])}
    >
      <option value="number/one-of">exactly equal to</option>
      <option value="number/at-least">of at least</option>
      <option value="number/at-most">of at most</option>
      <option value="number/between">between (inclusive)</option>
    </select>
    {props.value.key === 'number/one-of' &&
      <NumberArrayValueEditor prefix="" separator="or" value={props.value.value} setValue={(value: number[]) => props.setValue({ key: 'number/one-of', value })} />
    }
    {(props.value.key === 'number/at-least' || props.value.key === 'number/at-most') &&
      <input
        type="number"
        className={criteriaInputStyle}
        value={props.value.value}
        onChange={(key => e => props.setValue({ key, value: e.target.valueAsNumber }))(props.value.key)}
      />
    }
    {props.value.key === 'number/between' &&
      <>
        <input
          type="number"
          className={criteriaInputStyle}
          value={props.value.value[0]}
          onChange={e => props.setValue({ key: 'number/between', value: [e.target.valueAsNumber, (props.value.value as [number, number])[1]] })}
        />
        and
        <input
          type="number"
          className={criteriaInputStyle}
          value={props.value.value[1]}
          onChange={e => props.setValue({ key: 'number/between', value: [(props.value.value as [number, number])[0], e.target.valueAsNumber] })}
        />
      </>
    }
  </div>;
}

function NumberValueEditor(props: {
  prefix: string,
  value: number,
  setValue: (value: number) => void,
}) {
  return <div className="flex items-baseline gap-2">
    {props.prefix}
    <input
      type="number"
      className={criteriaInputStyle}
      value={props.value}
      onChange={e => props.setValue(e.target.valueAsNumber)}
    />
  </div>;
}

function NumberPairValueEditor(props: {
  prefix: string,
  separator: string,
  value: [number, number],
  setValue: (value: [number, number]) => void,
}) {
  return <div className="flex items-baseline gap-2">
    {props.prefix}
    <input
      type="number"
      className={criteriaInputStyle}
      value={props.value[0]}
      onChange={e => props.setValue([e.target.valueAsNumber, props.value[1]])}
    />
    {props.separator}
    <input
      type="number"
      className={criteriaInputStyle}
      value={props.value[1]}
      onChange={e => props.setValue([props.value[0], e.target.valueAsNumber])}
    />
  </div>;
}

function StringValueEditor(props: {
  prefix: string,
  value: string,
  setValue: (value: string) => void,
}) {
  return <div className="flex items-baseline gap-2">
    {props.prefix}
    <input
      type="text"
      className={criteriaInputStyle}
      value={props.value}
      onChange={e => props.setValue(e.target.value)}
    />
  </div>;
}

function CriteriaHeader(props: {
  field: string,
  criteriaTypes: BlueprintCriteriaType[],
  children: ReactNode
}) {
  return <div className="flex border border-gray-200 rounded-md items-stretch">
    <div className="flex items-center grow-0 w-54 py-2 px-4 border-r border-gray-200">
      <p className="text-right w-full">
        {props.field[0].toUpperCase() + props.field.slice(1)}<br />
        <span className="text-xs text-gray-400 italic">
          ({props.criteriaTypes.join(', ')})
        </span>
      </p>
    </div>
    {props.children}
  </div>;
}

type CriteriaEditorProps = {
  field: keyof SerializableBlueprint,
  criteriaTypes: BlueprintCriteriaType[],
  criteria: AnyCriteria[],
  onAdd: (criteria: AnyCriteria) => void,
  onUpdate: (index: number, criteria: AnyCriteria) => void,
  onRemove: (index: number) => () => void,
  shouldShow: boolean,
};

function defaultStringValueForField(field: keyof SerializableBlueprint): string | undefined {
  switch (field) {
    case 'rarity':
      return 'common';
    case 'supertype':
      return 'legendary';
    case 'types':
      return 'creature';
    case 'subtypes':
      return 'human';
    case 'color':
      return 'white';
    case 'colorIdentity':
      return 'white';
    default:
      return undefined;
  }
}

function CriteriaEditor(props: CriteriaEditorProps) {
  if (!props.shouldShow) {
    return null;
  }

  return <CriteriaHeader field={props.field} criteriaTypes={props.criteriaTypes}>
    <ul className="flex flex-col w-full">
      {props?.criteria.map((c, i) => <li
        key={i}
        className="flex justify-between items-center border-b last:border-0 border-gray-200"
      >
        <div className="px-3 py-2">
          {c.key === 'string/equal' && <StringValueEditor prefix="must be" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string/contain-one-of' && <StringArrayValueEditor prefix="must contain" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string/contain-all-of' && <StringArrayValueEditor prefix="must contain" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string/length' && <NumberCriteriaValueEditor prefix="must have length" value={c.value} setValue={(value: NumberCriteria) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'boolean/true' && <>must be <strong>true</strong></>}
          {c.key === 'boolean/false' && <>must be <strong>false</strong></>}
          {c.key === 'optional/present' && <>must be <strong>present</strong></>}
          {c.key === 'optional/absent' && <>must be <strong>absent</strong></>}
          {c.key === 'string-array/allow' && <StringArrayValueEditor prefix="must only use from" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/deny' && <StringArrayValueEditor prefix="must never use from" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/includes-one-of' && <StringArrayValueEditor prefix="must include" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/includes-all-of' && <StringArrayValueEditor prefix="must include" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/length' && <NumberCriteriaValueEditor prefix="must have length" value={c.value} setValue={(value: NumberCriteria) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/one-of' && <NumberArrayValueEditor prefix="must equal" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/at-least' && <NumberValueEditor prefix="must be at least" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/at-most' && <NumberValueEditor prefix="must be at most" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/between' && <NumberPairValueEditor prefix="must be between" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })}  />}
          {c.key === 'object/field-present' && <StringValueEditor prefix="must have key" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })}  />}
          {c.key === 'object/field-absent' && <StringValueEditor prefix="must not have key" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'object/number-field' && <>Not yet implemented.</>}
          {c.key === 'object/string-field' && <>Not yet implemented.</>}
          {c.key === 'object/boolean-field' && <>Not yet implemented.</>}
        </div>
        <button
         onClick={props.onRemove(i)}
         className="cursor-pointer text-red-500 font-bold px-4 text-2xl leading-none hover:text-red-700"
         title="Remove Criteria"
        >
          &times;
        </button>
      </li>)}
      <li className="grow group flex items-stretch text-sm text-left text-gray-500 w-full">
        <div className="flex items-center">
          <FontAwesomeIcon icon={faPlus} className="p-4 opacity-100 group-hover:opacity-30" />
        </div>
        {allCriteriaKeys.filter(k => props.criteriaTypes.some(ct => k.startsWith(ct + '/'))).map(criteriaKey => <button
          key={criteriaKey}
          onClick={() => props.onAdd(defaultCriteriaFor(criteriaKey, defaultStringValueForField(props.field)))}
          className="cursor-pointer p-3 hover:bg-green-50 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2 text-gray-300 group-hover:text-inherit" />
          <span className="text-xs">{criteriaKey.split('/')[1].replaceAll('-', ' ')}</span>
        </button>)}
      </li>
    </ul>
  </CriteriaHeader>
}

const CopyableMetadataKeys = ({ metadataKeys }: { metadataKeys: string[] }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (key: string) => {
    const textToCopy = `$[${key}]`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKey(key);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const buttonClasses = `
    inline-flex items-center gap-1 px-2 py-1 text-xs font-mono
    border border-gray-300 rounded
    bg-gray-50 hover:bg-blue-50
    text-gray-700 hover:text-blue-700
    hover:border-blue-300
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
    cursor-pointer select-none
  `;

  const copiedButtonClasses = `
    inline-flex items-center gap-1 px-2 py-1 text-xs font-mono
    border border-green-300 rounded
    bg-green-50 text-green-700
    transition-all duration-200
    cursor-pointer select-none
  `;

  if (metadataKeys.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        No metadata keys available
      </p>
    );
  }

  return (
    <div className="py-2 space-y-2">
      <p className="text-sm font-medium text-gray-600">
        Available metadata keys:
      </p>

      <div className="flex flex-wrap gap-1.5">
        {metadataKeys.map(key => {
          const isCopied = copiedKey === key;

          return (
            <button
              key={key}
              onClick={() => copyToClipboard(key)}
              className={isCopied ? copiedButtonClasses : buttonClasses}
              type="button"
              title={`Click to copy $[${key}]`}
              aria-label={`Copy metadata key ${key} to clipboard`}
            >
              <span className="text-gray-400 mr-1">
                {isCopied ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faCopy} />}
              </span>
              <span>{key}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-1">
        💡 Click any button to copy the metadata key to your clipboard
      </p>
    </div>
  );
};

type BlueprintEditorProps = {
  title: string,
  metadataKeys: string[],
  blueprint: SerializableBlueprint,
  onSave: (blueprint: SerializableBlueprint) => void,
  onCancel: () => void,
};

export function BlueprintEditor(props: BlueprintEditorProps) {
  const [blueprint, setBlueprint] = useState<SerializableBlueprint>(props.blueprint);
  const hasChanged = JSON.stringify(blueprint) !== JSON.stringify(props.blueprint);
  const [forceShow, setForceShow] = useState<Partial<Record<keyof SerializableBlueprint, boolean>>>({});

  const removeCriteria = (field: keyof SerializableBlueprint, index: number) => {
    return () => {
      const newCriteria = [...blueprint[field] || []];
      newCriteria.splice(index, 1);
      setBlueprint({
        ...blueprint,
        [field]: newCriteria.length === 0 ? undefined : newCriteria,
      });
    };
  }

  const addCriteria = (field: keyof SerializableBlueprint, criteria: AnyCriteria) => {
    const newCriteria = [...blueprint[field] || [], criteria];
    setBlueprint({
      ...blueprint,
      [field]: newCriteria,
    });
  };

  const updateCriteria = (field: keyof SerializableBlueprint, index: number, criteria: AnyCriteria) => {
    const newCriteria = [...blueprint[field] || []];
    newCriteria[index] = criteria;
    setBlueprint({
      ...blueprint,
      [field]: newCriteria,
    });
  };

  const shouldShowField = (field: keyof SerializableBlueprint) => {
    return forceShow[field] || ((blueprint[field]?.length ?? 0) > 0);
  };

  const editorPropsFor = (field: keyof SerializableBlueprint): CriteriaEditorProps => ({
    field,
    criteriaTypes: getCriteriaTypesForSerializableBlueprintField(field),
    criteria: blueprint[field] || [],
    onAdd: (c: AnyCriteria) => addCriteria(field, c),
    onUpdate: (i: number, c: AnyCriteria) => updateCriteria(field, i, c),
    onRemove: (i: number) => removeCriteria(field, i),
    shouldShow: shouldShowField(field),
  });

  return <div className="p-3 border border-blue-200 bg-white rounded-lg space-y-3">
    <div>
      <h2 className="font-bold tracking-wide pb-1 text-lg border-b border-blue-100">{props.title}</h2>
      <CopyableMetadataKeys metadataKeys={props.metadataKeys} />
    </div>
    <ul className="space-y-2">
      <CriteriaEditor {...editorPropsFor('name')} />
      <CriteriaEditor {...editorPropsFor('rarity')} />
      <CriteriaEditor {...editorPropsFor('isToken')} />
      <CriteriaEditor {...editorPropsFor('supertype')} />
      <CriteriaEditor {...editorPropsFor('tokenColors')} />
      <CriteriaEditor {...editorPropsFor('types')} />
      <CriteriaEditor {...editorPropsFor('subtypes')} />
      <CriteriaEditor {...editorPropsFor('manaValue')} />
      <CriteriaEditor {...editorPropsFor('color')} />
      <CriteriaEditor {...editorPropsFor('colorIdentity')} />
      <CriteriaEditor {...editorPropsFor('rules')} />
      <CriteriaEditor {...editorPropsFor('pt')} />
      <CriteriaEditor {...editorPropsFor('power')} />
      <CriteriaEditor {...editorPropsFor('toughness')} />
      <CriteriaEditor {...editorPropsFor('powerToughnessDiff')} />
      <CriteriaEditor {...editorPropsFor('loyalty')} />
      <CriteriaEditor {...editorPropsFor('tags')} />
      <CriteriaEditor {...editorPropsFor('creatableTokens')} />
    </ul>

    <p className="text-sm font-medium text-gray-900">
      Add criteria on field:
    </p>
    <div className="flex flex-wrap gap-2">
      {blueprintFields
        .filter(field => !shouldShowField(field))
        .map(field => (
          <button
            key={field}
            onClick={() => setForceShow({
              ...forceShow,
              [field]: true,
            })}
            className={`
              inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
              border border-gray-300 rounded-md
              bg-white hover:bg-blue-50
              text-gray-700 hover:text-blue-700
              hover:border-blue-300
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            `}
            type="button"
            aria-label={`Add ${field} criteria`}
          >
            <span>+</span>
            {field}
          </button>
        ))
      }
    </div>

    {/* Show reset button only if there are forced fields */}
    {Object.keys(forceShow).length > 0 && (
      <div className="pt-2 border-t border-gray-200">
        <button
          onClick={() => setForceShow({})}
          className={`
            inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
            border border-gray-300 rounded-md
            bg-gray-50 hover:bg-yellow-100
            text-gray-600 hover:text-yellow-800
            hover:border-yellow-400
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1
          `}
          type="button"
          aria-label="Hide all unused criteria"
        >
          <span>×</span>
          Hide unused criteria
        </button>
      </div>
    )}
    <div className="flex justify-end w-full gap-2">
      <button
        className="cursor-pointer py-1 font-bold border bg-gray-500 text-white rounded-lg px-4 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => props.onCancel()}
      >
        Cancel
      </button>
      <button
        disabled={!hasChanged}
        className="cursor-pointer py-1 font-bold border bg-blue-500 text-white rounded-lg px-4 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => props.onSave(blueprint)}
      >
        Save changes
      </button>
    </div>
  </div>;
}
