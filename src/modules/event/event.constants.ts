/** Allowed values for EventSchedule.competitionLevel only (not roundType). */
export const SCHEDULE_COMPETITION_LEVELS = [
  'Local-Easy',
  'Local-Medium',
  'Local-Difficult',
  'Regional-Easy',
  'Regional-Medium',
  'Regional-Difficult',
  'State-Easy',
  'State-Medium',
  'State-Difficult',
  'National-Easy',
  'National-Medium',
  'National-Difficult',
  'International-Easy',
  'International-Medium',
  'International-Difficult',
] as const;

export type ScheduleCompetitionLevel = (typeof SCHEDULE_COMPETITION_LEVELS)[number];

export const SCHEDULE_COMPETITION_LEVEL_SET = new Set<string>(SCHEDULE_COMPETITION_LEVELS);
