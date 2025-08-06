import { getArtSettingSuggestions, SettingSuggestion, getArtSuggestions, ArtSuggestion } from '@/utils/server';
import { Card } from 'kindred-paths';
import { AiSuggestionsInput } from '@/components/editor/ai-suggestions-input';

export const CardArtInput = (props: {
  artSetting: string | undefined,
  setArtSetting: (value: string | undefined) => void,
  art: string | undefined,
  setArt: (value: string | undefined) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
  isChanged: boolean,
  revert: () => void,
  artSettingIsChanged: boolean,
  revertArtSetting: () => void,
}) => {
  return <div className="space-y-2">
    <AiSuggestionsInput
      propertyName={"Art Setting"}
      propertyValue={props.artSetting}
      setPropertyValue={props.setArtSetting}
      getPropertyErrorMessage={() => undefined}
      card={props.card}
      selectSuggestion={(suggestion: SettingSuggestion) => props.setArtSetting(suggestion.setting)}
      getServerSuggestions={getArtSettingSuggestions}
      maxHeight={'max-h-80'}
      renderSuggestion={(suggestion: SettingSuggestion) => (<>
        <div className="text-xs text-zinc-600 mb-1">
          {suggestion.name}
        </div>
        <div className="text-zinc-800">
          {suggestion.setting}
        </div>
      </>)}
      isChanged={props.artSettingIsChanged}
      revert={props.revertArtSetting}
    />
    <AiSuggestionsInput
      propertyName={"Art File Name"}
      propertyValue={props.art}
      setPropertyValue={props.setArt}
      getPropertyErrorMessage={props.getErrorMessage}
      card={props.card}
      selectSuggestion={(suggestion: ArtSuggestion) => props.setArt(suggestion.fileName)}
      getServerSuggestions={getArtSuggestions}
      maxHeight={'max-h-200'}
      renderSuggestion={(suggestion: ArtSuggestion) => (
        <img className="w-full h-auto" alt={suggestion.fileName} src={'data:image/png;base64, ' + suggestion.base64Image} />
      )}
      suggestionsAsGrid={true}
      isChanged={props.isChanged}
      revert={props.revert}
    />
  </div>
}
