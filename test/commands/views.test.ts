import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { setupDatabaseResolution } from '../fixtures/notion-data';

describe('Views Command', () => {
  let program: Command;
  let mockClient: any;

  beforeEach(async () => {
    vi.resetModules();

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    vi.doMock('../../src/client', () => ({
      getClient: () => mockClient,
      initClient: vi.fn(),
    }));

    const { registerViewsCommand } = await import('../../src/commands/views');
    program = new Command();
    registerViewsCommand(program);
  });

  describe('view create', () => {
    it('places a filtered linked view on a page after a block', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue({ id: 'view-1', url: 'https://notion.so/v' });

      await program.parseAsync([
        'node', 'test', 'view', 'create',
        '--database', 'db-123',
        '--page', 'page-9',
        '--after', 'block-7',
        '--name', '1.43 Issues',
        '--relation', 'Release=page-9',
      ]);

      expect(mockClient.post).toHaveBeenCalledWith('views', {
        data_source_id: 'ds-456',
        name: '1.43 Issues',
        type: 'table',
        create_database: {
          parent: { type: 'page_id', page_id: 'page-9' },
          position: { type: 'after_block', block_id: 'block-7' },
        },
        filter: { property: 'Release', relation: { contains: 'page-9' } },
      });
      expect(console.log).toHaveBeenCalledWith('✅ Linked view created');
    });

    it('adds a tab to the database when no page is given', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue({ id: 'view-2' });

      await program.parseAsync(['node', 'test', 'view', 'create', '-d', 'db-123', '--type', 'board', '-n', 'Board']);

      const body = mockClient.post.mock.calls[0][1];
      expect(body.database_id).toBe('db-123');
      expect(body.create_database).toBeUndefined();
      expect(body.type).toBe('board');
      expect(body.filter).toBeUndefined();
    });

    it('ANDs a relation shortcut with generic filters', async () => {
      setupDatabaseResolution(mockClient);
      mockClient.post.mockResolvedValue({ id: 'view-3' });

      await program.parseAsync([
        'node', 'test', 'view', 'create', '-d', 'db-123', '--page', 'p',
        '--relation', 'Release=p',
        '--filter-prop', 'Status', '--filter-type', 'equals', '--filter-value', 'Done', '--filter-prop-type', 'select',
      ]);

      expect(mockClient.post.mock.calls[0][1].filter).toEqual({
        and: [
          { property: 'Release', relation: { contains: 'p' } },
          { property: 'Status', select: { equals: 'Done' } },
        ],
      });
    });

    it('rejects --after without --page', async () => {
      await expect(program.parseAsync(['node', 'test', 'view', 'create', '-d', 'db-123', '--after', 'b']))
        .rejects.toThrow('process.exit(1)');
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('rejects an unknown view type', async () => {
      await expect(program.parseAsync(['node', 'test', 'view', 'create', '-d', 'db-123', '--type', 'spreadsheet']))
        .rejects.toThrow('process.exit(1)');
    });
  });

  describe('view list', () => {
    it('lists by database', async () => {
      mockClient.get.mockResolvedValue({ results: [{ id: 'v1', name: 'All', type: 'table' }] });

      await program.parseAsync(['node', 'test', 'view', 'list', '-d', 'db-123', '--llm']);

      expect(mockClient.get).toHaveBeenCalledWith('views', { database_id: 'db-123' });
      expect(console.log).toHaveBeenCalledWith('v1 table All');
    });

    it('lists by data source', async () => {
      mockClient.get.mockResolvedValue({ results: [] });

      await program.parseAsync(['node', 'test', 'view', 'list', '--data-source-id', 'ds-1']);

      expect(mockClient.get).toHaveBeenCalledWith('views', { data_source_id: 'ds-1' });
    });

    it('needs exactly one of --database / --data-source-id', async () => {
      await expect(program.parseAsync(['node', 'test', 'view', 'list'])).rejects.toThrow('process.exit(1)');
    });
  });

  describe('view get / delete', () => {
    it('gets a view', async () => {
      mockClient.get.mockResolvedValue({ id: 'v1', name: 'All', type: 'table', data_source_id: 'ds-1' });

      await program.parseAsync(['node', 'test', 'view', 'get', 'v1']);

      expect(mockClient.get).toHaveBeenCalledWith('views/v1');
      expect(console.log).toHaveBeenCalledWith('View:', 'All');
    });

    it('deletes a view', async () => {
      mockClient.delete.mockResolvedValue({});

      await program.parseAsync(['node', 'test', 'view', 'delete', 'v1']);

      expect(mockClient.delete).toHaveBeenCalledWith('views/v1');
    });
  });
});
