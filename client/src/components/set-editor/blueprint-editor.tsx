"use client";

import { Fragment, ReactNode, useState } from 'react';
import {
  allCriteriaKeys,
  AnyCriteria, BlueprintCriteriaType,
  defaultCriteriaFor,
  getCriteriaTypesForSerializableBlueprintField,
  NumberCriteria,
  SerializableBlueprint,
} from 'kindred-paths';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

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
    if (key === 'number/must-be-one-of') {
      props.setValue({ key, value: [currentValue] });
    } else if (key === 'number/must-be-at-least') {
      props.setValue({ key, value: currentValue });
    } else if (key === 'number/must-be-at-most') {
      props.setValue({ key, value: currentValue });
    } else if (key === 'number/must-be-between') {
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
      <option value="number/must-be-one-of">exactly equal to</option>
      <option value="number/must-be-at-least">of at least</option>
      <option value="number/must-be-at-most">of at most</option>
      <option value="number/must-be-between">between (inclusive)</option>
    </select>
    {props.value.key === 'number/must-be-one-of' &&
      <NumberArrayValueEditor prefix="" separator="or" value={props.value.value} setValue={(value: number[]) => props.setValue({ key: 'number/must-be-one-of', value })} />
    }
    {(props.value.key === 'number/must-be-at-least' || props.value.key === 'number/must-be-at-most') &&
      <input
        type="number"
        className={criteriaInputStyle}
        value={props.value.value}
        onChange={(key => e => props.setValue({ key, value: e.target.valueAsNumber }))(props.value.key)}
      />
    }
    {props.value.key === 'number/must-be-between' &&
      <>
        <input
          type="number"
          className={criteriaInputStyle}
          value={props.value.value[0]}
          onChange={e => props.setValue({ key: 'number/must-be-between', value: [e.target.valueAsNumber, (props.value.value as [number, number])[1]] })}
        />
        and
        <input
          type="number"
          className={criteriaInputStyle}
          value={props.value.value[1]}
          onChange={e => props.setValue({ key: 'number/must-be-between', value: [(props.value.value as [number, number])[0], e.target.valueAsNumber] })}
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
        {props.field[0].toUpperCase() + props.field.slice(1)}
      </p>
    </div>
    {props.children}
  </div>;
}

type CriteriaEditorProps = {
  field: string,
  criteriaTypes: BlueprintCriteriaType[],
  criteria: AnyCriteria[],
  onAdd: (criteria: AnyCriteria) => void,
  onUpdate: (index: number, criteria: AnyCriteria) => void,
  onRemove: (index: number) => () => void,
};

function CriteriaEditor(props: CriteriaEditorProps) {
  return <CriteriaHeader field={props.field} criteriaTypes={props.criteriaTypes}>
     <ul className="w-full">
      {props.criteria.map((c, i) => <li
        key={i}
        className="flex justify-between items-center border-b last:border-0 border-gray-200"
      >
        <div className="px-3 py-2">
          {c.key === 'string/must-include-one-of' && <StringArrayValueEditor prefix="must include" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string/must-include-all-of' && <StringArrayValueEditor prefix="must include" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string/must-have-length' && <NumberCriteriaValueEditor prefix="must have length" value={c.value} setValue={(value: NumberCriteria) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'boolean/must-be-true' && <>must be <strong>true</strong></>}
          {c.key === 'boolean/must-be-false' && <>must be <strong>false</strong></>}
          {c.key === 'optional/is-present' && <>must be <strong>present</strong></>}
          {c.key === 'optional/is-absent' && <>must be <strong>absent</strong></>}
          {c.key === 'string-array/must-only-use-from' && <StringArrayValueEditor prefix="must only use from" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/must-include-one-of' && <StringArrayValueEditor prefix="must include" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/must-include-all-of' && <StringArrayValueEditor prefix="must include" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'string-array/must-have-length' && <NumberCriteriaValueEditor prefix="must have length" value={c.value} setValue={(value: NumberCriteria) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/must-be-one-of' && <NumberArrayValueEditor prefix="must equal" separator="or" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/must-be-at-least' && <NumberValueEditor prefix="must be at least" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/must-be-at-most' && <NumberValueEditor prefix="must be at most" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'number/must-be-between' && <NumberPairValueEditor prefix="must be between" separator="and" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })}  />}
          {c.key === 'object/must-have-key' && <StringValueEditor prefix="must have key" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })}  />}
          {c.key === 'object/must-not-have-key' && <StringValueEditor prefix="must not have key" value={c.value} setValue={(value) => props.onUpdate(i, { key: c.key, value })} />}
          {c.key === 'object/number' && <>Not yet implemented.</>}
          {c.key === 'object/string' && <>Not yet implemented.</>}
          {c.key === 'object/boolean' && <>Not yet implemented.</>}
        </div>
        <button
          onClick={props.onRemove(i)}
          className="cursor-pointer text-red-500 font-bold px-4 text-2xl leading-none hover:text-red-700"
          title="Remove Criteria"
        >
          &times;
        </button>
      </li>)}
     <div className="group flex text-sm bg-gray-100 text-left text-gray-500 w-full">
       {allCriteriaKeys.filter(k => props.criteriaTypes.some(ct => k.startsWith(ct + '/'))).map(criteriaKey => <button
         key={criteriaKey}
         onClick={() => props.onAdd(defaultCriteriaFor(criteriaKey))}
         className="cursor-pointer p-3 hover:bg-green-50 hover:text-green-700"
       >
         <FontAwesomeIcon icon={faPlus} className="mr-2 text-gray-300 group-hover:text-inherit" />
         <span className="opacity-0 group-hover:opacity-100 text-xs">{criteriaKey.split('/')[1].replaceAll('-', ' ')}</span>
       </button>)}
     </div>
    </ul>
  </CriteriaHeader>
}

type BlueprintEditorProps = {
  blueprint: SerializableBlueprint,
  onSave: (blueprint: SerializableBlueprint) => void,
  onCancel: () => void,
}

export function BlueprintEditor(props: BlueprintEditorProps) {
  const [blueprint, setBlueprint] = useState<SerializableBlueprint>(props.blueprint);
  const hasChanged = JSON.stringify(blueprint) !== JSON.stringify(props.blueprint);

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

  const editorPropsFor = (field: keyof SerializableBlueprint): CriteriaEditorProps => ({
    field,
    criteriaTypes: getCriteriaTypesForSerializableBlueprintField(field),
    criteria: blueprint[field] || [],
    onAdd: (c: AnyCriteria) => addCriteria(field, c),
    onUpdate: (i: number, c: AnyCriteria) => updateCriteria(field, i, c),
    onRemove: (i: number) => removeCriteria(field, i),
  });

  return <div className="p-3 border border-blue-200 rounded-lg space-y-3">
    <div>
      <h2 className="font-bold tracking-wide pb-1 text-xl text-blue-500 border-b border-blue-100">Blueprint Editor</h2>
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
