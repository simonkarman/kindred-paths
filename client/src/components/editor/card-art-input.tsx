import { getArtSuggestions, getArtSettingSuggestions, SettingSuggestion, ArtSuggestion } from '@/utils/server';
import { Card } from 'kindred-paths';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

export const CardArtInput = (props: {
  artSetting: string | undefined,
  setArtSetting: (value: string | undefined) => void,
  art: string | undefined,
  setArt: (value: string | undefined) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
}) => {
  const [settingSuggestions, setSettingSuggestions] = useState<SettingSuggestion[]>([]);
  const [isSettingLoading, setIsSettingLoading] = useState(false);
  const [showSettingSuggestions, setShowSettingSuggestions] = useState(false);
  const fetchSettingSuggestions = async () => {
    if (settingSuggestions.length > 0) {
      // If suggestions are already fetched, just toggle visibility
      setShowSettingSuggestions(!showSettingSuggestions);
      return;
    }
    setIsSettingLoading(true);
    try {
      setSettingSuggestions(await getArtSettingSuggestions(props.card!));
      setShowSettingSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsSettingLoading(false);
    }
  };
  const selectSettingSuggestion = (suggestion: SettingSuggestion) => {
    props.setArtSetting(suggestion.setting);
    setShowSettingSuggestions(false);
  };

  const [artSuggestions, setArtSuggestions] = useState<ArtSuggestion[]>([]);
  const [isArtLoading, setIsArtLoading] = useState(false);
  const [showArtSuggestions, setShowArtSuggestions] = useState(false);
  const fetchArtSuggestions = async () => {
    if (artSuggestions.length > 0) {
      // If suggestions are already fetched, just toggle visibility
      setShowArtSuggestions(!showArtSuggestions);
      return;
    }
    setIsArtLoading(true);
    try {
      setArtSuggestions(await getArtSuggestions(props.card!));
      setShowArtSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsArtLoading(false);
    }
  };
  const selectArtSuggestion = (suggestion: ArtSuggestion) => {
    props.setArt(suggestion.fileName);
    setShowArtSuggestions(false);
  };

  return <div className="space-y-1 border border-zinc-200 p-2 rounded-lg bg-zinc-100">
    <div>
      <label htmlFor="cardArtSetting" className="block font-medium text-zinc-800">
        Card Art Setting
      </label>
      <div className="relative">
        <input
          id="cardArtSetting"
          type="text"
          value={props.artSetting}
          onChange={(e) => e.target.value.length === 0 ? props.setArtSetting(undefined) : props.setArtSetting(e.target.value)}
          placeholder="Enter card art setting..."
          className="w-full bg-white px-1 py-0.5 pr-10 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {props.card &&
          <button
            type="button"
            onClick={fetchSettingSuggestions}
            disabled={isSettingLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Get AI art-setting suggestions"
          >
            <FontAwesomeIcon
              icon={isSettingLoading ? faSpinner : faWandMagicSparkles}
              className={isSettingLoading ? "animate-spin" : ""}
            />
          </button>
        }
      </div>

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}

      {/* Suggestions Modal/Dropdown */}
      {showSettingSuggestions && settingSuggestions.length > 0 && (
        <div className="absolute top-full w-160 z-50 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-zinc-800">AI Art Setting Suggestions</h3>
              <button
                onClick={() => setShowSettingSuggestions(false)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ×
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {settingSuggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => selectSettingSuggestion(suggestion)}
                className="p-3 border-b border-zinc-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="font-medium text-zinc-800 mb-1">
                  {suggestion.name}
                </div>
                <div className="text-xs text-zinc-600">
                  {suggestion.setting}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close suggestions when clicking outside */}
      {showSettingSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettingSuggestions(false)}
        />
      )}
    </div>
    <div>
      <label htmlFor="cardArt" className="block font-medium text-zinc-800">
        Card Art File Name
      </label>
      <div className="relative">
        <input
          id="cardArt"
          type="text"
          value={props.art}
          onChange={(e) => e.target.value.length === 0 ? props.setArt(undefined) : props.setArt(e.target.value)}
          placeholder="Enter card art file name..."
          className="w-full bg-white px-1 py-0.5 pr-10 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {props.card &&
          <button
            type="button"
            onClick={fetchArtSuggestions}
            disabled={isArtLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Get ImageGen AI art suggestions"
          >
            <FontAwesomeIcon
              icon={isArtLoading ? faSpinner : faWandMagicSparkles}
              className={isArtLoading ? "animate-spin" : ""}
            />
          </button>
        }
      </div>

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}

      {/* Suggestions Modal/Dropdown */}
      {showArtSuggestions && artSuggestions.length > 0 && (
        <div className="absolute top-full w-160 z-50 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg max-h-200 overflow-y-auto">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-zinc-800">AI Art Suggestions</h3>
              <button
                onClick={() => setShowArtSuggestions(false)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ×
              </button>
            </div>
          </div>
          <div className="max-h-200 overflow-y-auto grid grid-cols-2">
            {artSuggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => selectArtSuggestion(suggestion)}
                className="p-3 border-b border-zinc-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <img className="" alt={suggestion.fileName} src={'data:image/png;base64, ' + suggestion.base64Image} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close suggestions when clicking outside */}
      {showArtSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowArtSuggestions(false)}
        />
      )}
    </div>
  </div>;
}
