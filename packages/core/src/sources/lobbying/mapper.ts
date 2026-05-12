/**
 * Entity extraction from lobbying filings.
 * Maps lobbying data to persons, organizations, and their relationships.
 */

import type { LobbyingCommunication, LobbyingFiling } from "../../types";
import { normalizeName } from "../types";

export interface LobbyistSummary {
  name: string;
  firmName?: string;
  clientCount: number;
  filingCount: number;
  institutions: Set<string>;
  subjects: string[];
}

export interface ClientSummary {
  name: string;
  lobbyistCount: number;
  filingCount: number;
  institutions: Set<string>;
}

export interface OfficialSummary {
  name: string;
  institution: string;
  meetingCount: number;
  subjects: string[];
}

/**
 * Extract unique lobbyists from filings.
 */
export function extractLobbyists(
  filings: LobbyingFiling[],
): Map<string, LobbyistSummary> {
  const map = new Map<string, LobbyistSummary>();

  for (const filing of filings) {
    const name = normalizeName(filing.registrant.name);
    if (!name) continue;

    const existing = map.get(name);
    if (existing) {
      existing.filingCount++;
      existing.institutions.add(filing.institution);
      existing.subjects.push(filing.subjectMatter);
    } else {
      map.set(name, {
        name,
        firmName: filing.registrant.firmName,
        clientCount: 0,
        filingCount: 1,
        institutions: new Set([filing.institution]),
        subjects: [filing.subjectMatter],
      });
    }
  }

  // Count unique clients per lobbyist
  const lobbyistClients = new Map<string, Set<string>>();
  for (const filing of filings) {
    const name = normalizeName(filing.registrant.name);
    const clientSet = lobbyistClients.get(name) ?? new Set<string>();
    clientSet.add(filing.clientName);
    lobbyistClients.set(name, clientSet);
  }
  for (const [name, summary] of map) {
    summary.clientCount = lobbyistClients.get(name)?.size ?? 0;
  }

  return map;
}

/**
 * Extract unique clients from filings.
 */
export function extractClients(
  filings: LobbyingFiling[],
): Map<string, ClientSummary> {
  const map = new Map<string, ClientSummary>();

  for (const filing of filings) {
    const name = normalizeName(filing.clientName);
    if (!name) continue;

    const existing = map.get(name);
    if (existing) {
      existing.filingCount++;
      existing.institutions.add(filing.institution);
    } else {
      map.set(name, {
        name,
        lobbyistCount: 0,
        filingCount: 1,
        institutions: new Set([filing.institution]),
      });
    }
  }

  // Count unique lobbyists per client
  const clientLobbyists = new Map<string, Set<string>>();
  for (const filing of filings) {
    const clientName = normalizeName(filing.clientName);
    const set = clientLobbyists.get(clientName) ?? new Set<string>();
    set.add(normalizeName(filing.registrant.name));
    clientLobbyists.set(clientName, set);
  }
  for (const [name, summary] of map) {
    summary.lobbyistCount = clientLobbyists.get(name)?.size ?? 0;
  }

  return map;
}

/**
 * Extract government officials mentioned in communications.
 */
export function extractOfficials(
  comms: LobbyingCommunication[],
): Map<string, OfficialSummary> {
  const map = new Map<string, OfficialSummary>();

  for (const comm of comms) {
    for (const officialName of comm.officials) {
      const name = normalizeName(officialName);
      if (!name) continue;

      const existing = map.get(name);
      if (existing) {
        existing.meetingCount++;
        existing.subjects.push(comm.subjectMatter);
      } else {
        map.set(name, {
          name,
          institution: comm.institution,
          meetingCount: 1,
          subjects: [comm.subjectMatter],
        });
      }
    }
  }

  return map;
}

/**
 * Build a relationship map: lobbyist -> client -> institution.
 */
export function extractRelationships(filings: LobbyingFiling[]): Array<{
  lobbyist: string;
  client: string;
  institution: string;
  subject: string;
}> {
  return filings.map((f) => ({
    lobbyist: normalizeName(f.registrant.name),
    client: normalizeName(f.clientName),
    institution: f.institution,
    subject: f.subjectMatter,
  }));
}
