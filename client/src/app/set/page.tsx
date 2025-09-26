import { SetTable } from '@/app/set/set-table';
import { SerializableSet } from '@/app/set/types';
import { getCards } from '@/utils/server';

export default async function Page() {
  const set: SerializableSet = {
    "name": "MFY",
    "blueprint": {
      subtypes: [{
        key: 'string-array/must-only-use-from',
        value: ['rabbit', 'bird', 'cat', 'dog', 'pig', 'human', 'advisor', 'druid', 'scout'],
      }],
    },
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
          name: [{ key: 'string/must-include-one-of', value: ['$[mainCharacter]'] }],
          rarity: [{ key: 'string/must-include-one-of', value: ['mythic'] }],
          supertype: [{ key: 'string/must-include-one-of', value: ['legendary'] }],
          types: [{ key: 'string-array/must-include-all-of', value: ['creature'] }],
          subtypes: [{ key: 'string-array/must-include-all-of', value: ['rabbit'] }],
          rules: [{ key: 'string/must-include-all-of', value: ['$[mechanicB]', '$[mechanicC]'] }]
        },
      },
      {
        "key": "friend"
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
        blueprint: {
          color: [
            { key: 'string-array/must-include-all-of', value: ['white'] },
            { key: 'string-array/must-have-length', value: { key: 'number/must-be-at-most', value: 1 }},
          ],
        },
        "metadata": {
          "mainCharacter": "Miffy, The Kind",
          "mainToken": "1/1 white Rabbit creature token",
          "mechanicA": "lifelink",
          "mechanicB": "power 2 or less",
          "mechanicC": "exile",
          "mechanicD": "protection",
          "creatureTypeA": "Cat",
          "creatureTypeB": "Bird"
        },
        "cycles": {
          "mythic": {
            "cardRef": {
              "cardId": "mfy-401-miffy-the-kind"
            },
            "count": 1
          }
        }
      },
      {
        "name": "Green",
        blueprint: {
          color: [
            { key: 'string-array/must-include-all-of', value: ['green'] },
            { key: 'string-array/must-have-length', value: { key: 'number/must-be-at-most', value: 1 }},
          ],
        },
        "metadata": {
          "mainToken": "4/4 green Rabbit creature token",
          "mainCharacter": "Miffy, The Brave",
          "mechanicA": "+1/+1 counter",
          "mechanicB": "power 4 or greater",
          "mechanicC": "ward",
          "mechanicD": "trample",
          "creatureTypeA": "Dog",
          "creatureTypeB": "Bear"
        },
        "cycles": {
          "mythic": {
            "cardRef": {
              "cardId": "mfy-426-miffy-the-brave"
            },
            "count": 1
          }
        }
      },
      {
        "name": "Green/White",
        blueprint: {
          color: [
            { key: 'string-array/must-include-all-of', value: ['white', 'green'] },
            { key: 'string-array/must-have-length', value: { key: 'number/must-be-one-of', value: [0, 2] }},
          ],
        },
        "metadata": {
          "mainToken": "2/2 green and white Rabbit creature token",
          "mainCharacter": "Miffy, The Curious",
          "mechanicA": "+1/+1 counter",
          "mechanicB": "populate",
          "mechanicC": "convoke",
          "mechanicD": "landfall",
          "creatureTypeA": "Rabbit",
          "creatureTypeB": "Human"
        },
        "cycles": {
          "mythic": {
            "cardRef": {
              "cardId": "mfy-451-miffy-the-curious"
            },
            "count": 1
          }
        }
      }
    ]
  };
  const cards = await getCards();

  return (<>
    <SetTable cards={cards} set={set} />
    <pre className='hidden mt-4 p-2 bg-gray-100 text-xs rounded border border-gray-300 overflow-x-auto'>
      {JSON.stringify(set, null, 2)}
    </pre>
  </>);
}
