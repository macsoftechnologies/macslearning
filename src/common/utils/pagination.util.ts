export function createPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number,
) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    data,
    meta: {
      totalItems,
      currentPage: page,
      totalPages,
      limit,
    },
  };
}
