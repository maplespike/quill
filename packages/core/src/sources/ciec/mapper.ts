/**
 * Entity extraction from CIEC disclosures and Elections Canada donations.
 * Maps disclosed interests to organizations for conflict-of-interest analysis.
 */

import type { Disclosure, Donation, Interest } from "../../types";
import { normalizeName } from "../types";

export interface DisclosureSummary {
	personName: string;
	department: string;
	position: string;
	interestCount: number;
	categories: Set<string>;
	organizations: string[];
}

export interface DonorSummary {
	name: string;
	isCorporate: boolean;
	totalDonated: number;
	donationCount: number;
	recipients: Map<string, number>;
}

export interface RecipientSummary {
	name: string;
	type: string;
	totalReceived: number;
	donationCount: number;
	donorCount: number;
}

/**
 * Extract summaries from disclosure records.
 */
export function extractDisclosures(
	disclosures: Disclosure[],
): Map<string, DisclosureSummary> {
	const map = new Map<string, DisclosureSummary>();

	for (const disclosure of disclosures) {
		const name = normalizeName(disclosure.personName);
		if (!name) continue;

		const orgs = extractOrganizationsFromInterests(disclosure.interests);
		const categories = new Set(disclosure.interests.map((i) => i.category));

		map.set(name, {
			personName: name,
			department: disclosure.department,
			position: disclosure.position,
			interestCount: disclosure.interests.length,
			categories,
			organizations: orgs,
		});
	}

	return map;
}

/**
 * Extract donor summaries from donations.
 */
export function extractDonors(
	donations: Donation[],
): Map<string, DonorSummary> {
	const map = new Map<string, DonorSummary>();
	const donorRecipients = new Map<string, Map<string, number>>();

	for (const donation of donations) {
		const name = normalizeName(donation.donorName);
		if (!name) continue;

		const recipientTotals =
			donorRecipients.get(name) ?? new Map<string, number>();
		recipientTotals.set(
			donation.recipientName,
			(recipientTotals.get(donation.recipientName) ?? 0) + donation.amount,
		);
		donorRecipients.set(name, recipientTotals);

		const existing = map.get(name);
		if (existing) {
			existing.totalDonated += donation.amount;
			existing.donationCount++;
			existing.recipients = recipientTotals;
		} else {
			map.set(name, {
				name,
				isCorporate: donation.isCorporate,
				totalDonated: donation.amount,
				donationCount: 1,
				recipients: recipientTotals,
			});
		}
	}

	return map;
}

/**
 * Extract recipient summaries from donations.
 */
export function extractRecipients(
	donations: Donation[],
): Map<string, RecipientSummary> {
	const map = new Map<string, RecipientSummary>();
	const recipientDonors = new Map<string, Set<string>>();

	for (const donation of donations) {
		const name = donation.recipientName.trim();
		if (!name) continue;

		const donorSet = recipientDonors.get(name) ?? new Set<string>();
		donorSet.add(normalizeName(donation.donorName));
		recipientDonors.set(name, donorSet);

		const existing = map.get(name);
		if (existing) {
			existing.totalReceived += donation.amount;
			existing.donationCount++;
			existing.donorCount = donorSet.size;
		} else {
			map.set(name, {
				name,
				type: donation.recipientType,
				totalReceived: donation.amount,
				donationCount: 1,
				donorCount: donorSet.size,
			});
		}
	}

	return map;
}

/**
 * Extract organization names from disclosed interests.
 * Tries to identify corporate entities, property holdings, etc.
 */
export function extractOrganizationsFromInterests(
	interests: Interest[],
): string[] {
	const orgs: string[] = [];

	for (const interest of interests) {
		const desc = interest.description;

		// Extract text between quotes or after "in" for corporation/property interests
		const quotedMatch = desc.match(/"([^"]+)"/);
		if (quotedMatch) {
			orgs.push(quotedMatch[1]);
			continue;
		}

		// Look for corporation names (capitalized words)
		if (
			interest.category === "corporations" ||
			interest.category === "securities"
		) {
			// The description itself often contains the org name
			const cleaned = desc
				.replace(/^(shares|stock|interest|holding|ownership)\s+(in|of)\s+/i, "")
				.trim();
			if (cleaned) orgs.push(cleaned);
		}

		if (interest.category === "real_property") {
			const propMatch = desc.match(
				/(?:property|building|land)\s+(?:at|in|on)\s+(.+)/i,
			);
			if (propMatch) orgs.push(propMatch[1].trim());
		}

		if (interest.category === "partnerships") {
			orgs.push(
				desc.replace(/^(partnership|interest)\s+(in|with)\s+/i, "").trim(),
			);
		}
	}

	return [...new Set(orgs.map((o) => normalizeName(o)).filter(Boolean))];
}

/**
 * Cross-reference donors with disclosed interests.
 * Identifies potential conflicts where a donor also appears in disclosures.
 */
export function crossReferenceDonorsDisclosures(
	donations: Donation[],
	disclosures: Disclosure[],
): Array<{ donor: string; disclosedPerson: string; organization: string }> {
	const conflicts: Array<{
		donor: string;
		disclosedPerson: string;
		organization: string;
	}> = [];

	// Build org -> disclosure map
	const orgToDisclosure = new Map<string, { person: string; org: string }[]>();
	for (const disclosure of disclosures) {
		const orgs = extractOrganizationsFromInterests(disclosure.interests);
		for (const org of orgs) {
			const list = orgToDisclosure.get(org.toLowerCase()) ?? [];
			list.push({ person: disclosure.personName, org });
			orgToDisclosure.set(org.toLowerCase(), list);
		}
	}

	// Check each donor against disclosed orgs
	for (const donation of donations) {
		const donorName = normalizeName(donation.donorName).toLowerCase();
		const matches = orgToDisclosure.get(donorName);
		if (matches) {
			for (const match of matches) {
				conflicts.push({
					donor: donation.donorName,
					disclosedPerson: match.person,
					organization: match.org,
				});
			}
		}
	}

	return conflicts;
}
