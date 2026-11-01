// DocumentsListPresenter: list loading, envelope meta -> pagination, filters,
// empty and error branches. The transport + folders API are mocked.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('../src/microservices/documents/api', () => ({
  documentsApi: {
    list: jest.fn(),
    detail: jest.fn(),
    upload: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    removePermanent: jest.fn(),
    versions: jest.fn(),
    uploadVersion: jest.fn(),
    history: jest.fn(),
    expiring: jest.fn(),
    download: jest.fn(),
    downloadUrl: jest.fn(() => '/api/documents/x/download'),
    versionDownloadUrl: jest.fn(() => '/api/documents/x/versions/1/download'),
  },
}));

jest.mock('../src/microservices/folders/api', () => ({
  foldersApi: {
    list: jest.fn(async () => ({ data: [{ id: 'f1', name: 'Travel', documentCount: 2 }] })),
  },
}));

const { documentsApi } = require('../src/microservices/documents/api');
const { DocumentsListPresenter } = require('../src/microservices/documents/presenters');
const { ApiError } = require('../src/core/api/ApiClient');

function doc(n) {
  return {
    id: `d${n}`,
    title: `Deed ${n}`,
    docType: 'passport',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    fileSize: 1024,
  };
}

function makePresenter() {
  const nav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
  return { nav, presenter: new DocumentsListPresenter(nav) };
}

beforeEach(() => {
  documentsApi.list.mockReset();
});

describe('DocumentsListPresenter.load', () => {
  test('fetches page 1 with vault sort order and maps rows', async () => {
    const { presenter } = makePresenter();
    documentsApi.list.mockResolvedValueOnce({ data: [1, 2, 3].map(doc), meta: { page: 1, limit: 12, total: 3, pages: 1 } });

    await presenter.load();

    expect(documentsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 12, sort: 'created_at', order: 'desc' })
    );
    expect(presenter.state.status).toBe('success');
    expect(presenter.state.data.items).toHaveLength(3);
    expect(presenter.state.data.total).toBe(3);
    expect(presenter.state.data.hasMore).toBe(false);
  });

  test('derives expiry countdown via docFromApi', async () => {
    const { presenter } = makePresenter();
    const soon = doc(1);
    soon.expiresAt = new Date(Date.now() + 5 * 86400000).toISOString();
    documentsApi.list.mockResolvedValueOnce({ data: [soon], meta: { total: 1, pages: 1 } });

    await presenter.load();

    expect(presenter.state.data.items[0].daysLeft).toBe(5);
  });

  test('reports the empty status when the vault has no rows', async () => {
    const { presenter } = makePresenter();
    documentsApi.list.mockResolvedValueOnce({ data: [], meta: { page: 1, total: 0, pages: 1 } });

    await presenter.load();

    expect(presenter.state.status).toBe('empty');
    expect(presenter.state.data.items).toEqual([]);
  });

  test('lands on the error state with a friendly message', async () => {
    const { presenter } = makePresenter();
    documentsApi.list.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));

    await presenter.load();

    expect(presenter.state.status).toBe('error');
    expect(presenter.state.error).toBe('Cannot reach the vault. Check your connection and try again.');
  });
});

describe('DocumentsListPresenter pagination', () => {
  test('loadMore appends page 2 and clears hasMore at the end', async () => {
    const { presenter } = makePresenter();
    documentsApi.list
      .mockResolvedValueOnce({ data: [1, 2, 3].map(doc), meta: { page: 1, total: 5, pages: 2 } })
      .mockResolvedValueOnce({ data: [4, 5].map(doc), meta: { page: 2, total: 5, pages: 2 } });

    await presenter.load();
    expect(presenter.state.data.items).toHaveLength(3);
    expect(presenter.state.data.hasMore).toBe(true);

    await presenter.loadMore();
    expect(documentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(presenter.state.data.items).toHaveLength(5);
    expect(presenter.state.data.items.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
    expect(presenter.state.data.hasMore).toBe(false);
  });

  test('loadMore is a no-op once the last page is reached', async () => {
    const { presenter } = makePresenter();
    documentsApi.list.mockResolvedValue({ data: [1].map(doc), meta: { total: 1, pages: 1 } });

    await presenter.load();
    await presenter.loadMore();

    expect(documentsApi.list).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentsListPresenter filters', () => {
  test('setFilter merges into the query and resets to page 1', async () => {
    const { presenter } = makePresenter();
    documentsApi.list
      .mockResolvedValueOnce({ data: [1, 2, 3].map(doc), meta: { total: 9, pages: 2 } })
      .mockResolvedValue({ data: [4].map(doc), meta: { total: 1, pages: 1 } });

    await presenter.load();
    await presenter.loadMore();
    expect(presenter.page).toBe(2);

    await presenter.setFilter('status', 'active');

    expect(documentsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'active', page: 1 })
    );
    expect(presenter.page).toBe(1);
    expect(presenter.state.data.items).toHaveLength(1);
  });

  test('search terms ride along with the other filters', async () => {
    const { presenter } = makePresenter();
    documentsApi.list.mockResolvedValue({ data: [], meta: { total: 0, pages: 1 } });

    await presenter.setFilter('search', 'deed');

    expect(documentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'deed' }));
  });
});

describe('DocumentsListPresenter.refresh', () => {
  test('pull-to-refresh replays page 1 and replaces the rows', async () => {
    const { presenter } = makePresenter();
    documentsApi.list
      .mockResolvedValueOnce({ data: [1, 2].map(doc), meta: { total: 4, pages: 2 } })
      .mockResolvedValueOnce({ data: [3, 4].map(doc), meta: { total: 4, pages: 2 } })
      .mockResolvedValueOnce({ data: [9].map(doc), meta: { total: 1, pages: 1 } });

    await presenter.load();
    await presenter.loadMore();
    await presenter.refresh();

    expect(presenter.page).toBe(1);
    expect(presenter.state.data.items.map((d) => d.id)).toEqual(['d9']);
    expect(presenter.state.data.hasMore).toBe(false);
  });
});
