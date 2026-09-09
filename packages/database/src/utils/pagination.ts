export type PageParams = {
  /** 1-based page number. */
  page: number;
  perPage: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type NormalizePageOptions = {
  defaultPerPage?: number;
  maxPerPage?: number;
};

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

/** Clamps user-supplied paging values into a safe range (repositories never trust input). */
export const normalizePage = (
  params: Partial<PageParams>,
  { defaultPerPage = DEFAULT_PER_PAGE, maxPerPage = MAX_PER_PAGE }: NormalizePageOptions = {},
): PageParams => {
  const page =
    Number.isFinite(params.page) && (params.page ?? 0) >= 1 ? Math.floor(params.page ?? 1) : 1;
  const requested =
    Number.isFinite(params.perPage) && (params.perPage ?? 0) >= 1
      ? Math.floor(params.perPage ?? defaultPerPage)
      : defaultPerPage;
  return { page, perPage: Math.min(requested, maxPerPage) };
};

/** Prisma `skip`/`take` for a page. */
export const toSkipTake = ({ page, perPage }: PageParams): { skip: number; take: number } => ({
  skip: (page - 1) * perPage,
  take: perPage,
});

export const buildPage = <T>(
  items: T[],
  total: number,
  { page, perPage }: PageParams,
): PageResult<T> => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  return {
    items,
    total,
    page,
    perPage,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
};
