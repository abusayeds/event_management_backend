export interface IQueryParams {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
}

export interface IFilterOptions {
  status?: string;
  role?: string;
  category?: string;
  type?: string;
}

export interface ISelectFields {
  id?: boolean;
  email?: boolean;
  name?: boolean;
  status?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
}
