'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCancel,
  faCheck,
  faCircle,
  faExclamationTriangle,
  faPenToSquare,
  faPlus,
  faTimes,
  faTrashCan, faWarning,
} from '@fortawesome/free-solid-svg-icons';
import {
  getCycleSlotStatus,
  SerializableArchetype,
  SerializableSet,
} from '@/app/set/types';
import { StatusTableCell } from '@/app/set/status-table-cell';
import { IconButton } from '@/app/set/icon-button';
import { DragHandle } from '@/app/set/drag-handle';
import { Card, SerializedCard } from 'kindred-paths';
import { SerializableBlueprint } from '@/app/set/blueprint-validator';
import { serverUrl } from '@/utils/server';

export interface SetTableProps {
  cards: SerializedCard[],
  set: SerializableSet;
}

export function SetTable(props: SetTableProps) {
  const cards = props.cards.map(c => new Card(c));
  const [set, onSave] = useState(props.set);

  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  // Calculate status counts for legend
  const statusCounts = { missing: 0, skip: 0, invalid: 0, valid: 0 };
  set.cycles.forEach(({ key: cycleKey }) => {
    set.archetypes.forEach((_, archetypeIndex) => {
      const { status } = getCycleSlotStatus(cards, set, archetypeIndex, cycleKey);
      statusCounts[status]++;
    });
  });

  const updateSet = (updates: Partial<SerializableSet>) => {
    onSave({ ...set, ...updates });
  };

  const updateSetName = (newName: string) => {
    updateSet({ name: newName });
  };

  const updateArchetypeName = (archetypeIndex: number, newName: string) => {
    const newArchetypes = [...set.archetypes];
    newArchetypes[archetypeIndex] = {
      ...newArchetypes[archetypeIndex],
      name: newName
    };
    updateSet({ archetypes: newArchetypes });
  };

  const addArchetype = () => {
    const newName = prompt('Enter new archetype name:');
    if (newName) {
      const newArchetype: SerializableArchetype = {
        name: newName,
        metadata: {},
        cycles: {}
      };
      updateSet({ archetypes: [...set.archetypes, newArchetype] });
    }
  };

  const deleteArchetype = (archetypeIndex: number) => {
    if (confirm(`Are you sure you want to delete archetype "${set.archetypes[archetypeIndex].name}"? This action cannot be undone.`)) {
      const newArchetypes = [...set.archetypes];
      newArchetypes.splice(archetypeIndex, 1);
      updateSet({ archetypes: newArchetypes });
    }
  };

  const updateMetadata = (archetypeIndex: number, metadataKey: string, _value: string) => {;
    const value = _value.trim() === '' ? undefined : _value;
    const newArchetypes = [...set.archetypes];
    newArchetypes[archetypeIndex] = {
      ...newArchetypes[archetypeIndex],
      metadata: { ...newArchetypes[archetypeIndex].metadata, [metadataKey]: value }
    };
    updateSet({ archetypes: newArchetypes });
  };

  const reorderMetadataKeys = (fromIndex: number, toIndex: number) => {
    const newKeys = [...set.metadataKeys];
    const [removed] = newKeys.splice(fromIndex, 1);
    newKeys.splice(toIndex, 0, removed);
    updateSet({ metadataKeys: newKeys });
  };

  const reorderCycleKeys = (fromIndex: number, toIndex: number) => {
    const newCycles = [...set.cycles];
    const [removed] = newCycles.splice(fromIndex, 1);
    newCycles.splice(toIndex, 0, removed);
    updateSet({ cycles: newCycles });
  };

  const addMetadataKey = (atIndex: number) => {
    const newKey = prompt(`Enter metadata key name:`);
    if (newKey && !set.metadataKeys.includes(newKey)) {
      const newKeys = [...set.metadataKeys];
      newKeys.splice(atIndex, 0, newKey);
      updateSet({ metadataKeys: newKeys });
    }
  };

  const addCycleKey = (atIndex: number) => {
    const newKey = prompt(`Enter cycle key name:`);
    if (newKey && !set.cycles.map(c => c.key).includes(newKey)) {
      const newCycles = [...set.cycles];
      newCycles.splice(atIndex, 0, { key: newKey, blueprint: undefined });
      updateSet({ cycles: newCycles });
    }
  };

  const onRemoveCycleBlueprint = (cycleIndex: number) => {
    if (confirm('Are you sure you want to remove the blueprint?')) {
      const newCycles = [...set.cycles];
      newCycles[cycleIndex] = { ...newCycles[cycleIndex], blueprint: undefined };
      updateSet({ cycles: newCycles });
    }
  };

  const updateMetadataKey = (rowIndex: number, _newKey: string) => {
    let index = 1;
    let newKey = _newKey;
    while (set.metadataKeys.includes(newKey)) {
      newKey = `${_newKey}_${index}`;
      index++;
      if (index > 100) return; // Prevent infinite loop
    }

    const oldKey = set.metadataKeys[rowIndex];
    if (newKey === oldKey) return; // No change

    const newMetadataKeys = [...set.metadataKeys];
    newMetadataKeys[rowIndex] = newKey;

    // Update archetypes to rename the metadata key
    const newArchetypes = set.archetypes.map(archetype => {
      const newMetadata = { ...archetype.metadata };
      if (oldKey in newMetadata) {
        newMetadata[newKey] = newMetadata[oldKey];
        delete newMetadata[oldKey];
      }
      return { ...archetype, metadata: newMetadata };
    });

    updateSet({ metadataKeys: newMetadataKeys, archetypes: newArchetypes });
  };

  const deleteMetadataKey = (rowIndex: number) => {
    const keyToDelete = set.metadataKeys[rowIndex];
    if (confirm(`Are you sure you want to delete metadata key "${keyToDelete}"? This will also remove associated metadata from all archetypes. This action cannot be undone.`)) {
      const newMetadataKeys = [...set.metadataKeys];
      newMetadataKeys.splice(rowIndex, 1);

      // Update archetypes to remove the metadata key
      const newArchetypes = set.archetypes.map(archetype => {
        const newMetadata = { ...archetype.metadata };
        if (keyToDelete in newMetadata) {
          delete newMetadata[keyToDelete];
        }
        return { ...archetype, metadata: newMetadata };
      });

      updateSet({ metadataKeys: newMetadataKeys, archetypes: newArchetypes });
    }
  };

  const updateCycleKey = (rowIndex: number, _newKey: string) => {
    let index = 2;
    let newKey = _newKey;
    while (set.cycles.map(c => c.key).includes(newKey)) {
      newKey = `${_newKey}_${index}`;
      index++;
      if (index > 100) return; // Prevent infinite loop
    }

    const oldKey = set.cycles[rowIndex].key;
    if (newKey === oldKey) return; // No change

    const newCycles = [...set.cycles];
    newCycles[rowIndex] = { key: newKey, blueprint: set.cycles[rowIndex].blueprint };

    // Update archetypes to rename the cycle key
    const newArchetypes = set.archetypes.map(archetype => {
      const newCycles = { ...archetype.cycles };
      if (oldKey in newCycles) {
        newCycles[newKey] = newCycles[oldKey];
        delete newCycles[oldKey];
      }
      return { ...archetype, cycles: newCycles };
    });

    updateSet({ cycles: newCycles, archetypes: newArchetypes });
  };

  const deleteCycleKey = (rowIndex: number) => {
    const keyToDelete = set.cycles[rowIndex].key;
    if (confirm(`Are you sure you want to delete cycle key "${keyToDelete}"? This will also remove associated cycle slots from all archetypes. This action cannot be undone.`)) {
      const newCycles = [...set.cycles];
      newCycles.splice(rowIndex, 1);

      // Update archetypes to remove the cycle key
      const newArchetypes = set.archetypes.map(archetype => {
        const newCycles = { ...archetype.cycles };
        if (keyToDelete in newCycles) {
          delete newCycles[keyToDelete];
        }
        return { ...archetype, cycles: newCycles };
      });

      updateSet({ cycles: newCycles, archetypes: newArchetypes });
    }
  };

  const onEditCycleBlueprint = (cycleIndex: number) => {
    const newBlueprint: SerializableBlueprint = {};
    const newCycles = [...set.cycles];
    newCycles[cycleIndex] = { ...newCycles[cycleIndex], blueprint: newBlueprint };
    updateSet({ cycles: newCycles });
  };

  return (
    <div>
      <h2 className='mb-2'>
        <input
          type="text"
          value={set.name}
          onChange={(e) => updateSetName(e.target.value)}
          className="text-xl font-bold border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
          placeholder="..."
        />
        <span className="font-medium text-sm inline-flex gap-2">
          {set.blueprint && <IconButton
            onClick={() => onRemoveSetBlueprint()}
            icon={faCancel}
            title="Clear Blueprint"
            variant="default"
          />}
          <IconButton
            onClick={() => onEditSetBlueprint()}
            icon={faPenToSquare}
            title="Add/Edit Blueprint"
            variant="primary"
          />
        </span>
      </h2>

      {/* Main Table */}
      <div className="overflow-x-scroll overflow-y-visible pb-[260px] border-b">
        <table className="border-collapse text-xs">
          <thead>
          <tr>
            <th className="sticky text-left p-2 font-medium min-w-[250px]">Archetypes</th>
            {set.archetypes.map((archetype, archetypeIndex) => {
              return <th key={archetypeIndex} className="group border border-zinc-300 p-1 bg-zinc-50 text-center font-medium">
                <div className="flex gap-1 px-1">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      onClick={() => deleteArchetype(archetypeIndex)}
                      icon={faTrashCan}
                      title="Delete Archetype"
                      variant="danger"
                    />
                  </div>
                  <input
                    type="text"
                    value={archetype.name}
                    onChange={(e) => updateArchetypeName(archetypeIndex, e.target.value)}
                    className="w-full border-none text-xs text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    placeholder="..."
                  />
                  {archetype.blueprint && <IconButton
                    onClick={() => onRemoveArchetypeBlueprint(archetypeIndex)}
                    icon={faCancel}
                    title="Clear Blueprint"
                    variant="default"
                  />}
                  <IconButton
                    onClick={() => onEditArchetypeBlueprint(archetypeIndex)}
                    icon={faPenToSquare}
                    title="Add/Edit Blueprint"
                    variant="primary"
                  />
                </div>
              </th>;
            })}
            <th className="border border-zinc-300 p-1 bg-zinc-50 text-center font-medium">
              <button
                onClick={() => addArchetype()}
                className="w-full border rounded active:bg-green-50 active:text-green-400 hover:text-green-600 hover:bg-green-100 p-0.5 text-xs flex items-center gap-1 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} className='text-sm mx-auto' />
              </button>
            </th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <th colSpan={set.archetypes.length + 1} className="p-2 pt-2 text-left font-medium">
              Metadata
            </th>
          </tr>
          {/* Metadata Rows */}
          {set.metadataKeys.map((metadataKey, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr>
                <td
                  className={`group px-2 border border-t-zinc-300 border-x-zinc-300 italic bg-zinc-50 text-zinc-600 ${dragOverIndex?.type === 'metadataKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                    ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-zinc-800 border-b-zinc-300' : 'border-b-2 border-t-zinc-300 border-b-zinc-800'}`
                    : 'border-y-zinc-300'}`}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    if (draggedItem && draggedItem.type === 'metadataKeys' && draggedItem.index !== rowIndex) {
                      reorderMetadataKeys(draggedItem.index, rowIndex);
                    }
                    setDraggedItem(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={() => setDragOverIndex({type: 'metadataKeys', index: rowIndex})}
                  onDragLeave={(e) => {
                    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverIndex(null);
                    }
                  }}
                >
                  <div
                    className="flex items-center gap-1"
                  >
                    <div className="hidden rounded-lg border border-green-200 bg-green-50 starting:opacity-0 opacity-80 transition-opacity absolute -translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <IconButton
                        onClick={() => addMetadataKey(rowIndex)}
                        icon={faPlus}
                        title="Add Metadata Key"
                        variant="success"
                      />
                    </div>
                    <div className="hidden rounded-lg border border-green-200 bg-green-50 starting:opacity-0 opacity-80 transition-opacity absolute translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <IconButton
                        onClick={() => addMetadataKey(rowIndex + 1)}
                        icon={faPlus}
                        title="Add Metadata Key"
                        variant="success"
                      />
                    </div>
                    <DragHandle
                      type="metadataKeys"
                      index={rowIndex}
                      draggedItem={draggedItem}
                      setDraggedItem={setDraggedItem}
                    />
                    <div className="flex w-full gap-2 pl-1">
                      <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
                        <IconButton
                          onClick={() => deleteMetadataKey(rowIndex)}
                          icon={faTrashCan}
                          title="Delete Metadata"
                          variant="danger"
                        />
                      </div>
                      <input
                        type="text"
                        value={metadataKey}
                        onChange={(e) => updateMetadataKey(rowIndex, e.target.value)}
                        className="w-full border-none text-xs text-left bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                        placeholder="..."
                      />
                    </div>
                  </div>
                </td>
                {set.archetypes.map((archetype, archetypeIndex) => {
                  const hasValue = metadataKey in archetype.metadata && archetype.metadata[metadataKey] !== undefined;
                  return (
                    <td key={archetypeIndex} className={`border border-zinc-300 p-0.5 ${hasValue ? 'bg-white' : 'bg-yellow-100'}`}>
                      <input
                        type="text"
                        value={archetype.metadata[metadataKey] || ''}
                        onChange={(e) => updateMetadata(archetypeIndex, metadataKey, e.target.value)}
                        className="w-full border-none text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                        placeholder="..."
                      />
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          ))}
          <tr>
            <th colSpan={set.archetypes.length + 1} className="p-2 pt-4 text-left font-medium">
              Cycles
            </th>
          </tr>
          </tbody>
          {/* Cycle Rows */}
          <tbody>
          {set.cycles.map(({ key: cycleKey, blueprint }, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr>
                <td
                  className={`group px-2 border border-t-zinc-300 border-x-zinc-300 bg-zinc-50 text-zinc-800 ${dragOverIndex?.type === 'cycleKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                    ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-zinc-800 border-b-zinc-300' : 'border-b-2 border-t-zinc-300 border-b-zinc-800'}`
                    : 'border-y-zinc-300'}`}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    if (draggedItem && draggedItem.type === 'cycleKeys' && draggedItem.index !== rowIndex) {
                      reorderCycleKeys(draggedItem.index, rowIndex);
                    }
                    setDraggedItem(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={() => setDragOverIndex({type: 'cycleKeys', index: rowIndex})}
                  onDragLeave={(e) => {
                    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverIndex(null);
                    }
                  }}
                >
                  <div
                    className="flex items-center gap-1"
                  >
                    <div className="hidden rounded-lg border border-green-200 bg-green-50 starting:opacity-0 opacity-80 transition-opacity absolute -translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <IconButton
                        onClick={() => addCycleKey(rowIndex)}
                        icon={faPlus}
                        title="Add Cycle Key"
                        variant="success"
                      />
                    </div>
                    <div className="hidden rounded-lg border border-green-200 bg-green-50 starting:opacity-0 opacity-80 transition-opacity absolute translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <IconButton
                        onClick={() => addCycleKey(rowIndex + 1)}
                        icon={faPlus}
                        title="Add Cycle Key"
                        variant="success"
                      />
                    </div>
                    <DragHandle
                      type="cycleKeys"
                      index={rowIndex}
                      draggedItem={draggedItem}
                      setDraggedItem={setDraggedItem}
                    />
                    <div className="flex w-full gap-2 pl-1">
                      <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
                        <IconButton
                          onClick={() => deleteCycleKey(rowIndex)}
                          icon={faTrashCan}
                          title="Delete Cycle"
                          variant="danger"
                        />
                      </div>
                      <input
                        type="text"
                        value={cycleKey}
                        onChange={(e) => updateCycleKey(rowIndex, e.target.value)}
                        className="w-full border-none text-xs text-left bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                        placeholder="..."
                      />
                      {blueprint && <IconButton
                        onClick={() => onRemoveCycleBlueprint(rowIndex)}
                        icon={faCancel}
                        title="Clear Blueprint"
                        variant="default"
                      />}
                      <IconButton
                        onClick={() => onEditCycleBlueprint(rowIndex)}
                        icon={faPenToSquare}
                        title="Add/Edit Blueprint"
                        variant="primary"
                      />
                    </div>
                  </div>
                </td>
                {!blueprint && (<td
                    colSpan={set.archetypes.length}
                    className="border border-zinc-300 p-1 text-center bg-purple-50 text-purple-600"
                  >
                    <div className="flex gap-2 items-center justify-center px-1">
                      <FontAwesomeIcon icon={faArrowLeft} />
                      <FontAwesomeIcon icon={faWarning} />
                      <span className={`text-sm font-medium text-purple-800`}>
                        Cycle &ldquo;{cycleKey}&rdquo; is missing a blueprint.
                      </span>
                    </div>
                </td>)}
                {blueprint && set.archetypes.map((archetype, archetypeIndex) => {
                  const { status, reasons } = getCycleSlotStatus(cards, set, archetypeIndex, cycleKey);
                  const slot = set.archetypes[archetypeIndex].cycles[cycleKey];
                  const cardRef = slot && typeof slot !== 'string' && "cardRef" in slot ? slot.cardRef : undefined;
                  const hasSlotBlueprint = (slot && typeof slot !== 'string' && "blueprint" in slot ? slot.blueprint : undefined) !== undefined;
                  return <StatusTableCell
                    key={archetype.name}
                    status={status}
                    statusReasons={reasons ?? []}
                    onMarkSkip={() => markSkip(archetypeIndex, cycleKey)}
                    onMarkNotSkip={() => markNotSkip(archetypeIndex, cycleKey)}
                    onCreateCard={() => createCard(archetypeIndex, cycleKey)}
                    onLinkCard={() => linkCard(archetypeIndex, cycleKey)}
                    onEditCard={() => editCard(slot)}
                    onUnlinkCard={() => unlinkCard(archetypeIndex, cycleKey)}
                    hasBlueprint={hasSlotBlueprint}
                    onEditBlueprint={() => onEditSlotBlueprint(archetypeIndex, cycleKey)}
                    onRemoveBlueprint={() => onRemoveSlotBlueprint(archetypeIndex, cycleKey)}
                    cardPreviewUrl={cardRef === undefined ? undefined : `${serverUrl}/render/${cardRef.cardId}`}
                  />
                })}
              </tr>
            </React.Fragment>
          ))}

          {/* Status Legend */}
          <tr>
            <td colSpan={set.archetypes.length + 1} className="p-1 pt-2 text-right">
              <div className="flex flex-wrap w-full justify-end gap-4 text-xs text-zinc-700">
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
                  <span>Missing: {statusCounts.missing}</span>
                </span>
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faCircle} className="text-zinc-400" />
                  <span>Skip: {statusCounts.skip}</span>
                </span>
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faTimes} className="text-red-600" />
                  <span>Invalid: {statusCounts.invalid}</span>
                </span>
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faCheck} className="text-green-600" />
                  <span>Valid: {statusCounts.valid}</span>
                </span>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>);
};
