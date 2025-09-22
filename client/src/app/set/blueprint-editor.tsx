import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { CycleSlot } from '@/app/set/types';

export const BlueprintEditor: React.FC<{
  slot: CycleSlot | undefined;
  onUpdate: (slot: CycleSlot) => void
}> = (/*{ slot, onUpdate }*/) => {
  return <button className="text-blue-600 hover:text-blue-800 text-xs p-0.5 rounded hover:bg-blue-50">
    <FontAwesomeIcon icon={faCog}/>
  </button>
};
