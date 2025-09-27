import { getCards } from '@/utils/server';
import { SerializableSet } from 'kindred-paths';
import { SetEditor } from '@/components/set-editor/set-editor';

export default async function Page() {
  const set: SerializableSet = {
    "name": "MFY",
    "blueprint": {
      subtypes: [{
        key: 'string-array/allow',
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
          name: [{ key: 'string/contain-one-of', value: ['$[mainCharacter]'] }],
          rarity: [{ key: 'string/contain-one-of', value: ['mythic'] }],
          supertype: [{ key: 'string/contain-one-of', value: ['legendary'] }],
          types: [{ key: 'string-array/includes-all-of', value: ['creature'] }],
          subtypes: [{ key: 'string-array/includes-all-of', value: ['rabbit'] }],
          rules: [{ key: 'string/contain-all-of', value: ['$[mechanicB]', '$[mechanicC]'] }]
        },
      },
      {
        "key": "friend",
        blueprint: {},
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
            { key: 'string-array/includes-all-of', value: ['white'] },
            { key: 'string-array/length', value: { key: 'number/at-most', value: 1 }},
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
            }
          }
        }
      },
      {
        "name": "Green",
        blueprint: {
          color: [
            { key: 'string-array/includes-all-of', value: ['green'] },
            { key: 'string-array/length', value: { key: 'number/at-most', value: 1 }},
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
            }
          }
        }
      },
      {
        "name": "Green/White",
        blueprint: {
          color: [
            { key: 'string-array/includes-all-of', value: ['white', 'green'] },
            { key: 'string-array/length', value: { key: 'number/one-of', value: [0, 2] }},
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
            }
          },
          "friend": {
            "cardRef": {
              "cardId": "mfy-451-miffy-the-curious"
            }
          }
        }
      }
    ]
  };
  const cards = await getCards();

  return (<>
    <SetEditor cards={cards} set={set} />
    <pre className='hidden mt-4 p-2 bg-gray-100 text-xs rounded border border-gray-300 overflow-x-auto'>
      {JSON.stringify(set, null, 2)}
    </pre>
  </>);
}
