'use client';

import { useState } from 'react';
import { SerializableBlueprint } from 'kindred-paths';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';

export default function Page() {
  const [blueprint, setBlueprint] = useState<SerializableBlueprint>({
    // name: [{ key: 'string/must-include-one-of', value: ['$[mainCharacter]'] }],
    rarity: [
      { key: 'string/must-include-one-of', value: ['mythic', 'uncommon'] },
      { key: 'string/must-include-all-of', value: ['mythic'] },
      { key: 'string/must-have-length', value: { key: 'number/must-be-one-of', value: [0, 1, 3] } },
    ],
    supertype: [{ key: 'string/must-include-one-of', value: ['legendary'] }],
    types: [{ key: 'string-array/must-include-all-of', value: ['creature'] }],
    subtypes: [{
      key: 'string-array/must-only-use-from',
      value: ['rabbit', 'bird', 'cat', 'dog', 'pig', 'human', 'advisor', 'druid', 'scout'],
    }, {
      key: 'string-array/must-have-length',
      value: { key: 'number/must-be-at-most', value: 3 },
    }],
  });
  return <>
    <BlueprintEditor
      blueprint={blueprint}
      onSave={(b) => setBlueprint(b)}
      onCancel={() => {}}
    />
  </>;
}
