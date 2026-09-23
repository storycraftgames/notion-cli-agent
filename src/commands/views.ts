/**
 * Views commands - create, list, get, delete database views (API 2025-09-03+)
 *
 * The headline use is a LINKED view: a filtered table of an existing database placed inside
 * another page (`view create --page`), e.g. a release page showing only that release's issues
 * from a shared Issues database. Without --page the view is added as a new tab on the database.
 */
import { Command } from 'commander';
import { getClient } from '../client.js';
import { formatOutput, parseFilter } from '../utils/format.js';
import { resolveDatabase } from '../utils/database-resolver.js';
import { withErrorHandler } from '../utils/command-handler.js';

const VIEW_TYPES = ['table', 'board', 'list', 'calendar', 'timeline', 'gallery', 'form', 'chart', 'map', 'dashboard'];

interface View {
  id: string;
  name?: string;
  type?: string;
  url?: string;
  data_source_id?: string;
  parent?: Record<string, unknown>;
  filter?: unknown;
}

const collect = (v: string, a: string[]) => [...a, v];

export function registerViewsCommand(program: Command): void {
  const views = program
    .command('view')
    .alias('views')
    .description('Manage database views, including linked views on other pages');

  views
    .command('create')
    .description('Create a view of a database: on another page (--page, a linked view) or as a new tab on the database')
    .requiredOption('-d, --database <database_id>', 'Database whose data the view shows')
    .option('--data-source-id <id>', 'Data source to show, when the database has more than one')
    .option('--page <page_id>', 'Place the view on this page as a linked database (otherwise: a new tab on the database)')
    .option('--after <block_id>', 'With --page: insert after this block (a direct child of the page); default is the end')
    .option('-n, --name <name>', 'View name', 'Table')
    .option('--type <type>', `View type: ${VIEW_TYPES.join(', ')}`, 'table')
    .option('-f, --filter <json>', 'Filter as JSON string (same shape as db query)')
    .option('--filter-prop <property>', 'Property to filter on (repeatable)', collect, [] as string[])
    .option('--filter-type <type>', 'Filter operator: equals, contains, ... (repeatable)', collect, [] as string[])
    .option('--filter-value <value>', 'Filter value (repeatable)', collect, [] as string[])
    .option('--filter-prop-type <propType>', 'Property type: relation, select, status, text, ... (repeatable)', collect, [] as string[])
    .option('--relation <prop=page_id>', 'Shortcut: show rows whose relation <prop> contains <page_id>', collect, [] as string[])
    .option('-j, --json', 'Output raw JSON')
    .action(withErrorHandler(async (options) => {
      if (!VIEW_TYPES.includes(options.type)) {
        console.error(`Error: --type must be one of ${VIEW_TYPES.join(', ')}`);
        process.exit(1);
      }
      if (options.after && !options.page) {
        console.error('Error: --after only applies with --page');
        process.exit(1);
      }

      const client = getClient();
      const resolved = await resolveDatabase(client, options.database, options.dataSourceId);

      const body: Record<string, unknown> = {
        data_source_id: resolved.dataSourceId,
        name: options.name,
        type: options.type,
      };

      if (options.page) {
        const createDatabase: Record<string, unknown> = {
          parent: { type: 'page_id', page_id: options.page },
        };
        if (options.after) createDatabase.position = { type: 'after_block', block_id: options.after };
        body.create_database = createDatabase;
      } else {
        body.database_id = options.database;
      }

      const filter = buildFilter(options);
      if (filter) body.filter = filter;

      const view = await client.post<View>('views', body);

      if (options.json) {
        console.log(formatOutput(view));
      } else {
        console.log(options.page ? '✅ Linked view created' : '✅ View created');
        console.log('ID:', view.id);
        if (view.url) console.log('URL:', view.url);
      }
    }));

  views
    .command('list')
    .description('List views of a database, or every view (linked ones included) of a data source')
    .option('-d, --database <database_id>', 'Views belonging to this database block')
    .option('--data-source-id <id>', 'Every view that shows this data source, across the workspace')
    .option('--llm', 'Compact LLM-friendly output')
    .option('-j, --json', 'Output raw JSON')
    .action(withErrorHandler(async (options) => {
      if (!options.database === !options.dataSourceId) {
        console.error('Error: give exactly one of --database or --data-source-id');
        process.exit(1);
      }

      const client = getClient();
      const query = options.database ? { database_id: options.database } : { data_source_id: options.dataSourceId };
      const result = await client.get<{ results: View[] }>('views', query);

      if (options.json) {
        console.log(formatOutput(result));
        return;
      }
      // The list endpoint returns view references (often just the id); `view get` has the rest.
      for (const view of result.results ?? []) {
        const label = [view.type, view.name].filter(Boolean).join(' ');
        console.log(options.llm ? `${view.id} ${label}`.trim() : `📋 ${view.id}${label ? `  ${label}` : ''}`);
      }
    }));

  views
    .command('get <view_id>')
    .description('Retrieve a view (name, type, filter, sorts)')
    .option('-j, --json', 'Output raw JSON')
    .action(withErrorHandler(async (viewId: string, options) => {
      const client = getClient();
      const view = await client.get<View>(`views/${viewId}`);

      if (options.json) {
        console.log(formatOutput(view));
        return;
      }
      console.log('View:', view.name ?? 'Untitled');
      console.log('ID:', view.id);
      console.log('Type:', view.type);
      console.log('Data source:', view.data_source_id);
      if (view.filter) console.log('Filter:', JSON.stringify(view.filter));
      if (view.url) console.log('URL:', view.url);
    }));

  views
    .command('delete <view_id>')
    .description('Delete a view')
    .action(withErrorHandler(async (viewId: string) => {
      const client = getClient();
      await client.delete(`views/${viewId}`);
      console.log('✅ View deleted');
    }));
}

function buildFilter(options: {
  filter?: string;
  filterProp: string[];
  filterType: string[];
  filterValue: string[];
  filterPropType: string[];
  relation: string[];
}): Record<string, unknown> | undefined {
  if (options.filter) return JSON.parse(options.filter);

  const filters: Record<string, unknown>[] = [];

  for (const r of options.relation) {
    const eq = r.lastIndexOf('=');
    if (eq <= 0 || eq === r.length - 1) {
      console.error(`Error: --relation expects <prop>=<page_id>, got "${r}"`);
      process.exit(1);
    }
    filters.push(parseFilter(r.slice(0, eq), 'contains', r.slice(eq + 1), 'relation'));
  }

  const { filterProp: props, filterType: types, filterValue: values, filterPropType: propTypes } = options;
  if (props.length !== types.length || props.length !== values.length) {
    console.error('Error: --filter-prop, --filter-type, and --filter-value must be provided the same number of times');
    process.exit(1);
  }
  if (propTypes.length !== 0 && propTypes.length !== props.length) {
    console.error('Error: --filter-prop-type must be provided either for all filter groups or for none');
    process.exit(1);
  }
  props.forEach((prop, i) => filters.push(parseFilter(prop, types[i], values[i], propTypes[i])));

  if (filters.length === 0) return undefined;
  return filters.length > 1 ? { and: filters } : filters[0];
}
