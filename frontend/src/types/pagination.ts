/** Envelope devolvido pelas listagens quando chamadas com `?page` (paginação
 *  opt-in do backend — ver orders/pagination.py). Sem `?page`, os endpoints
 *  continuam devolvendo o array completo. */
export interface Paginado<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
