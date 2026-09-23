/**
 * Property specs for `database create -p` and `database update --add-prop`.
 *
 *   Name:type                         any type with an empty config (date, people, url, ...)
 *   Name:select=A|B|C                 select / multi_select / status with named options
 *   Name:relation=<database_id>       one-way relation to another database
 *   Name:relation=<database_id>,dual  two-way relation; the other side gets a default name
 *   Name:relation=<database_id>,dual=Issues
 *                                     two-way relation; the other side is named "Issues"
 *
 * The name is everything before the FIRST colon, so a name cannot contain one; a value may.
 *
 * Relations point at a data source, not a database (API 2025-09-03+). The caller passes a
 * database id, the way every other command takes one, and the resolver finds its data source.
 */

import type { NotionClient } from '../client.js';
import { resolveDatabase } from './database-resolver.js';

const OPTION_TYPES = new Set(['select', 'multi_select', 'status']);

export interface ParsedPropertySpec {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export async function parsePropertySpec(client: NotionClient, spec: string): Promise<ParsedPropertySpec> {
  const colon = spec.indexOf(':');
  if (colon <= 0 || colon === spec.length - 1) {
    throw new Error(`Invalid property spec "${spec}". Expected Name:type or Name:type=value.`);
  }

  const name = spec.slice(0, colon).trim();
  const rest = spec.slice(colon + 1);
  const eq = rest.indexOf('=');
  const type = (eq === -1 ? rest : rest.slice(0, eq)).trim();
  const value = eq === -1 ? undefined : rest.slice(eq + 1);

  if (type === 'relation') {
    return { name, type, config: { relation: await relationConfig(client, spec, value) } };
  }

  if (value !== undefined && OPTION_TYPES.has(type)) {
    const options = value.split('|').map(o => o.trim()).filter(Boolean).map(o => ({ name: o }));
    return { name, type, config: { [type]: { options } } };
  }

  if (value !== undefined) {
    throw new Error(`Property type "${type}" takes no value (in "${spec}").`);
  }

  return { name, type, config: { [type]: {} } };
}

async function relationConfig(client: NotionClient, spec: string, value?: string): Promise<Record<string, unknown>> {
  if (!value) {
    throw new Error(`Relation needs a target database: "${spec}" should be Name:relation=<database_id>.`);
  }

  const [target, ...flags] = value.split(',').map(s => s.trim());
  const resolved = await resolveDatabase(client, target);

  const dual = flags.find(f => f === 'dual' || f.startsWith('dual='));
  const unknown = flags.filter(f => f !== dual);
  if (unknown.length > 0) {
    throw new Error(`Unknown relation option(s) ${unknown.join(', ')} in "${spec}". Only dual or dual=<name>.`);
  }

  if (!dual) {
    return { data_source_id: resolved.dataSourceId, type: 'single_property', single_property: {} };
  }

  const syncedName = dual.startsWith('dual=') ? dual.slice('dual='.length).trim() : '';
  return {
    data_source_id: resolved.dataSourceId,
    type: 'dual_property',
    dual_property: syncedName ? { synced_property_name: syncedName } : {},
  };
}

/** Parse several specs into a properties object, in order. */
export async function parsePropertySpecs(
  client: NotionClient,
  specs: string[],
): Promise<{ properties: Record<string, unknown>; parsed: ParsedPropertySpec[] }> {
  const properties: Record<string, unknown> = {};
  const parsed: ParsedPropertySpec[] = [];
  for (const spec of specs) {
    const p = await parsePropertySpec(client, spec);
    properties[p.name] = p.config;
    parsed.push(p);
  }
  return { properties, parsed };
}
