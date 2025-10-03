'use client';

import React, { PropsWithChildren, useEffect, useState } from 'react';
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
  faTrashCan,
  faWarning,
} from '@fortawesome/free-solid-svg-icons';
import { SetLocation, SerializableBlueprintWithSource, SerializableSet, SerializedCard, Set, Card } from 'kindred-paths';
import { serverUrl, putSet } from '@/utils/server';
import { IconButton } from '@/components/icon-button';
import { DragHandle } from '@/components/set-editor/drag-handle';
import { SetEditorCell } from '@/components/set-editor/set-editor-cell';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';
import { CardEditor } from '@/components/editor/card-editor';
import { CardSelector } from '@/components/set-editor/card-selector';

function Modal(props: PropsWithChildren<{ onClose: () => void }>) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-10 overflow-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) { props.onClose(); }
      }}
    >
      {props.children}
    </div>
  );
}

export interface SetEditorProps {
  set: SerializableSet,
  cards: SerializedCard[],
}

type CardEditorSettings = {
  archetypeIndex: number,
  cycleKey: string,
  card: SerializedCard,
  blueprints: SerializableBlueprintWithSource[],
}

type CardSelectorSettings = {
  archetypeIndex: number,
  cycleKey: string,
  blueprints: SerializableBlueprintWithSource[],
}

