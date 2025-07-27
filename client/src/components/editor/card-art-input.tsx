import { getArtSuggestions } from '@/utils/server';
import { Card } from 'kindred-paths';

export const CardArtInput = (props: {
  art: string | undefined,
  setArt: (value: string | undefined) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cartArt" className="block font-medium text-gray-800">
      Card Art
    </label>
    <input
      id="cardArt"
      type="text"
      value={props.art}
      onChange={(e) => e.target.value.length === 0 ? props.setArt(undefined) : props.setArt(e.target.value)}
      placeholder="Enter card art..."
      className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
    <div className="flex justify-end">
      <button
        className="py-1 px-4 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => props.card ? getArtSuggestions(props.card).then(console.info) : undefined}
      >
        Suggest Card Art
      </button>
    </div>
  </div>;
}
