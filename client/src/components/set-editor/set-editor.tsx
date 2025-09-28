'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { SetLocation, SerializableBlueprintWithSource, SerializableSet, SerializedCard, Set, Card } from 'kindred-paths';
import { serverUrl } from '@/utils/server';
import { IconButton } from '@/components/icon-button';
import { DragHandle } from '@/components/set-editor/drag-handle';
import { SetEditorCell } from '@/components/set-editor/set-editor-cell';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';
import { CardEditor } from '@/components/editor/card-editor';

export interface SetEditorProps {
  cards: SerializedCard[],
  set: SerializableSet;
}

type CardEditorSettings = {
  archetypeIndex: number,
  cycleKey: string,
  card: SerializedCard,
  blueprints: SerializableBlueprintWithSource[],
}

export function SetEditor(props: SetEditorProps) {
  const [cards, setAllCards] = useState<SerializedCard[]>(props.cards);
  const [serializableSet, setSerializableSet] = useState(props.set);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [blueprintEditorLocation, setBlueprintEditorLocation] = useState<SetLocation>();
  const [cardEditorSettings, setCardEditorSettings] = useState<CardEditorSettings>();

  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  const set = new Set(serializableSet);
  const statusCounts = set.getSlotStats(cards);

  const saveChanges = (props?: { newCards?: SerializedCard[] }) => {
    setValidationMessages(set.validateAndCorrect(props?.newCards ?? cards));
    setSerializableSet(set.serialize());
    // TODO: Save in backend.
  };

  useEffect(() => {
    saveChanges();
  }, []);

  // Set
  const updateSetName = (newName: string) => {
    set.updateName(newName);
    saveChanges();
  };

  // Archetype
  const updateArchetypeName = (archetypeIndex: number, newName: string) => {
    set.updateArchetypeName(archetypeIndex, newName);
    saveChanges();
  };

  const addArchetype = () => {
    const newName = prompt('Enter new archetype name:');
    if (newName) {
      set.addArchetype(newName);
      saveChanges();
    }
  };

  const deleteArchetype = (archetypeIndex: number) => {
    if (confirm(`Are you sure you want to delete archetype "${set.getArchetype(archetypeIndex).name}"? This action cannot be undone.`)) {
      set.deleteArchetype(archetypeIndex);
      saveChanges();
    }
  };

  // Metadata
  const updateMetadataValue = (archetypeIndex: number, metadataKey: string, value: string) => {
    set.updateMetadataValue(archetypeIndex, metadataKey, value);
    saveChanges();
  };

  const reorderMetadataKeys = (fromIndex: number, toIndex: number) => {
   set.reorderMetadataKeys(fromIndex, toIndex);
   saveChanges();
  };

  const addMetadataKey = (atIndex: number) => {
    const newKey = prompt(`Enter metadata key name:`);
    if (newKey) {
      set.addMetadataKey(atIndex, newKey);
      saveChanges();
    }
  };

  const updateMetadataKey = (metadataIndex: number, newKey: string) => {
    set.updateMetadataKey(metadataIndex, newKey);
    saveChanges();
  };

  const deleteMetadataKey = (metadataIndex: number) => {
    const keyToDelete = set.getMetadataKey(metadataIndex);
    if (confirm(`Are you sure you want to delete metadata key "${keyToDelete}"? This will also remove associated metadata from all archetypes. This action cannot be undone.`)) {
      set.deleteMetadataKey(metadataIndex);
      saveChanges();
    }
  };

  // Cycle
  const reorderCycles = (fromIndex: number, toIndex: number) => {
    set.reorderCycles(fromIndex, toIndex);
    saveChanges();
  };

  const addCycle = (atIndex: number) => {
    const newKey = prompt(`Enter cycle key name:`);
    if (newKey) {
      set.addCycle(atIndex, newKey);
      saveChanges();
    }
  };

  const updateCycleKey = (cycleIndex: number, _newKey: string) => {
    set.updateCycleKey(cycleIndex, _newKey);
    saveChanges();
  };

  const deleteCycle = (cycleIndex: number) => {
    const keyToDelete = set.getCycleKey(cycleIndex);
    if (confirm(`Are you sure you want to delete cycle key "${keyToDelete}"? This will also remove associated cycle slots from all archetypes. This action cannot be undone.`)) {
      set.deleteCycle(cycleIndex);
      saveChanges();
    }
  };

  const markSkip = (archetypeIndex: number, cycleKey: string) => {
    set.markSlotAsSkip(archetypeIndex, cycleKey);
    saveChanges();
  }

  const markNotSkip = (archetypeIndex: number, cycleKey: string) => {
    set.clearSlot(archetypeIndex, cycleKey);
    saveChanges();
  }

  const unlinkCard = (archetypeIndex: number, cycleKey: string) => {
    set.unlinkCardFromSlot(archetypeIndex, cycleKey);
    saveChanges();
  };

  const onRemoveSetBlueprint = () => {
    set.removeSetBlueprint();
    saveChanges();
  };

  const onRemoveArchetypeBlueprint = (archetypeIndex: number) => {
    set.removeArchetypeBlueprint(archetypeIndex);
    saveChanges();
  }

  const onRemoveCycleBlueprint = (cycleIndex: number) => {
    set.removeCycleBlueprint(cycleIndex);
    saveChanges();
  };

  const onRemoveSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    set.removeSlotBlueprint(archetypeIndex, cycleKey);
    saveChanges();
  }

  const onEditSetBlueprint = () => {
    setBlueprintEditorLocation({ type: 'set' });
  };

  const onEditArchetypeBlueprint = (archetypeIndex: number) => {
    setBlueprintEditorLocation({ type: 'archetype', index: archetypeIndex });
  };

  const onEditCycleBlueprint = (cycleIndex: number) => {
    setBlueprintEditorLocation({ type: 'cycle', index: cycleIndex });
  };

  const onEditSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    setBlueprintEditorLocation({ type: 'slot', archetypeIndex, cycleKey });
  };

  const editCard = (archetypeIndex: number, cycleKey: string) => {
    const slot = set.getArchetype(archetypeIndex).cycles[cycleKey];
    if (slot && typeof slot !== 'string' && "cardRef" in slot && slot.cardRef) {
      const card = cards.filter(c => c.id === slot.cardRef?.cardId).pop();
      if (card) {
        setCardEditorSettings({
          archetypeIndex,
          cycleKey,
          card,
          blueprints: set.getBlueprintsForSlot(archetypeIndex, cycleKey),
        });
      }
    }
  }

  const createCard = (archetypeIndex: number , cycleKey: string) => {
    setCardEditorSettings({
      archetypeIndex,
      cycleKey,
      card: Card.new(),
      blueprints: set.getBlueprintsForSlot(archetypeIndex, cycleKey),
    });
  }

  return (
    <div>
      {cardEditorSettings && <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-10 overflow-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setCardEditorSettings(undefined);
        }
      }}
    >
      <div className="max-w-[1200px]">
        <CardEditor
          start={cardEditorSettings.card}
          blueprints={cardEditorSettings.blueprints}
          onSave={(updatedCard) => {
            const cardIndex = cards.findIndex(c => c.id === updatedCard.id);
            let newCards;
            if (cardIndex === -1) {
              newCards = [...cards, updatedCard];
            } else {
              newCards = [
                ...cards.slice(0, cardIndex),
                updatedCard,
                ...cards.slice(cardIndex + 1),
              ];
            }
            setAllCards(newCards);
            set.linkCardToSlot(cardEditorSettings.archetypeIndex, cardEditorSettings.cycleKey, { cardId: updatedCard.id });
            saveChanges({ newCards });
            setCardEditorSettings(undefined);
          }}
          onCancel={() => setCardEditorSettings(undefined)}
        />
      </div>
    </div>}
      {blueprintEditorLocation && <div
        className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-10 overflow-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setBlueprintEditorLocation(undefined);
          }
        }}
      >
        <div className="max-w-[900px]">
          <BlueprintEditor
            title={set.getLocationName(blueprintEditorLocation)}
            metadataKeys={set.getMetadataKeys()}
            blueprint={set.getBlueprintAt(blueprintEditorLocation) ?? {}}
            onSave={(blueprint) => {
              set.setBlueprintAt(blueprintEditorLocation, blueprint);
              saveChanges();
              setBlueprintEditorLocation(undefined);
            }}
            onCancel={() => setBlueprintEditorLocation(undefined)}
          />
        </div>
      </div>}
      {validationMessages.length > 0 && <div className="text-amber-700 text-sm px-4 py-2 border rounded-lg bg-amber-50 mb-4">
        <h3 className="font-bold underline">Warnings!</h3>
        <ul className="p-0.5">
          {validationMessages.map(validationMessage => (<li key={validationMessage} className="p-1">
            <FontAwesomeIcon icon={faWarning} className="pr-1" /> {validationMessage}
          </li>))}
        </ul>
      </div>}
      <h2 className='mb-2'>
        <input
          type="text"
          value={serializableSet.name}
          onChange={(e) => updateSetName(e.target.value)}
          className="text-xl font-bold border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
          placeholder="..."
        />
        <span className="font-medium text-sm inline-flex gap-2">
          {serializableSet.blueprint && <IconButton
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
      <div className="overflow-x-scroll overflow-y-visible pb-[260px] border-b border-gray-200">
        <table className="border-collapse text-xs">
          <thead>
          <tr>
            <th className="sticky text-left p-2 font-medium min-w-[250px]">Archetypes</th>
            {serializableSet.archetypes.map((archetype, archetypeIndex) => {
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
            <th colSpan={serializableSet.archetypes.length + 1} className="p-2 pt-2 text-left font-medium">
              Metadata
            </th>
          </tr>
          {/* Metadata Rows */}
          {serializableSet.metadataKeys.map((metadataKey, rowIndex) => (
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
                {serializableSet.archetypes.map((archetype, archetypeIndex) => {
                  const hasValue = metadataKey in archetype.metadata && archetype.metadata[metadataKey] !== undefined;
                  return (
                    <td key={archetypeIndex} className={`border border-zinc-300 p-0.5 ${hasValue ? 'bg-white' : 'bg-yellow-100'}`}>
                      <input
                        type="text"
                        value={archetype.metadata[metadataKey] || ''}
                        onChange={(e) => updateMetadataValue(archetypeIndex, metadataKey, e.target.value)}
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
            <th colSpan={serializableSet.archetypes.length + 1} className="p-2 pt-4 text-left font-medium">
              Cycles
            </th>
          </tr>
          </tbody>
          {/* Cycle Rows */}
          <tbody>
          {serializableSet.cycles.map(({ key: cycleKey, blueprint }, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr>
                <td
                  className={`group px-2 border border-t-zinc-300 border-x-zinc-300 bg-zinc-50 text-zinc-800 ${dragOverIndex?.type === 'cycleKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                    ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-zinc-800 border-b-zinc-300' : 'border-b-2 border-t-zinc-300 border-b-zinc-800'}`
                    : 'border-y-zinc-300'}`}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    if (draggedItem && draggedItem.type === 'cycleKeys' && draggedItem.index !== rowIndex) {
                      reorderCycles(draggedItem.index, rowIndex);
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
                        onClick={() => addCycle(rowIndex)}
                        icon={faPlus}
                        title="Add Cycle Key"
                        variant="success"
                      />
                    </div>
                    <div className="hidden rounded-lg border border-green-200 bg-green-50 starting:opacity-0 opacity-80 transition-opacity absolute translate-y-1/2 translate-x-[-120%] group-hover:flex justify-center">
                      <IconButton
                        onClick={() => addCycle(rowIndex + 1)}
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
                          onClick={() => deleteCycle(rowIndex)}
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
                    colSpan={serializableSet.archetypes.length}
                    className="border border-zinc-300 p-1 text-center bg-purple-50 text-purple-600"
                  >
                    <div className="flex gap-2 items-center justify-start px-1">
                      <FontAwesomeIcon icon={faArrowLeft} />
                      <FontAwesomeIcon icon={faWarning} />
                      <span className={`text-sm font-medium text-purple-800`}>
                        Cycle &ldquo;{cycleKey}&rdquo; is missing a blueprint.
                      </span>
                    </div>
                </td>)}
                {blueprint && serializableSet.archetypes.map((archetype, archetypeIndex) => {
                  const { status, reasons } = set.getSlotStatus(cards, archetypeIndex, cycleKey);
                  const slot = serializableSet.archetypes[archetypeIndex].cycles[cycleKey];
                  const cardRef = slot && typeof slot !== 'string' && "cardRef" in slot ? slot.cardRef : undefined;
                  const hasSlotBlueprint = (slot && typeof slot !== 'string' && "blueprint" in slot ? slot.blueprint : undefined) !== undefined;
                  return <SetEditorCell
                    key={archetype.name}
                    status={status}
                    statusReasons={reasons ?? []}
                    onMarkSkip={() => markSkip(archetypeIndex, cycleKey)}
                    onMarkNotSkip={() => markNotSkip(archetypeIndex, cycleKey)}
                    onCreateCard={() => createCard(archetypeIndex, cycleKey)}
                    onLinkCard={() => linkCard(archetypeIndex, cycleKey)}
                    onEditCard={() => editCard(archetypeIndex, cycleKey)}
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
            <td colSpan={serializableSet.archetypes.length + 1} className="p-1 pt-2 text-right">
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
