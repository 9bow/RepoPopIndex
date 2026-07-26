import type {
  ContributorAssociation,
  ContributorInsights,
  MonthlyContributorActivity,
} from "./types";

export type ContributorEventKind = "commit" | "pull_request" | "issue";

export interface ContributorActivityEvent {
  actor: string;
  actorId?: string | null;
  actorDatabaseId?: number | null;
  actorAvatarUrl?: string | null;
  actorProfileUrl?: string | null;
  occurredAt: string;
  kind: ContributorEventKind;
  association?: string | null;
}

const AFFILIATED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const EXTERNAL_ASSOCIATIONS = new Set([
  "CONTRIBUTOR",
  "FIRST_TIMER",
  "FIRST_TIME_CONTRIBUTOR",
  "NONE",
]);
const FIRST_TIME_ASSOCIATIONS = new Set([
  "FIRST_TIMER",
  "FIRST_TIME_CONTRIBUTOR",
]);

export function isBotLogin(login: string): boolean {
  const normalized = login.toLowerCase();
  return normalized.endsWith("[bot]") || normalized.endsWith("-bot");
}

function monthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function classifyAssociations(associations: Set<string>): ContributorAssociation {
  if ([...associations].some((value) => AFFILIATED_ASSOCIATIONS.has(value))) {
    return "affiliated";
  }
  if ([...associations].some((value) => EXTERNAL_ASSOCIATIONS.has(value))) {
    return "external";
  }
  return "unknown";
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count++;
  }
  return count;
}

export function aggregateContributorInsights(
  events: ContributorActivityEvent[],
  options: {
    now?: Date;
    windowMonths?: number;
    observationMonths?: number;
    truncatedSources?: string[];
  } = {}
): ContributorInsights {
  const now = options.now ?? new Date();
  const windowMonths = options.windowMonths ?? 12;
  const observationMonths = Math.max(
    options.observationMonths ?? windowMonths * 2,
    windowMonths
  );
  const displayStart = addUtcMonths(startOfUtcMonth(now), -(windowMonths - 1));
  const observationStart = addUtcMonths(
    startOfUtcMonth(now),
    -(observationMonths - 1)
  );
  const displayEnd = addUtcMonths(startOfUtcMonth(now), 1);

  const validEvents = events
    .filter((event) => event.actor && !isBotLogin(event.actor))
    .map((event) => ({ ...event, date: new Date(event.occurredAt) }))
    .filter(
      (event) =>
        Number.isFinite(event.date.getTime()) &&
        event.date >= observationStart &&
        event.date < displayEnd
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const actorFirstSeen = new Map<string, Date>();
  const actorAssociations = new Map<string, Set<string>>();
  const activityByMonth = new Map<string, Set<string>>();
  const eventsByMonth = new Map<string, typeof validEvents>();
  const firstTimeSignalsByMonth = new Map<string, Set<string>>();

  for (const event of validEvents) {
    if (!actorFirstSeen.has(event.actor)) {
      actorFirstSeen.set(event.actor, event.date);
    }
    const month = monthKey(event.date);
    const active = activityByMonth.get(month) ?? new Set<string>();
    active.add(event.actor);
    activityByMonth.set(month, active);

    const monthEvents = eventsByMonth.get(month) ?? [];
    monthEvents.push(event);
    eventsByMonth.set(month, monthEvents);

    if (event.association) {
      const associations = actorAssociations.get(event.actor) ?? new Set<string>();
      associations.add(event.association);
      actorAssociations.set(event.actor, associations);

      if (FIRST_TIME_ASSOCIATIONS.has(event.association)) {
        const signals = firstTimeSignalsByMonth.get(month) ?? new Set<string>();
        signals.add(event.actor);
        firstTimeSignalsByMonth.set(month, signals);
      }
    }
  }

  const monthly: MonthlyContributorActivity[] = [];
  for (let index = 0; index < windowMonths; index++) {
    const monthDate = addUtcMonths(displayStart, index);
    const month = monthKey(monthDate);
    const previousMonth = monthKey(addUtcMonths(monthDate, -1));
    const active = activityByMonth.get(month) ?? new Set<string>();
    const previousActive = activityByMonth.get(previousMonth) ?? new Set<string>();
    const monthEvents = eventsByMonth.get(month) ?? [];
    const observedNew = new Set(
      [...active].filter((actor) => {
        const firstSeen = actorFirstSeen.get(actor);
        return firstSeen ? monthKey(firstSeen) === month : false;
      })
    );
    const returning = intersectionSize(active, previousActive);

    let affiliatedContributors = 0;
    let externalContributors = 0;
    let unknownAssociationContributors = 0;
    for (const actor of active) {
      const monthAssociations = new Set(
        monthEvents
          .filter((event) => event.actor === actor && event.association)
          .map((event) => event.association!)
      );
      const classification = classifyAssociations(
        monthAssociations
      );
      if (classification === "affiliated") affiliatedContributors++;
      else if (classification === "external") externalContributors++;
      else unknownAssociationContributors++;
    }

    monthly.push({
      month,
      commits: monthEvents.filter((event) => event.kind === "commit").length,
      pullRequests: monthEvents.filter((event) => event.kind === "pull_request").length,
      issues: monthEvents.filter((event) => event.kind === "issue").length,
      activeContributors: active.size,
      observedNewContributors: observedNew.size,
      firstTimeContributorSignals: firstTimeSignalsByMonth.get(month)?.size ?? 0,
      returningContributors: returning,
      retentionRate:
        previousActive.size > 0 ? returning / previousActive.size : null,
      affiliatedContributors,
      externalContributors,
      unknownAssociationContributors,
      partialMonth: month === monthKey(now),
    });
  }

  const displayActors = new Set<string>();
  const displayNewActors = new Set<string>();
  const displayFirstTimeActors = new Set<string>();
  for (const event of validEvents) {
    if (event.date < displayStart) continue;
    displayActors.add(event.actor);
    const firstSeen = actorFirstSeen.get(event.actor);
    if (firstSeen && firstSeen >= displayStart) displayNewActors.add(event.actor);
    if (event.association && FIRST_TIME_ASSOCIATIONS.has(event.association)) {
      displayFirstTimeActors.add(event.actor);
    }
  }

  let affiliatedContributors = 0;
  let externalContributors = 0;
  let unknownAssociationContributors = 0;
  for (const actor of displayActors) {
    const classification = classifyAssociations(
      actorAssociations.get(actor) ?? new Set<string>()
    );
    if (classification === "affiliated") affiliatedContributors++;
    else if (classification === "external") externalContributors++;
    else unknownAssociationContributors++;
  }

  const latestCompleteMonth = [...monthly]
    .reverse()
    .find((month) => !month.partialMonth);
  const truncatedSources = options.truncatedSources ?? [];

  return {
    windowMonths,
    observationMonths,
    generatedAt: now.toISOString(),
    activeContributors: displayActors.size,
    observedNewContributors: displayNewActors.size,
    firstTimeContributorSignals: displayFirstTimeActors.size,
    affiliatedContributors,
    externalContributors,
    unknownAssociationContributors,
    latestCompleteMonthRetentionRate:
      latestCompleteMonth?.retentionRate ?? null,
    monthly,
    dataQuality: {
      status: truncatedSources.length > 0 ? "partial" : "complete",
      truncatedSources,
      limitations: [
        `Observed-new means first seen in the ${observationMonths}-month API window, not first-ever contribution.`,
        "Affiliated combines repository owner, organization member, and collaborator; it does not prove employment.",
        "Commit-only actors can remain unknown because commit history does not expose repository association.",
      ],
    },
  };
}
