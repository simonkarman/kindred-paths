import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';

export const DragHandle: React.FC<{
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
        transition-colors cursor-grab active:cursor-grabbing
        ${isDragging ? 'text-blue-500' : ''}
        ${isDropTarget ? 'text-zinc-200' : 'text-zinc-100 group-hover:text-blue-500'}
      `}
      title="Drag to reorder"
    >
      <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
    </button>
  );
};
