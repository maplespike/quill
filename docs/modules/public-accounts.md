# Public Accounts Module

## Overview

Ingests federal public accounts data.

## Data Sources

- Public Accounts of Canada

## Data Types

- Departmental financial statements
- Program spending
- Revenue sources
- Debt and liabilities

## MCP Tools

- `get_public_accounts` - Fetch public accounts data for a specific year
- `get_department_spending` - Get spending data for a specific department
- `compare_spending_trends` - Compare spending trends across departments

## Usage

```typescript
import { ingestPublicAccounts, getDepartmentSpending } from '@maplespike/pipeline-core/public-accounts';

const accounts2024 = await ingestPublicAccounts(2024);
const defenseSpending = await getDepartmentSpending('National Defence');
```

## License

Open Data License