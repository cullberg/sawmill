import type { Species } from './types';

/**
 * Default bark thickness (mm) per species for typical sawmill-grade
 * logs. These are sensible midpoints — pine and oak carry the
 * thickest bark, then larch / spruce / fir, then the smooth-barked
 * hardwoods (birch, beech, aspen, alder). Sawyers can still override
 * the value after picking a species; the species default is applied
 * automatically whenever the species selector changes so a fresh log
 * starts from a realistic value rather than the previous log's
 * possibly-customised one.
 *
 * Sources: rule-of-thumb numbers commonly used by Nordic / European
 * cant sawyers; not species-research-grade. The point is that picking
 * "oak" defaults thicker than picking "birch", not that any of these
 * numbers is exact for every individual tree. Numbers reference a
 * mature, sawmill-grade trunk (~30-50 cm Ø).
 */
export const BARK_THICKNESS_BY_SPECIES: Record<Species, number> = {
  // Conifers — bark generally scales pine > larch > spruce > fir.
  pine: 12,
  larch: 14,
  spruce: 8,
  fir: 6,
  // Hardwoods — most are smooth-barked; oak is the rough outlier.
  oak: 15,
  beech: 4,
  birch: 6,
  aspen: 5,
  alder: 5
};

/**
 * Bark thickness default (mm) for the given species. Wraps the table
 * above so callers don't have to import the constant directly and the
 * type checker enforces the species enum at the call site.
 */
export function barkThicknessForSpecies(species: Species): number {
  return BARK_THICKNESS_BY_SPECIES[species];
}
