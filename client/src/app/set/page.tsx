'use client';

import { SetTable } from '@/app/set/set-table';
import { SerializableSet } from '@/app/set/types';
import { useLocalStorageState } from '@/utils/use-local-storage-state';

export default function Page() {
  const [set, setSet] = useLocalStorageState<SerializableSet>('example-set3', {
    "name": "MFY",
    "metadataKeys": [
      "mainCharacter",
      "mainToken",
      "creatureTypeA",
      "creatureTypeB",
      "mechanicA",
      "mechanicB",
      "mechanicC",
      "mechanicD"
    ],
    "cycleKeys": [
      "mythic",
      "friend",
      "second friend",
      "book_1",
      "book_2",
      "book_3",
      "book_4",
      "removal",
      "mana rock"
    ],
    "archetypes": [
      {
        "name": "White",
        "metadata": {
          "mainToken": "1/1 white Rabbit creature token",
          "mainCharacter": "Miffy, The Kind",
          "mechanicA": "lifelink",
          "mechanicD": "protection",
          "mechanicC": "exile",
          "mechanicB": "power 2 or less",
          "creatureTypeA": "Cat",
          "creatureTypeB": "Bird"
        },
        "cycles": {}
      },
      {
        "name": "Green",
        "metadata": {
          "mainToken": "4/4 green Rabbit creature token",
          "mainCharacter": "Miffy, The Brave",
          "mechanicA": "ward",
          "mechanicB": "power 4 or greater",
          "mechanicC": "+1/+1 counter",
          "mechanicD": "trample",
          "creatureTypeA": "Dog",
          "creatureTypeB": "Bear"
        },
        "cycles": {}
      },
      {
        "name": "Green/White",
        "metadata": {
          "mainToken": "2/2 green and white Rabbit creature token",
          "mainCharacter": "Miffy, The Curious",
          "mechanicA": "populate",
          "mechanicC": "+1/+1 counter",
          "mechanicB": "landfall",
          "mechanicD": "convoke",
          "creatureTypeA": "Rabbit",
          "creatureTypeB": "Human"
        },
        "cycles": {}
      }
    ]
  });

  return (<>
    <SetTable set={set} onSave={setSet} />
    <pre className='mt-4 p-2 bg-gray-100 text-xs rounded border border-gray-300 overflow-x-auto'>
      {JSON.stringify(set, null, 2)}
    </pre>
  </>);
}
