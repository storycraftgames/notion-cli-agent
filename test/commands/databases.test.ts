import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { mockDatabase, mockPage, createPaginatedResult, setupDatabaseResolution } from '../fixtures/notion-data';

describe('Databases Command', () => {
  let program: Command;
  let mockClient: any;

  beforeEach(async () => {
    vi.resetModules();

    // Create mock client
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    // Mock the client module
    vi.doMock('../../src/client', () => ({
      getClient: () => mockClient,
      initClient: vi.fn(),
    }));

    // Import command and register it
    const { registerDatabasesCommand } = await import('../../src/commands/databases');
    program = new Command();
    registerDatabasesCommand(program);
  });

  describe('database get', () => {
    it('should get database by ID', async () => {
      setupDatabaseResolution(mockClient);

      await program.parseAsync(['node', 'test', 'database', 'get', 'db-123']);

      expect(mockClient.get).toHaveBeenCalledWith('databases/db-123');
      expect(mockClient.get).toHaveBeenCalledWith('data_sources/ds-456');
      expect(console.log).toHaveBeenCalledWith('Database:', 'Test Database');
      expect(console.log).toHaveBeenCalledWith('ID:', 'ds-456');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Properties:'));
    });

    it('should output JSON when --json flag is used', async () => {
      setupDatabaseResolution(mockClient);

      await program.parseAsync(['node', 'test', 'database', 'get', 'db-123', '--json']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"object": "database"'));
    });
  });

  describe('database query', () => {
    it('should query database without filters', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync(['node', 'test', 'database', 'query', 'db-123']);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        page_size: 100,
      });
    });

    it('should query with JSON filter', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      const filter = JSON.stringify({ property: 'Status', status: { equals: 'Done' } });
      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter', filter,
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: { property: 'Status', status: { equals: 'Done' } },
        page_size: 100,
      });
    });

    it('should query with simple filter options', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter-prop', 'Status',
        '--filter-type', 'equals',
        '--filter-value', 'Done',
        '--filter-prop-type', 'status',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: {
          property: 'Status',
          status: { equals: 'Done' },
        },
        page_size: 100,
      });
    });

    it('should query with sorting (descending)', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--sort', 'Created',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        sorts: [{
          property: 'Created',
          direction: 'descending',
        }],
        page_size: 100,
      });
    });

    it('should query with sorting (ascending)', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--sort', 'Priority',
        '--sort-dir', 'asc',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        sorts: [{
          property: 'Priority',
          direction: 'ascending',
        }],
        page_size: 100,
      });
    });

    it('should query with limit', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--limit', '50',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        page_size: 50,
      });
    });

    it('should query with cursor', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--cursor', 'cursor-123',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        page_size: 100,
        start_cursor: 'cursor-123',
      });
    });

    it('should show pagination hint when has_more is true', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage], 'next-cursor-123', true);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync(['node', 'test', 'database', 'query', 'db-123']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('More results available. Use --cursor next-cursor-123')
      );
    });

    it('should output JSON when --json flag is used', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync(['node', 'test', 'database', 'query', 'db-123', '--json']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"object": "list"'));
    });

    it('should combine filter, sort, and pagination', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter-prop', 'Status',
        '--filter-type', 'equals',
        '--filter-value', 'In Progress',
        '--filter-prop-type', 'status',
        '--sort', 'Priority',
        '--sort-dir', 'asc',
        '--limit', '25',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: {
          property: 'Status',
          status: { equals: 'In Progress' },
        },
        sorts: [{
          property: 'Priority',
          direction: 'ascending',
        }],
        page_size: 25,
      });
    });
  });

  describe('database query multi-filter', () => {
    it('should combine two filter groups with { and: [...] }', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter-prop', 'Due Date',
        '--filter-type', 'before',
        '--filter-value', '2024-01-01',
        '--filter-prop-type', 'date',
        '--filter-prop', 'Done',
        '--filter-type', 'equals',
        '--filter-value', 'true',
        '--filter-prop-type', 'checkbox',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: {
          and: [
            { property: 'Due Date', date: { before: '2024-01-01' } },
            { property: 'Done', checkbox: { equals: true } },
          ],
        },
        page_size: 100,
      });
    });

    it('should combine three filter groups with { and: [...] }', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter-prop', 'Status',
        '--filter-type', 'equals',
        '--filter-value', 'Done',
        '--filter-prop-type', 'status',
        '--filter-prop', 'Priority',
        '--filter-type', 'equals',
        '--filter-value', 'High',
        '--filter-prop-type', 'select',
        '--filter-prop', 'Done',
        '--filter-type', 'equals',
        '--filter-value', 'true',
        '--filter-prop-type', 'checkbox',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: {
          and: [
            { property: 'Status', status: { equals: 'Done' } },
            { property: 'Priority', select: { equals: 'High' } },
            { property: 'Done', checkbox: { equals: true } },
          ],
        },
        page_size: 100,
      });
    });

    it('should exit with error when filter flag counts are mismatched', async () => {
      await expect(
        program.parseAsync([
          'node', 'test', 'database', 'query', 'db-123',
          '--filter-prop', 'Status',
          '--filter-prop', 'Priority',
          '--filter-type', 'equals',
          '--filter-value', 'Done',
        ])
      ).rejects.toThrow('process.exit(1)');

      expect(console.error).toHaveBeenCalledWith(
        'Error: --filter-prop, --filter-type, and --filter-value must be provided the same number of times'
      );
    });

    it('should exit with error when --filter-prop-type count does not match filter group count', async () => {
      await expect(
        program.parseAsync([
          'node', 'test', 'database', 'query', 'db-123',
          '--filter-prop', 'Title',
          '--filter-type', 'contains',
          '--filter-value', 'foo',
          '--filter-prop', 'Status',
          '--filter-type', 'equals',
          '--filter-value', 'Done',
          '--filter-prop-type', 'status',
        ])
      ).rejects.toThrow('process.exit(1)');

      expect(console.error).toHaveBeenCalledWith(
        'Error: --filter-prop-type must be provided either for all filter groups or for none'
      );
    });

    it('should produce plain filter object for single filter group (regression)', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter-prop', 'Status',
        '--filter-type', 'equals',
        '--filter-value', 'Done',
        '--filter-prop-type', 'status',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: { property: 'Status', status: { equals: 'Done' } },
        page_size: 100,
      });
    });

    it('should use raw --filter JSON unchanged (regression)', async () => {
      setupDatabaseResolution(mockClient);
      const result = createPaginatedResult([mockPage]);
      mockClient.post.mockResolvedValue(result);

      const filter = JSON.stringify({ property: 'Status', status: { equals: 'Done' } });
      await program.parseAsync([
        'node', 'test', 'database', 'query', 'db-123',
        '--filter', filter,
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('data_sources/ds-456/query', {
        filter: { property: 'Status', status: { equals: 'Done' } },
        page_size: 100,
      });
    });
  });

  describe('--title flag', () => {
    it('should auto-detect title property and filter by exact title', async () => {
      // First resolution (for --title schema lookup), then another for query
      setupDatabaseResolution(mockClient);
      // The resolver caches, so query uses cached resolution
      mockClient.post.mockResolvedValue(createPaginatedResult([mockPage]));

      await program.parseAsync(['node', 'test', 'database', 'query', 'db-123', '--title', 'My Task']);

      expect(mockClient.post).toHaveBeenCalledWith(
        'data_sources/ds-456/query',
        expect.objectContaining({
          filter: { property: 'Name', title: { equals: 'My Task' } },
        })
      );
    });
  });

  describe('--llm flag on query', () => {
    it('should output compact format', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue(createPaginatedResult([mockPage]));

      await program.parseAsync(['node', 'test', 'database', 'query', 'db-123', '--llm']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('page-123 Test Page'));
    });
  });

  describe('Error handling', () => {
    it('should handle get errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Database not found'));

      await expect(
        program.parseAsync(['node', 'test', 'database', 'get', 'invalid-id'])
      ).rejects.toThrow('process.exit(1)');

      expect(console.error).toHaveBeenCalledWith('Error:', 'Database not found');
    });

    it('should handle query errors', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockRejectedValue(new Error('Invalid filter'));

      await expect(
        program.parseAsync(['node', 'test', 'database', 'query', 'db-123'])
      ).rejects.toThrow('process.exit(1)');

      expect(console.error).toHaveBeenCalledWith('Error:', 'Invalid filter');
    });

    it('should handle invalid JSON filter', async () => {
      await expect(
        program.parseAsync([
          'node', 'test', 'database', 'query', 'db-123',
          '--filter', '{invalid json}',
        ])
      ).rejects.toThrow();
    });
  });

  describe('database create', () => {
    it('puts properties in initial_data_source with a default Name title', async () => {
      mockClient.post.mockResolvedValue({ id: 'new-db', url: 'u' });

      await program.parseAsync([
        'node', 'test', 'database', 'create', '--parent', 'page-1', '-t', 'Issues',
        '-p', 'Due:date', '-p', 'Priority:select=P0|P1|P2',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('databases', {
        parent: { type: 'page_id', page_id: 'page-1' },
        title: [{ type: 'text', text: { content: 'Issues' } }],
        initial_data_source: {
          properties: {
            Name: { title: {} },
            Due: { date: {} },
            Priority: { select: { options: [{ name: 'P0' }, { name: 'P1' }, { name: 'P2' }] } },
          },
        },
      });
    });

    it('lets a named title property replace Name', async () => {
      mockClient.post.mockResolvedValue({ id: 'new-db', url: 'u' });

      await program.parseAsync(['node', 'test', 'database', 'create', '--parent', 'p', '-t', 'Releases', '-p', 'Version:title']);

      expect(mockClient.post.mock.calls[0][1].initial_data_source.properties).toEqual({ Version: { title: {} } });
    });

    it('resolves a relation target database to its data source', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue({ id: 'new-db', url: 'u' });

      await program.parseAsync([
        'node', 'test', 'database', 'create', '--parent', 'p', '-t', 'Issues',
        '-p', 'Release:relation=db-123,dual=Issues',
      ]);

      expect(mockClient.get).toHaveBeenCalledWith('databases/db-123');
      expect(mockClient.post.mock.calls[0][1].initial_data_source.properties.Release).toEqual({
        relation: { data_source_id: 'ds-456', type: 'dual_property', dual_property: { synced_property_name: 'Issues' } },
      });
    });

    it('makes a one-way relation without dual', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue({ id: 'new-db', url: 'u' });

      await program.parseAsync(['node', 'test', 'database', 'create', '--parent', 'p', '-t', 'X', '-p', 'Run:relation=db-123']);

      expect(mockClient.post.mock.calls[0][1].initial_data_source.properties.Run).toEqual({
        relation: { data_source_id: 'ds-456', type: 'single_property', single_property: {} },
      });
    });

    it('rejects a relation with no target', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'database', 'create', '--parent', 'p', '-t', 'X', '-p', 'Run:relation'])
      ).rejects.toThrow('process.exit(1)');
      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });

  describe('database update --add-prop', () => {
    it('adds several properties, a relation among them', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.patch.mockResolvedValue({});

      await program.parseAsync([
        'node', 'test', 'database', 'update', 'db-123',
        '--add-prop', 'Owner:people', '--add-prop', 'Parent:relation=db-123',
      ]);

      expect(mockClient.patch).toHaveBeenCalledWith('data_sources/ds-456', {
        properties: {
          Owner: { people: {} },
          Parent: { relation: { data_source_id: 'ds-456', type: 'single_property', single_property: {} } },
        },
      });
    });
  });
});
