import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { aggregateStrategies, BucketConfig, SerializedCard, SerializedCardFace } from 'kindred-paths';
import { CardService } from '../service/card-service.js';
import { StrategyService } from '../service/strategy-service.js';
import { Research, ResearchService } from '../service/research-service.js';

// ---------------------------------------------------------------------------
// Hardcoded MV bucket config (same as the client)
// ---------------------------------------------------------------------------

const MV_BUCKET_CONFIG: BucketConfig = {
  buckets: [['mv:0', 'mv:1'], ['mv:2', 'mv:3'], ['mv:4', 'mv:5'], ['*']],
  toBucketName: (card: SerializedCard, faceIndex: number) => {
    const face = card.faces[faceIndex];
    const mv = Object.entries(face?.manaCost ?? {}).reduce(
      (sum, [type, amount]) => sum + (type === 'x' ? 0 : (amount ?? 0)),
      0,
    );
    return `mv:${mv}`;
  },
};

const MV_BUCKET_LABELS = ['MV 0–1', 'MV 2–3', 'MV 4–5', 'MV 6+'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatManaCost(face: SerializedCardFace): string {
  if (!face.manaCost || Object.keys(face.manaCost).length === 0) return '0';
  const mv = Object.entries(face.manaCost).reduce(
    (sum, [type, amount]) => sum + (type === 'x' ? 0 : (amount ?? 0)),
    0,
  );
  const parts: string[] = [];
  const order = ['generic', 'colorless', 'x', 'white', 'blue', 'black', 'red', 'green',
    'white/blue', 'blue/black', 'black/red', 'red/green', 'green/white',
    'white/black', 'blue/red', 'black/green', 'red/white', 'green/blue'];
  const abbrev: Record<string, string> = {
    generic: '', colorless: 'C', x: 'X',
    white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
    'white/blue': 'W/U', 'blue/black': 'U/B', 'black/red': 'B/R',
    'red/green': 'R/G', 'green/white': 'G/W', 'white/black': 'W/B',
    'blue/red': 'U/R', 'black/green': 'B/G', 'red/white': 'R/W', 'green/blue': 'G/U',
  };
  const manaCost = face.manaCost as Record<string, number> | undefined;
  for (const key of order) {
    const amt = manaCost?.[key];
    if (!amt) continue;
    if (key === 'generic') {
      parts.push(String(amt));
    } else {
      for (let i = 0; i < amt; i++) parts.push(abbrev[key] ?? key);
    }
  }
  return `MV ${mv} (${parts.join('')})`;
}

function formatTypeLine(face: SerializedCardFace): string {
  const parts: string[] = [];
  if (face.supertype) parts.push(face.supertype.charAt(0).toUpperCase() + face.supertype.slice(1));
  for (const t of face.types ?? []) parts.push(t.charAt(0).toUpperCase() + t.slice(1));
  if (face.subtypes && face.subtypes.length > 0) {
    parts.push('—');
    parts.push(...face.subtypes);
  }
  return parts.join(' ');
}

function renderSummaryTable(research: Research): string {
  const { strategyFilename, cardFilter, createdAt, bucketLabels, rows, totalCards, id } = research;

  // Column widths
  const nameCol = Math.max(20, ...rows.map(r => r.strategyName.length));
  const bucketCols = bucketLabels.map((label, i) =>
    Math.max(label.length, ...rows.map(r => String(r.buckets[i]?.total ?? 0).length)),
  );
  const totalColWidth = Math.max(5, ...rows.map(r => String(r.total).length));

  const pad = (s: string, w: number) => s.padEnd(w);
  const padL = (s: string, w: number) => s.padStart(w);

  const header = [
    pad('Strategy', nameCol),
    ...bucketLabels.map((l, i) => padL(l, bucketCols[i])),
    padL('Total', totalColWidth),
  ].join(' | ');

  const sep = '─'.repeat(header.length);

  const dataRows = rows.map(r => [
    pad(r.strategyName, nameCol),
    ...r.buckets.map((b, i) => padL(String(b.total), bucketCols[i])),
    padL(String(r.total), totalColWidth),
  ].join(' | '));

  const totals = [
    pad('TOTAL', nameCol),
    ...bucketLabels.map((_, i) => {
      const sum = rows.reduce((acc, r) => acc + (r.buckets[i]?.total ?? 0), 0);
      return padL(String(sum), bucketCols[i]);
    }),
    padL(String(rows.reduce((acc, r) => acc + r.total, 0)), totalColWidth),
  ].join(' | ');

  return [
    `Strategy file : ${research.rows[0] ? research.strategyFilename : strategyFilename}`,
    `Card filter   : ${cardFilter}  →  ${totalCards} cards matched`,
    `Run at        : ${createdAt}`,
    `Research ID   : ${id}`,
    '',
    header,
    sep,
    ...dataRows,
    sep,
    totals,
    '',
    'Use get_research_cell with the research ID, a strategy name, and a bucket name to explore individual cells.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerResearchTools(server: McpServer) {
  const cardService = new CardService();
  const strategyService = new StrategyService();
  const researchService = new ResearchService();

  server.registerTool(
    'run_strategy',
    {
      description:
        'Run a strategy file against a filtered subset of cards. ' +
        'Aggregates how many cards in each strategy fall into each mana value bucket. ' +
        'Saves the result as a research file and returns a summary table. ' +
        'Use get_research_cell with the returned research ID to drill into individual cells.',
      inputSchema: {
        filename: z.string().describe('The strategy filename without extension (e.g. "shx")'),
        cardFilter: z.string().describe('A card search filter string to select the card pool (e.g. "set:SHX")'),
      },
    },
    async ({ filename, cardFilter }) => {
      const config = await strategyService.get(filename);
      if (!config) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Strategy file "${filename}" not found.` }],
        };
      }

      const cards = await cardService.all(cardFilter);

      const aggregation = aggregateStrategies(cards, config.strategies, MV_BUCKET_CONFIG);

      const research: Research = {
        id: `${filename}-${Date.now()}`,
        strategyFilename: filename,
        cardFilter,
        createdAt: new Date().toISOString(),
        bucketLabels: MV_BUCKET_LABELS,
        rows: aggregation.rows.map(row => ({
          strategyName: row.strategy.name,
          ...(row.strategy.description ? { strategyDescription: row.strategy.description } : {}),
          buckets: row.buckets.map(cell => ({
            total: cell.total,
            refs: cell.refs,
          })),
          total: row.total,
        })),
        totalCards: cards.length,
      };

      await researchService.save(research);

      return {
        content: [{ type: 'text', text: renderSummaryTable(research) }],
      };
    },
  );

  server.registerTool(
    'get_research',
    {
      description:
        'Retrieve the summary table for a previously saved research result by its ID. ' +
        'Returns the same overview as run_strategy without re-running the aggregation.',
      inputSchema: {
        id: z.string().describe('The research ID returned by run_strategy (e.g. "shx-1714300000000")'),
      },
    },
    async ({ id }) => {
      const research = await researchService.get(id);
      if (!research) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Research "${id}" not found.` }],
        };
      }
      return {
        content: [{ type: 'text', text: renderSummaryTable(research) }],
      };
    },
  );

  server.registerTool(
    'get_research_cell',
    {
      description:
        'Get the individual cards in a specific cell of a research result. ' +
        'Returns each card\'s name, type line, mana cost, and which strategy filter(s) it matched. ' +
        'The bucket name must match one of the column headers shown in the research summary (e.g. "MV 2–3").',
      inputSchema: {
        id: z.string().describe('The research ID returned by run_strategy'),
        strategyName: z.string().describe('The strategy name exactly as shown in the summary table'),
        bucketName: z.string().describe('The bucket column name exactly as shown in the summary table (e.g. "MV 2–3")'),
      },
    },
    async ({ id, strategyName, bucketName }) => {
      const research = await researchService.get(id);
      if (!research) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Research "${id}" not found.` }],
        };
      }

      const row = research.rows.find(r => r.strategyName === strategyName);
      if (!row) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Strategy "${strategyName}" not found in research "${id}".` }],
        };
      }

      const bucketIndex = research.bucketLabels.indexOf(bucketName);
      if (bucketIndex === -1) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Bucket "${bucketName}" not found. Available buckets: ${research.bucketLabels.join(', ')}`,
          }],
        };
      }

      const bucket = row.buckets[bucketIndex];
      if (!bucket || bucket.refs.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `${strategyName}  ·  ${bucketName}  (0 cards)`,
          }],
        };
      }

      // Deduplicate by cid — a card can appear in multiple refs (one per face)
      const uniqueCids = [...new Set(bucket.refs.map(r => r.cid))];

      // Load cards in parallel
      const cards = await Promise.all(uniqueCids.map(cid => cardService.one(cid)));

      // Build matched-filter lookup: cid -> filter strings
      // We need the original strategy config to know which filters each card matched.
      // The refs store filterWeight which tells us the max weight matched, but not the
      // specific filter string. Reconstruct by re-checking filters from the research row.
      // Since we stored refs with filterWeight, and the strategy config is on disk,
      // load it to get filter strings — fall back to showing weight if unavailable.
      const strategyConfig = await strategyService.get(research.strategyFilename);
      const strategy = strategyConfig?.strategies.find(s => s.name === strategyName);

      const lines: string[] = [`${strategyName}  ·  ${bucketName}  (${uniqueCids.length} card${uniqueCids.length !== 1 ? 's' : ''})\n`];

      for (let i = 0; i < uniqueCids.length; i++) {
        const card = cards[i];
        if (!card) {
          lines.push(`${uniqueCids[i]}: (card not found)\n`);
          continue;
        }

        // Use primary face for display; if a secondary face ref exists, note it
        const faceIndices = [...new Set(bucket.refs.filter(r => r.cid === card.cid).map(r => r.faceIndex))];
        const displayFaceIndex = faceIndices[0] ?? 0;
        const face = card.faces[displayFaceIndex];
        const faceName = face?.name ?? card.cid;

        const typeLine = face ? formatTypeLine(face) : '';
        const manaCost = face ? formatManaCost(face) : '';

        // Determine which filters matched this card
        let matchedFilters = '(unknown)';
        if (strategy) {
          const { filterCardsBasedOnSearch } = await import('kindred-paths');
          const matched = strategy.filters.filter(f => {
            const query = typeof f === 'string' ? f : f.query;
            return filterCardsBasedOnSearch([card], query).length > 0;
          }).map(f => typeof f === 'string' ? f : `${f.query} (weight: ${f.weight})`);
          matchedFilters = matched.length > 0 ? matched.join(', ') : '(none)';
        }

        lines.push([
          `${faceName} (${card.cid})`,
          `  ${typeLine} — ${manaCost}`,
          `  Matched: ${matchedFilters}`,
        ].join('\n'));
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );
}
