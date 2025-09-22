'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCircle,
  faEdit,
  faExclamationTriangle,
  faGripVertical,
  faPlus,
  faTimes,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { CycleSlot, SerializableArchetype, SerializableSet, SlotStatus, validateBlueprintWithCardReference } from '@/app/set/types';
import { StatusTableCell } from '@/app/set/status-table-cell';

export interface SetTableProps {
  set: SerializableSet;
  onSave: (set: SerializableSet) => void;
}

export const SetTable: React.FC<SetTableProps> = ({ set, onSave }) => {
  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  const getSlotStatus = (slot: CycleSlot | undefined, archetypeMetadata: SerializableArchetype['metadata']): SlotStatus => {
    if (!slot) return 'missing';
    if (slot === 'skip') return 'skip';
    if (!slot.ref) return 'blueprint';

    const isValid = validateBlueprintWithCardReference(archetypeMetadata, slot.blueprint, slot.ref);
    return isValid ? 'valid' : 'invalid';
  };

  // Calculate status counts for legend
  const statusCounts = { missing: 0, blueprint: 0, skip: 0, invalid: 0, valid: 0 };

  set.cycleKeys.forEach(cycleKey => {
    set.archetypes.forEach(archetype => {
      const slot = archetype.cycles[cycleKey];
      const status = getSlotStatus(slot, archetype['metadata']);
      statusCounts[status]++;
    });
  });

  const getStatusDisplay = (status: SlotStatus) => {
    const displays = {
      missing: { icon: faExclamationTriangle, bgClass: 'bg-yellow-100', iconClass: 'text-yellow-600' },
      blueprint: { icon: faEdit, bgClass: 'bg-blue-100', iconClass: 'text-blue-600' },
      skip: { icon: faCircle, bgClass: 'bg-zinc-100', iconClass: 'text-zinc-400' },
      invalid: { icon: faTimes, bgClass: 'bg-red-100', iconClass: 'text-red-600' },
      valid: { icon: faCheck, bgClass: 'bg-green-100', iconClass: 'text-green-600' }
    };
    return displays[status] || displays.missing;
  };

  const updateSet = (updates: Partial<SerializableSet>) => {
    onSave({ ...set, ...updates });
  };

  const updateSetName = (newName: string) => {
    updateSet({ name: newName });
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

  const reorderKeys = (keyType: 'metadataKeys' | 'cycleKeys', fromIndex: number, toIndex: number) => {
    const newKeys = [...set[keyType]];
    const [removed] = newKeys.splice(fromIndex, 1);
    newKeys.splice(toIndex, 0, removed);
    updateSet({ [keyType]: newKeys });
  };

  const addKey = (keyType: 'metadataKeys' | 'cycleKeys', atIndex: number) => {
    const newKey = prompt(`Enter ${keyType === 'metadataKeys' ? 'metadata' : 'cycle'} key name:`);
    if (newKey && !set[keyType].includes(newKey)) {
      const newKeys = [...set[keyType]];
      newKeys.splice(atIndex, 0, newKey);
      updateSet({ [keyType]: newKeys });
    }
  };

  const updateCycleSlot = (archetypeIndex: number, cycleKey: string, newSlot: CycleSlot) => {
    const newArchetypes = [...set.archetypes];
    newArchetypes[archetypeIndex] = {
      ...newArchetypes[archetypeIndex],
      cycles: { ...newArchetypes[archetypeIndex].cycles, [cycleKey]: newSlot }
    };
    updateSet({ archetypes: newArchetypes });
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
    while (set.cycleKeys.includes(newKey)) {
      newKey = `${_newKey}_${index}`;
      index++;
      if (index > 100) return; // Prevent infinite loop
    }

    const oldKey = set.cycleKeys[rowIndex];
    if (newKey === oldKey) return; // No change

    const newCycleKeys = [...set.cycleKeys];
    newCycleKeys[rowIndex] = newKey;

    // Update archetypes to rename the cycle key
    const newArchetypes = set.archetypes.map(archetype => {
      const newCycles = { ...archetype.cycles };
      if (oldKey in newCycles) {
        newCycles[newKey] = newCycles[oldKey];
        delete newCycles[oldKey];
      }
      return { ...archetype, cycles: newCycles };
    });

    updateSet({ cycleKeys: newCycleKeys, archetypes: newArchetypes });
  };

  const deleteCycleKey = (rowIndex: number) => {
    const keyToDelete = set.cycleKeys[rowIndex];
    if (confirm(`Are you sure you want to delete cycle key "${keyToDelete}"? This will also remove associated cycle slots from all archetypes. This action cannot be undone.`)) {
      const newCycleKeys = [...set.cycleKeys];
      newCycleKeys.splice(rowIndex, 1);

      // Update archetypes to remove the cycle key
      const newArchetypes = set.archetypes.map(archetype => {
        const newCycles = { ...archetype.cycles };
        if (keyToDelete in newCycles) {
          delete newCycles[keyToDelete];
        }
        return { ...archetype, cycles: newCycles };
      });

      updateSet({ cycleKeys: newCycleKeys, archetypes: newArchetypes });
    }
  };

  return (
    <div>
      <h2 className='mb-2 text-xl font-bold'>
        <input
          type="text"
          value={set.name}
          onChange={(e) => updateSetName(e.target.value)}
          className="border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
          placeholder="..."
        />
      </h2>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
          <tr>
            <th className="sticky text-left p-2 font-medium min-w-[200px]">Archetypes</th>
            {set.archetypes.map((archetype, index) => (
              <th key={index} className="border border-zinc-300 p-1 bg-zinc-50 text-center font-medium">
                <div className="flex gap-1 px-1">
                  <input
                    type="text"
                    value={archetype.name}
                    onChange={(e) => updateArchetypeName(index, e.target.value)}
                    className="w-full border-none text-xs text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    placeholder="..."
                  />
                  <button
                    className="active:text-red-400 hover:text-red-600"
                    onClick={() => deleteArchetype(index)}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              </th>
            ))}
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
                      reorderKeys('metadataKeys', draggedItem.index, rowIndex);
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
                    <div className="hidden absolute -translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <AddButton onAdd={() => addKey('metadataKeys', rowIndex)} />
                    </div>
                    <div className="hidden absolute translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <AddButton onAdd={() => addKey('metadataKeys', rowIndex + 1)} />
                    </div>
                    <DragHandle
                      type="metadataKeys"
                      index={rowIndex}
                      draggedItem={draggedItem}
                      setDraggedItem={setDraggedItem}
                    />
                    <div className="flex w-full gap-2 pr-1">
                      <input
                        type="text"
                        value={metadataKey}
                        onChange={(e) => updateMetadataKey(rowIndex, e.target.value)}
                        className="w-full border-none text-xs text-left bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                        placeholder="..."
                      />
                      <button
                        className="active:text-red-400 hover:text-red-600"
                        onClick={() => deleteMetadataKey(rowIndex)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
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
          {set.cycleKeys.map((cycleKey, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr>
                <td
                  className={`group px-2 border border-t-zinc-300 border-x-zinc-300 bg-zinc-50 text-zinc-800 ${dragOverIndex?.type === 'cycleKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                    ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-zinc-800 border-b-zinc-300' : 'border-b-2 border-t-zinc-300 border-b-zinc-800'}`
                    : 'border-y-zinc-300'}`}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    if (draggedItem && draggedItem.type === 'cycleKeys' && draggedItem.index !== rowIndex) {
                      reorderKeys('cycleKeys', draggedItem.index, rowIndex);
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
                    <div className="hidden absolute -translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <AddButton onAdd={() => addKey('cycleKeys', rowIndex)} />
                    </div>
                    <div className="hidden absolute translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <AddButton onAdd={() => addKey('cycleKeys', rowIndex + 1)} />
                    </div>
                    <DragHandle
                      type="cycleKeys"
                      index={rowIndex}
                      draggedItem={draggedItem}
                      setDraggedItem={setDraggedItem}
                    />
                    <div className="flex w-full gap-2 pr-1">
                      <input
                        type="text"
                        value={cycleKey}
                        onChange={(e) => updateCycleKey(rowIndex, e.target.value)}
                        className="w-full border-none text-xs text-left bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                        placeholder="..."
                      />
                      <button
                        className="active:text-red-400 hover:text-red-600"
                        onClick={() => deleteCycleKey(rowIndex)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    </div>
                  </div>
                </td>
                {set.archetypes.map((archetype) => {
                  const slot = archetype.cycles[cycleKey];
                  const status = getSlotStatus(slot, archetype.metadata);
                  const display = getStatusDisplay(status);

// Options:
// - missing => display as warning/yellow + button to set as skip + button to open blueprint editor
// - skip => display as neutral/gray + button to mark as not skip
// - blueprint-only => display as info/blue + button to remove blueprint + button to edit blueprint + button to apply blueprint to full row + button to link a card
// - invalid => display as error/red + button to remove blueprint + button to edit blueprint + button to apply blueprint to full row + img icon for hover to see card render + button to edit card ref + button to edit card
// - valid => display as success/green + button to remove blueprint + button to edit blueprint + button to apply blueprint to full row + img icon for hover to see card render + button to edit card ref + button to edit card

                  return <StatusTableCell
                    key={archetype.name}
                    status={status}
                  />
                  // return (
                  //   <td className={`border border-zinc-300 p-1 text-center ${display.bgClass}`}>
                  //     <div className="flex items-center justify-center gap-1">
                  //       <FontAwesomeIcon icon={display.icon} className={`text-sm ${display.iconClass}`} />
                  //       <BlueprintEditor
                  //         slot={slot}
                  //         onUpdate={(newSlot) => updateCycleSlot(archetypeIndex, cycleKey, newSlot)}
                  //       />
                  //       {slot && slot !== 'skip' && slot.ref && (
                  //         <CardImageLink cardRef={slot.ref} />
                  //       )}
                  //     </div>
                  //   </td>
                  // );
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
                  <FontAwesomeIcon icon={faEdit} className="text-blue-600" />
                  <span>Blueprint: {statusCounts['blueprint']}</span>
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

const DragHandle: React.FC<{
  type: 'metadataKeys' | 'cycleKeys';
  index: number;
  draggedItem: {type: 'metadataKeys' | 'cycleKeys', index: number} | null;
  setDraggedItem: (item: {type: 'metadataKeys' | 'cycleKeys', index: number} | null) => void;
}> = ({ type, index, draggedItem, setDraggedItem }) => {

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedItem({ type, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const isDragging = draggedItem?.type === type && draggedItem?.index === index;
  const isDropTarget = draggedItem?.type === type && draggedItem?.index !== index;

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        cursor-grab active:cursor-grabbing
        ${isDragging ? 'text-blue-500' : ''}
        ${isDropTarget ? 'text-zinc-200' : 'text-zinc-100 group-hover:text-blue-500'}
      `}
      title="Drag to reorder"
    >
      <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
    </button>
  );
};

const AddButton: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  return (
      <button
        onClick={onAdd}
        className="border px-[1px] border-gray-200 rounded bg-zinc-50 text-gray-600 hover:text-green-600 hover:bg-green-200 text-xs transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} className={`text-sm mx-auto`} />
      </button>
  );
};
