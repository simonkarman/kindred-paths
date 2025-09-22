import React from 'react';
import { SerializableCardReference } from '@/app/set/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

export const CardImageLink: React.FC<{ cardRef: SerializableCardReference }> = (/*{ cardRef }*/) => (
  <button className="text-green-600 hover:text-green-800 text-xs p-0.5 rounded hover:bg-green-50">
    <FontAwesomeIcon icon={faImage}/>
  </button>
);
