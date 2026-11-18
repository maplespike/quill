// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type CommitteeType =
  | "standing"
  | "special"
  | "joint"
  | "subcommittee"
  | "other";

export type CommitteeScope = "federal" | "provincial" | "municipal" | "other";

export interface CommitteeMeeting {
  date: string;
  type: "regular" | "emergency" | "in_camera";
  location?: string;
  agenda?: string[];
  attendees?: string[];
}

export interface CommitteeMember {
  personId?: string;
  personName: string;
  role: "chair" | "vice_chair" | "member" | "clerk";
  startDate: string;
  endDate?: string;
  party?: string;
  riding?: string;
}

export interface Committee extends BaseEntity {
  names: string[];
  type: CommitteeType;
  scope: CommitteeScope;
  chamber?: string; // e.g., "House of Commons", "Senate", "Legislative Assembly"
  mandate: string;
  members: CommitteeMember[];
  meetings: CommitteeMeeting[];
  parentCommitteeId?: string; // For subcommittees
  source: GovernmentSource;
}