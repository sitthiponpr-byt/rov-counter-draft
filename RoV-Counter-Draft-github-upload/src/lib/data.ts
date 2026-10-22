import heroesJson from '../data/heroes.json';
import countersJson from '../data/counters.json';
import metaJson from '../data/meta.json';
import insightsJson from '../data/insights.json';
import type { CounterRow, Dataset, Hero, Insights, Meta } from './types';

export const dataset: Dataset = {
  heroes: heroesJson as Hero[],
  rows: countersJson as CounterRow[],
};
export const meta = metaJson as Meta;
export const insights = insightsJson as unknown as Insights;
