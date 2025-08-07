import { Card } from 'kindred-paths';
import { getNameSuggestions, NameSuggestion } from '@/utils/server';
import { AiSuggestionsInput } from '@/components/editor/ai-suggestions-input';

export const CardNameInput = (props: {
  name: string,
  setName: (value: string) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <AiSuggestionsInput
    propertyName={"Name"}
    propertyValue={props.name}
    setPropertyValue={(v) => props.setName(v ?? '')}
    getPropertyErrorMessage={props.getErrorMessage}
    card={props.card}
    selectSuggestion={(suggestion: NameSuggestion) => props.setName(suggestion.name)}
    getServerSuggestions={getNameSuggestions}
    maxHeight={'max-h-80'}
    renderSuggestion={(suggestion: NameSuggestion) => (<>
      <div className="font-medium text-zinc-800 mb-1">
        {suggestion.name}
      </div>
      <div className="text-xs text-zinc-600">
        {suggestion.reason}
      </div>
    </>)}
    isChanged={props.isChanged}
    revert={props.revert}
  />
};
