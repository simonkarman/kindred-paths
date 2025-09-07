export type Predicate<T> = (item: T) => boolean;

export type Requirement<T> = {
  name: string;
  predicate: Predicate<T>;
}

/**
 * Represents a match where an item is successfully matched to a requirement.
 */
type Succeeded = {
  requirement: string;
  status: 'succeeded';
  id: string;
};

/**
 * Represents a requirement that failed to match any item.
 */
type Failed = {
  requirement: string;
  status: 'failed';
};

/**
 * Represents an item that is valid to at least one requirement, but has not been selected for any of those requirements.
 * This indicates that this item was ambiguously not chosen, and could replace the card for any of the requirements it matched.
 */
type Ambiguous = {
  id: string;
  status: 'ambiguous';
  requirements: string[];
};

type Match = Succeeded | Failed | Ambiguous;

export class Group<T extends { id: string }> {
  constructor(
    public readonly name: string,
    public readonly requirements: Requirement<T>[],
  ) {
    // Validate no duplicate requirement names
    const requirementNames = new Set<string>();
    for (const requirement of requirements) {
      if (requirementNames.has(requirement.name)) {
        throw new Error(`group ${name} has a duplicate requirement ${requirement.name}`);
      }
      requirementNames.add(requirement.name);
    }
  }

  public matchTo(_set: T[]): Match[] {
    // Copy the set to avoid mutating the original
    const set: Readonly<T>[] = [..._set];
    const candidates = new Set<string>();

    // Keep track of open requirements
    let open: Readonly<Requirement<T>>[] = [...this.requirements];

    // While there are still requirements left in the open set, try to find matches
    const matches: Match[] = [];
    while (open.length > 0) {

      // Find all matches per requirement
      const matchesPerRequirement: Record<string, T[]> = {};
      for (const requirement of open) {
        matchesPerRequirement[requirement.name] = set.filter(item => {
          if (requirement.predicate(item)) {
            candidates.add(item.id);
            return true;
          }
          return false;
        });
      }

      // Find the requirement with the least matches
      const requirement = Object.entries(matchesPerRequirement)
        .reduce((acc, [name, { length: numberOfMatches }]) => {
          if (numberOfMatches < acc.numberOfMatches) {
            return { name, numberOfMatches };
          }
          return acc;
        }, { name: undefined as (string | undefined), numberOfMatches: Infinity }).name;
      if (requirement === undefined) {
        throw new Error('this should never happen');
      }

      // Remove the matched requirement from the open set
      open = open.filter(req => req.name !== requirement);

      // Find the item
      const item = matchesPerRequirement[requirement].pop();
      if (item === undefined) {
        // If there is no match, mark the requirement as failed
        matches.push({
          requirement,
          status: 'failed',
        });
        continue;
      }

      // Remove the matched item from the set and from allCandidates
      set.splice(set.indexOf(item), 1);
      candidates.delete(item.id);

      // Add the match to the results
      matches.push({
        requirement,
        status: 'succeeded',
        id: item.id,
      });
    }

    if (candidates.size > 0) {
      // If there are still candidates left, they are not part of the group, but could have ambiguously been chosen for the requirements
      //  they matched for.
      for (const candidateId of candidates) {
        matches.push({
          id: candidateId,
          status: 'ambiguous',
          requirements: this.requirements.filter(req => set.some(item => item.id === candidateId && req.predicate(item))).map(r => r.name),
        });
      }
    }

    return matches;
  }
}
