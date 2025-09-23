'use client';

import { SetTable } from '@/app/set/set-table';
import { SerializableSet } from '@/app/set/types';
import { useState } from 'react';

export default function Page() {
  const [set, setSet] = useState<SerializableSet>({
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
    "cycles": [
      {
        "key": "mythic",
        "blueprint": {
          "id": "example-a"
        }
      },
      {
        "key": "friend",
        "blueprint": {
          "id": "example-b"
        }
      },
      {
        "key": "second friend"
      },
      {
        "key": "book_1"
      },
      {
        "key": "book_2"
      },
      {
        "key": "book_3"
      },
      {
        "key": "removal"
      },
      {
        "key": "mana rock"
      },
      {
        "key": "land"
      }
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
        "cycles": {
          "mythic": {
            "cardRef": {
              "id": "example-card-e"
            }
          }
        }
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
        "cycles": {
          "mythic": {
            "cardRef": {
              "id": "example-card-b"
            }
          },
          "friend": {
            "cardRef": {
              "id": "example-card-d"
            }
          }
        }
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
        "cycles": {
          "mythic": {
            "cardRef": {
              "id": "example-card-a"
            }
          },
          "friend": {
            "cardRef": {
              "id": "example-card-c"
            }
          }
        }
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
