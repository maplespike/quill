/**
 * Entity extraction from federal spending contracts.
 * Maps contract data to normalized vendor names and departments.
 */

import type { Contract } from "../../types";

export interface VendorSummary {
	name: string;
	contractCount: number;
	totalValue: number;
	departmentInteractions: Set<string>;
}

export interface DepartmentSummary {
	name: string;
	contractCount: number;
	totalValue: number;
	vendorCount: number;
}

/**
 * Extract unique vendor names from contracts and aggregate statistics.
 */
export function extractVendors(
	contracts: Contract[],
): Map<string, VendorSummary> {
	const vendors = new Map<string, VendorSummary>();

	for (const contract of contracts) {
		const name = normalizeVendorName(contract.vendorName);
		if (!name) continue;

		const existing = vendors.get(name);
		if (existing) {
			existing.contractCount++;
			existing.totalValue += contract.value;
			existing.departmentInteractions.add(contract.department);
		} else {
			vendors.set(name, {
				name,
				contractCount: 1,
				totalValue: contract.value,
				departmentInteractions: new Set([contract.department]),
			});
		}
	}

	return vendors;
}

/**
 * Extract unique departments from contracts and aggregate statistics.
 */
export function extractDepartments(
	contracts: Contract[],
): Map<string, DepartmentSummary> {
	const depts = new Map<string, DepartmentSummary>();
	const deptVendors = new Map<string, Set<string>>();

	for (const contract of contracts) {
		const name = contract.department.trim();
		if (!name) continue;

		const vendorName = normalizeVendorName(contract.vendorName);
		const existing = depts.get(name);
		const vendorSet = deptVendors.get(name) ?? new Set<string>();

		if (vendorName) vendorSet.add(vendorName);
		deptVendors.set(name, vendorSet);

		if (existing) {
			existing.contractCount++;
			existing.totalValue += contract.value;
			existing.vendorCount = vendorSet.size;
		} else {
			depts.set(name, {
				name,
				contractCount: 1,
				totalValue: contract.value,
				vendorCount: vendorSet.size,
			});
		}
	}

	return depts;
}

/**
 * Normalize vendor name for deduplication.
 * Strips common suffixes and normalizes spacing.
 */
export function normalizeVendorName(name: string): string {
	return name
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[,"]/g, "")
		.replace(
			/\s+(Inc|Ltd|Corp|Corporation|Limited|LP|LLP|LLC| Cie| Cie\.|Compagnie)\.?$/i,
			"",
		)
		.trim();
}

/**
 * Group contracts by vendor name.
 */
export function groupByVendor(contracts: Contract[]): Map<string, Contract[]> {
	const groups = new Map<string, Contract[]>();
	for (const c of contracts) {
		const name = normalizeVendorName(c.vendorName);
		const list = groups.get(name) ?? [];
		list.push(c);
		groups.set(name, list);
	}
	return groups;
}

/**
 * Group contracts by department.
 */
export function groupByDepartment(
	contracts: Contract[],
): Map<string, Contract[]> {
	const groups = new Map<string, Contract[]>();
	for (const c of contracts) {
		const name = c.department.trim();
		const list = groups.get(name) ?? [];
		list.push(c);
		groups.set(name, list);
	}
	return groups;
}
