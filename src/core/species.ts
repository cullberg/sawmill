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

/**
 * Tangential / radial shrinkage ratio per species — the dimensionless
 * "cup factor" that drives how strongly a flat-sawn plank will cup
 * during drying. Tangential shrinkage (along annual rings) is always
 * larger than radial (perpendicular to rings); the ratio determines
 * how much *differential* shrinkage there is between the two faces of
 * a plank, which is what creates cup.
 *
 * A ratio of 1.0 would mean perfectly isotropic shrinkage and zero
 * cup risk; real species range from ~1.6 (pine, mild) to ~2.2+
 * (birch / aspen, severe). The values below are rule-of-thumb
 * midpoints for typical sawmill-grade trunks, used by the
 * `min-cup` strategy as a per-species cup-risk multiplier.
 *
 * Sources: standard wood-science handbooks (Forest Products
 * Laboratory) generalised to a single number per species. Not
 * research-grade; the strategy ranks layouts by *relative* cup
 * risk so absolute calibration doesn't need to be exact.
 */
export const TANGENTIAL_RADIAL_RATIO: Record<Species, number> = {
  // Conifers — pine and larch are the mildest, spruce / fir slightly
  // more anisotropic but still moderate.
  pine: 1.7,
  larch: 1.7,
  spruce: 1.9,
  fir: 1.8,
  // Hardwoods — birch and aspen cup hard, beech and alder are middling,
  // oak surprisingly mild for a dense hardwood.
  oak: 1.8,
  beech: 2.0,
  birch: 2.2,
  aspen: 2.2,
  alder: 1.9
};

/**
 * Cup factor for a given species. Wraps the table above so callers
 * have a typed accessor and a single chokepoint for any future
 * refinement (e.g. moisture-content-aware adjustment).
 */
export function cupFactorForSpecies(species: Species): number {
  return TANGENTIAL_RADIAL_RATIO[species];
}
