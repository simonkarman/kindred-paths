const exampleCard = {
  "set": { "symbol": "pmei", "shortName": "KPA" },
  "id": 43,
  "name": "Emry, Lurker of the Loch",
  "manaCost": {
    "colorless": 2,
    "blue": 1
  },
  "rarity": "rare",
  "supertype": "legendary",
  "types": [
    "creature"
  ],
  "subtypes": [
    "merfolk",
    "wizard"
  ],
  "rules": [
    {
      "variant": "ability",
      "content": "This spell costs {1} less to cast for each artifact you control."
    },
    {
      "variant": "ability",
      "content": "When ~ enters the battlefield, put the top four cards of your library into your graveyard."
    },
    {
      "variant": "ability",
      "content": "{t}: Choose target artifact card in your graveyard. You may cast that card this turn."
    },
    {
      "variant": "inline-reminder",
      "content": "You still pay its costs. Timing rules still apply."
    }
  ],
  "pt": {
    "power": 1,
    "toughness": 2
  },
  "art": { "image": "KPA-0004-from-skeleton.jpg", "author": "Simon karman" }
};

export default function Home() {
  return (
    <div className="p-2">
      <h1 className="font-bold">Kindred Paths</h1>
      <p>
        A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set
        by <a
          className="text-blue-800 underline"
          href="https://simonkarman.nl"
          target="_blank"
        >
          Simon Karman
        </a>.
      </p>
      <div className="flex flex-grow gap-2">
        <div className="p-2 grow-0">
          <div className="bg-gray-100 border border-gray-400 shadow rounded-xl aspect-[63/88] w-100" />
        </div>
        <div className="grow flex flex-col p-2 gap-2">
          <p>[ ] Card A .. | .... | ....</p>
          <p>[ ] Card B .. | .... | ....</p>
          <p>[ ] Card C .. | .... | ....</p>
          <p>[ ] Card D .. | .... | ....</p>
          <pre className="text-xs border bg-gray-800 text-white p-2 rounded-lg">
            {JSON.stringify(exampleCard, undefined, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
