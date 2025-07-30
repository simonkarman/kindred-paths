"use client";

import { Card, kindredPathsGroups, SerializedCard } from 'kindred-paths';
import { useState } from 'react';

export const GroupOverview = (props: { cards: SerializedCard[] }) => {
  const [activeGroup, setActiveGroup] = useState<string | undefined>(undefined);
  const groupMatches = kindredPathsGroups.map(group => {
    return { group, matches: group.matchTo(props.cards.map(serializedCard => new Card(serializedCard))) };
  });

  return <div>
    <h2 className="font-bold text-lg mb-2">Groups</h2>
    <div className="flex gap-2 flex-wrap">
      {groupMatches.map(({ group, matches }) => {
        // Find the worst status in the group: succeeded, ambiguous, or failed
        const worstStatus = matches.reduce((worst, match) => {
          if (match.status === 'failed') return 'failed';
          if (match.status === 'ambiguous' && worst !== 'failed') return 'ambiguous';
          return worst;
        }, 'succeeded' as 'succeeded' | 'ambiguous' | 'failed');
        const isActiveGroup = activeGroup === group.name;

        const countPerStatus = matches.reduce((acc, match) => {
          acc[match.status] = (acc[match.status] || 0) + 1;
          return acc;
        }, {} as Record<'succeeded' | 'ambiguous' | 'failed', number | undefined>);

        const borderColor = worstStatus === 'succeeded' ? 'border-green-200' : worstStatus === 'ambiguous' ? 'border-yellow-200' : 'border-red-200';
        const textColor = worstStatus === 'succeeded' ? 'text-green-800' : worstStatus === 'ambiguous' ? 'text-yellow-800' : 'text-red-800';

        return <div
          key={group.name}
          className={`px-2 py-1 rounded-lg ${isActiveGroup ? 'border-4' : 'border'} ${borderColor}`}
        >
          <h2 className={`font-bold text-lg ${textColor}`}>{group.name}</h2>
          <p className={textColor}>Failed: {countPerStatus['failed'] ?? 0}</p>
          <p className={textColor}>Ambiguous: {countPerStatus['ambiguous'] ?? 0}</p>
          <p className={textColor}>Succeeded: {countPerStatus['succeeded'] ?? 0}</p>
          <button
            className="mt-1 px-2 py-1 rounded text-sm text-black border hover:bg-zinc-300"
            onClick={() => setActiveGroup(isActiveGroup ? undefined : group.name)}
          >
            {isActiveGroup ? 'Hide Details' : 'Show Details'}
          </button>
        </div>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
    {activeGroup && groupMatches.find(g => g.group.name === activeGroup)?.matches.map((match, index) => {
      const bg = match.status === 'succeeded' ? 'bg-green-50' : match.status === 'failed' ? 'bg-red-50' : 'bg-yellow-50';
      return <div key={index} className={`${bg} p-2 rounded border border-zinc-300 mb-2 text-sm`}>
        {match.status === 'succeeded' && <>
          <h3><span className="font-bold">found</span></h3>
          <p>{match.requirement}</p>
          <p>{match.id}</p>
        </>}
        {match.status === 'failed' && <>
          <h3><span className="font-bold">failed</span></h3>
          <p>{match.requirement}</p>
          <p>- missing -</p>
        </>}
        {match.status === 'ambiguous' && <>
          <h3><span className="font-bold">ambiguous</span></h3>
          <p>{match.id} could have ambiguously matched to {match.requirements.map(r => `"${r}"`).join(' or ')}</p>
        </>}
      </div>;
    })}
    </div>
  </div>;
}
