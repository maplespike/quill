// SPDX-License-Identifier: AGPL-3.0-only

export interface DepartmentalStatement {
  department: string;
  year: number;
  revenue: number;
  expenses: number;
  netCost: number;
}

export interface ProgramSpending {
  department: string;
  program: string;
  year: number;
  actual: number;
  planned: number;
}

export interface DebtLiability {
  category: string;
  year: number;
  amount: number;
}

export interface AccountEntry {
  id: string;
  level: string;
  category: string;
  fiscalYear: number;
  amount: number;
  description: string;
  currency: string;
}

export interface AccountSummary {
  totalEntries: number;
  totalAmount: number;
  categories: Array<{ category: string; totalAmount: number; count: number }>;
}