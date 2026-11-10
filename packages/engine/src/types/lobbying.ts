// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type CommunicationType =
  | "meeting"
  | "call"
  | "email"
  | "letter"
  | "conference"
  | "other";

export interface Lobbyist {
  name: string;
  firmName?: string;
  personId?: string;
  organizationId?: string;
}

export interface LobbyingCommunication {
  date: string;
  type: CommunicationType;
  subjectMatter: string;
  officials: string[];
  institution: string;
}

export interface LobbyingFiling extends BaseEntity {
  filingNumber: string;
  registrant: Lobbyist;
  clientName: string;
  clientOrganizationId?: string;
  subjectMatter: string;
  communications: LobbyingCommunication[];
  startDate: string;
  endDate: string;
  activities: string[];
  institution: string;
  province?: string;
  source: GovernmentSource;
}
