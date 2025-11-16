import { ArtSuggestion, getArtSettingSuggestions, getArtSuggestions, SettingSuggestion } from '@/utils/server';
import { Card, CardArtPromptCreator } from 'kindred-paths';
import { AiSuggestionsInput } from '@/components/editor/ai-suggestions-input';
import { InputHeader } from '@/components/editor/input-header';

export const CardArtInput = (props: {
  artSetting: string | undefined,
  setArtSetting: (value: string | undefined) => void,
  showArtFocus: boolean,
  artFocus: string | undefined,
  setArtFocus: (value: string | undefined) => void,
  art: string | undefined,
  setArt: (value: string | undefined) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
  faceIndex: number,
  isChanged: boolean,
  revert: () => void,
  artSettingIsChanged: boolean,
  revertArtSetting: () => void,
  artFocusIsChanged: boolean,
  revertArtFocus: () => void,
}) => {
  return <div className="space-y-2">
    <AiSuggestionsInput
      propertyName="Art Setting"
      propertyValue={props.artSetting}
      setPropertyValue={props.setArtSetting}
      getPropertyErrorMessage={() => undefined}
      card={props.card}
      faceIndex={props.faceIndex}
      selectSuggestion={(suggestion: SettingSuggestion) => props.setArtSetting(suggestion.setting)}
      getServerSuggestions={(c) => getArtSettingSuggestions(c, props.faceIndex)}
      maxHeight={'max-h-80'}
      renderSuggestion={(suggestion: SettingSuggestion) => (<>
        <div className="text-xs text-zinc-600 mb-1">
          {suggestion.name}
        </div>
        <div className="text-zinc-800">
          {suggestion.setting}
        </div>
      </>)}
      rows={3}
      isChanged={props.artSettingIsChanged}
      revert={props.revertArtSetting}
    />
    <AiSuggestionsInput
      propertyName="Art File Name"
      propertyValue={props.art}
      setPropertyValue={props.setArt}
      getPropertyErrorMessage={props.getErrorMessage}
      card={props.card}
      faceIndex={props.faceIndex}
      selectSuggestion={(suggestion: ArtSuggestion) => props.setArt(suggestion.fileName)}
      getServerSuggestions={(c) => getArtSuggestions(c, props.faceIndex)}
      maxHeight={'max-h-200'}
      renderSuggestion={(suggestion: ArtSuggestion) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="w-full h-auto" alt={suggestion.fileName} src={'data:image/png;base64, ' + suggestion.base64Image} />
      )}
      suggestionsAsGrid={true}
      isChanged={props.isChanged}
      revert={props.revert}
    />
    <p className="text-zinc-600 text-xs">
      Prompt: {props.card && new CardArtPromptCreator().createPrompt(props.card.faces[props.faceIndex])}
    </p>
    {props.showArtFocus && <>
      <InputHeader propertyName="Full Art Focus" isChanged={props.artFocusIsChanged} revert={props.revertArtFocus} />
      <div className="flex flex-wrap gap-1">
        {["zoom-0", "zoom-1", "zoom-2"].map((artFocus) => (
          <button
            key={`${artFocus}`}
            type="button"
            onClick={() => props.setArtFocus(artFocus)}
            className={`px-2 py-0.5 text-xs rounded border font-mono transition-colors ${
              (props.artFocus === artFocus || (!props.artFocus && artFocus === 'zoom-0'))
                ? 'bg-blue-100 border-blue-300 text-blue-800'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {artFocus}
          </button>
        ))}
      </div>
    </>}
  </div>
}
