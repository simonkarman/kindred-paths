'use client';

import { useState } from 'react';
import { SerializableBlueprint } from 'kindred-paths';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';

export default function Page() {
  const [blueprint, setBlueprint] = useState<SerializableBlueprint>({
    name: [{ key: 'string/contain-one-of', value: ['$[mainCharacter]'] }],
    rarity: [
      { key: 'string/contain-one-of', value: ['mythic', 'uncommon'] },
      { key: 'string/contain-all-of', value: ['mythic'] },
      { key: 'string/length', value: { key: 'number/one-of', value: [0, 1, 3] } },
    ],
    supertype: [{ key: 'string/contain-one-of', value: ['legendary'] }],
    types: [{ key: 'string-array/includes-all-of', value: ['creature'] }],
    subtypes: [{
      key: 'string-array/allow',
      value: ['rabbit', 'bird', 'cat', 'dog', 'pig', 'human', 'advisor', 'druid', 'scout'],
    }, {
      key: 'string-array/length',
      value: { key: 'number/at-most', value: 3 },
    }],
  });
  return <>
    <BlueprintEditor
      title="Example Blueprint"
      metadataKeys={['mainCharacter', 'mechanicA']}
      blueprint={blueprint}
      onSave={(b) => setBlueprint(b)}
      onCancel={() => {}}
    />
  </>;
}
