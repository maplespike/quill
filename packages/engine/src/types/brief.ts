// SPDX-License-Identifier: AGPL-3.0-only
import type { SignalType } from "./graph";

export interface BriefSection {
  title: string;
  content: string;
  entityType?: string;
  entityId?: string;
  signalTypes?: SignalType[];
}

export interface Brief {
  id: string;
  title: string;
  summary: string;
  sections: BriefSection[];
  entityIds: string[];
  confidence: number;
  generatedAt: string;
  expiresAt?: string;
}