export function SetEditor(props: SetEditorProps) {
  const [cards, setAllCards] = useState<SerializedCard[]>(props.cards);
  const [serializableSet, setSerializableSet] = useState(props.set);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [blueprintEditorLocation, setBlueprintEditorLocation] = useState<SetLocation>();
  const [cardEditorSettings, setCardEditorSettings] = useState<CardEditorSettings>();
  const [cardSelectorSettings, setCardSelectorSettings] = useState<CardSelectorSettings>();

  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  const set = new Set(serializableSet);
  const statusCounts = set.getSlotStats(cards);

  const saveChanges = (props?: { newCards?: SerializedCard[] }) => {
    setValidationMessages(set.validateAndCorrect(props?.newCards ?? cards));
    const serializableSet = set.toJson();
    setSerializableSet(serializableSet);
    putSet(serializableSet).catch(e => console.error('Error saving set:', e));
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

  const linkCard = (archetypeIndex: number, cycleKey: string) => {
    setCardSelectorSettings({
      archetypeIndex,
      cycleKey,
      blueprints: set.getBlueprintsForSlot(archetypeIndex, cycleKey),
    });
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        {/* Modals */}
        {cardEditorSettings && (
          <Modal onClose={() => setCardEditorSettings(undefined)}>
            <div className="w-full max-w-[1200px] rounded-xl shadow-2xl overflow-hidden">
              <CardEditor
                start={cardEditorSettings.card}
                validate={{
                  blueprints: cardEditorSettings.blueprints,
                  metadata: set.getArchetype(cardEditorSettings.archetypeIndex).metadata,
                }}
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
          </Modal>
        )}

        {blueprintEditorLocation && (
          <Modal onClose={() => setBlueprintEditorLocation(undefined)}>
            <div className="w-full max-w-[900px] rounded-xl shadow-2xl overflow-hidden">
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
          </Modal>
        )}

        {cardSelectorSettings && (
          <Modal onClose={() => setCardSelectorSettings(undefined)}>
            <div className="bg-white w-full max-w-[900px] rounded-xl shadow-2xl overflow-hidden">
              <CardSelector
                search={{
                  scope: `set/${serializableSet.name}/archetype/${cardSelectorSettings.archetypeIndex}/cycle/${cardSelectorSettings.cycleKey}/selector`,
                  initial: `set:${serializableSet.name}`,
                }}
                cards={cards}
                validation={{
                  blueprints: cardSelectorSettings.blueprints,
                  metadata: set.getArchetype(cardSelectorSettings.archetypeIndex).metadata,
                }}
                onSelect={(card) => {
                  set.linkCardToSlot(cardSelectorSettings.archetypeIndex, cardSelectorSettings.cycleKey, { cardId: card.id });
                  saveChanges();
                  setCardSelectorSettings(undefined);
                }}
                onCancel={() => setCardSelectorSettings(undefined)}
              />
            </div>
          </Modal>
        )}

        {/* Header Section */}
        <div className="mx-auto max-w-[1600px] bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6 space-y-2">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={serializableSet.name}
                onChange={(e) => updateSetName(e.target.value)}
                className="text-2xl font-bold border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 w-full"
                placeholder="Enter set name..."
              />
              <p className="text-xs text-slate-400 mt-1 px-2">ID: {set.getId()}</p>
            </div>
            <div className="flex gap-2">
              {serializableSet.blueprint && (
                <IconButton
                  onClick={() => onRemoveSetBlueprint()}
                  icon={faCancel}
                  title="Clear Blueprint"
                  variant="default"
                />
              )}
              <IconButton
                onClick={() => onEditSetBlueprint()}
                icon={faPenToSquare}
                title="Add/Edit Blueprint"
                variant="primary"
              />
            </div>
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap justify-end gap-6 text-sm">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
              <span className="text-slate-700">
                Missing: <span className="font-semibold text-slate-900">{statusCounts.missing}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCircle} className="text-slate-400" />
              <span className="text-slate-700">
                      Skip: <span className="font-semibold text-slate-900">{statusCounts.skip}</span>
                    </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faTimes} className="text-red-600" />
              <span className="text-slate-700">
                Invalid: <span className="font-semibold text-slate-900">{statusCounts.invalid}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheck} className="text-green-600" />
              <span className="text-slate-700">
                Valid: <span className="font-semibold text-slate-900">{statusCounts.valid}</span>
                <span className="text-slate-500 ml-1">
                  / {statusCounts.missing + statusCounts.invalid + statusCounts.valid}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Validation Messages */}
        {validationMessages.length > 0 && (
          <div className="mx-auto max-w-[1600px] bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <FontAwesomeIcon icon={faWarning} className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">Validation Warnings</h3>
                <ul className="space-y-1">
                  {validationMessages.map(validationMessage => (
                    <li key={validationMessage} className="text-sm text-amber-800">
                      {validationMessage}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Main Table Container */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-xs">
              <thead>
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 text-left p-3 font-semibold text-slate-900 border-b-2 border-slate-300">
                  Archetypes
                </th>
                {serializableSet.archetypes.map((archetype, archetypeIndex) => (
                  <th key={archetypeIndex} className="group border-b-2 border-slate-300 border-l p-2 bg-slate-50 min-w-[250px] text-center font-medium">
                    <div className="flex gap-1 px-1 items-center justify-center">
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
                        className="w-full border-none text-xs text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Archetype name..."
                      />
                      {archetype.blueprint && (
                        <IconButton
                          onClick={() => onRemoveArchetypeBlueprint(archetypeIndex)}
                          icon={faCancel}
                          title="Clear Blueprint"
                          variant="default"
                        />
                      )}
                      <IconButton
                        onClick={() => onEditArchetypeBlueprint(archetypeIndex)}
                        icon={faPenToSquare}
                        title="Add/Edit Blueprint"
                        variant="primary"
                      />
                    </div>
                  </th>
                ))}
                <th className="border-b-2 border-slate-300 border-l p-2 bg-slate-50 text-center font-medium">
                  <button
                    onClick={() => addArchetype()}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-sm" />
                  </button>
                </th>
              </tr>
              </thead>
              <tbody>
              {/* Metadata Section Header */}
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 p-3 pt-4 text-left font-semibold text-slate-900 border-b border-slate-200">
                  Metadata
                </th>
                <th colSpan={serializableSet.archetypes.length + 1} className="bg-slate-100" />
              </tr>

              {/* Metadata Rows */}
              {serializableSet.metadataKeys.map((metadataKey, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    className={`group sticky z-10 left-0 px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700 ${
                      dragOverIndex?.type === 'metadataKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                        ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500'}`
                        : ''
                    }`}
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
                    <div className="flex items-center gap-2">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex absolute left-[-10px] flex-col gap-1">
                        <IconButton
                          onClick={() => addMetadataKey(rowIndex)}
                          icon={faPlus}
                          title="Add Metadata Key"
                          variant="success"
                        />
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
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="flex-1 border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Metadata key..."
                      />
                    </div>
                  </td>
                  {serializableSet.archetypes.map((archetype, archetypeIndex) => {
                    const hasValue = metadataKey in archetype.metadata && archetype.metadata[metadataKey] !== undefined;
                    return (
                      <td key={archetypeIndex} className={`border border-slate-200 p-1 ${hasValue ? 'bg-white' : 'bg-yellow-50 hover:bg-yellow-100'}`}>
                        <input
                          type="text"
                          value={archetype.metadata[metadataKey] || ''}
                          onChange={(e) => updateMetadataValue(archetypeIndex, metadataKey, e.target.value)}
                          className="w-full border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 placeholder:text-yellow-800"
                          placeholder="..."
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Add Metadata Key Button */}
              <tr>
                <td className="sticky z-10 left-0 p-3 bg-slate-100">
                  <button
                    onClick={() => addMetadataKey(serializableSet.metadataKeys.length)}
                    className="px-4 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors text-xs flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Metadata Key
                  </button>
                </td>
                <td colSpan={serializableSet.archetypes.length + 1} className="bg-slate-100" />
              </tr>

              {/* Cycles Section Header */}
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 p-3 pt-8 text-left font-semibold text-slate-900 border-b border-slate-200">
                  Cycles
                </th>
                <th colSpan={serializableSet.archetypes.length + 1} className="bg-slate-100" />
              </tr>

              {/* Cycle Rows */}
              {serializableSet.cycles.map(({ key: cycleKey, blueprint }, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    className={`group sticky z-10 left-0 px-3 py-2 border border-slate-200 bg-slate-50 text-slate-800 ${
                      dragOverIndex?.type === 'cycleKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                        ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500'}`
                        : ''
                    }`}
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
                    <div className="flex items-center gap-2">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex absolute left-[-10px] flex-col gap-1">
                        <IconButton
                          onClick={() => addCycle(rowIndex)}
                          icon={faPlus}
                          title="Add Cycle Key"
                          variant="success"
                        />
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
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="flex-1 border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Cycle key..."
                      />
                      {blueprint && (
                        <IconButton
                          onClick={() => onRemoveCycleBlueprint(rowIndex)}
                          icon={faCancel}
                          title="Clear Blueprint"
                          variant="default"
                        />
                      )}
                      <IconButton
                        onClick={() => onEditCycleBlueprint(rowIndex)}
                        icon={faPenToSquare}
                        title="Add/Edit Blueprint"
                        variant="primary"
                      />
                    </div>
                  </td>
                  {!blueprint && (
                    <td
                      colSpan={serializableSet.archetypes.length}
                      className="border border-slate-200 p-3 bg-blue-50"
                    >
                      <div className="flex gap-3 items-center">
                        <FontAwesomeIcon icon={faArrowLeft} className="text-blue-600" />
                        <FontAwesomeIcon icon={faWarning} className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                            Cycle &ldquo;{cycleKey}&rdquo; is missing a blueprint
                          </span>
                      </div>
                    </td>
                  )}
                  {blueprint && serializableSet.archetypes.map((archetype, archetypeIndex) => {
                    const { status, reasons } = set.getSlotStatus(cards, archetypeIndex, cycleKey);
                    const slot = serializableSet.archetypes[archetypeIndex].cycles[cycleKey];
                    const cardRef = slot && typeof slot !== 'string' && "cardRef" in slot ? slot.cardRef : undefined;
                    const card = cardRef ? cards.filter(c => c.id === cardRef.cardId).pop() : undefined;
                    const hasSlotBlueprint = (slot && typeof slot !== 'string' && "blueprint" in slot ? slot.blueprint : undefined) !== undefined;
                    return (
                      <SetEditorCell
                        key={archetype.name}
                        cardName={card?.name ?? 'Unknown Card'}
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
                    );
                  })}
                </tr>
              ))}

              {/* Add Cycle Button */}
              <tr>
                <td className="sticky z-10 left-0 p-3 pb-80 bg-slate-100">
                  <button
                    onClick={() => addCycle(serializableSet.cycles.length)}
                    className="px-4 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors text-xs flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Cycle
                  </button>
                </td>
                <td colSpan={serializableSet.archetypes.length + 1} className="bg-slate-100" />
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
