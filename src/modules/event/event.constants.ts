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

/**
 * Group criteria presets shown in the "Define Group" dropdown.
 *
 * Age bands carry a numeric range so age-based event filtering keeps working.
 * UTR, Level and Class are labels only and are stored in
 * `EventGroup.valueLabel`.
 */
export const GROUP_CRITERIA_PRESETS = [
  { criteria: 'Default', label: 'Default', min: null, max: null },

  { criteria: 'Age', label: '6-12', min: 6, max: 12 },
  { criteria: 'Age', label: '13-19', min: 13, max: 19 },
  { criteria: 'Age', label: '20+', min: 20, max: 120 },

  { criteria: 'UTR', label: '1.0-4.0', min: null, max: null },
  { criteria: 'UTR', label: '4.1-8.0', min: null, max: null },
  { criteria: 'UTR', label: '8.1-12', min: null, max: null },
  { criteria: 'UTR', label: '12.1-16', min: null, max: null },

  { criteria: 'Level', label: 'Begineer', min: null, max: null },
  { criteria: 'Level', label: 'Intermediate', min: null, max: null },
  { criteria: 'Level', label: 'Advanced I', min: null, max: null },
  { criteria: 'Level', label: 'Advanced II', min: null, max: null },

  { criteria: 'Class', label: 'Senior master', min: null, max: null },
  { criteria: 'Class', label: 'National master', min: null, max: null },
  { criteria: 'Class', label: 'Expert', min: null, max: null },
  { criteria: 'Class', label: 'Class A', min: null, max: null },
  { criteria: 'Class', label: 'Class B', min: null, max: null },
  { criteria: 'Class', label: 'Class C', min: null, max: null },
  { criteria: 'Class', label: 'Class D', min: null, max: null },
  { criteria: 'Class', label: 'Class E', min: null, max: null },
  { criteria: 'Class', label: 'Class F', min: null, max: null },
  { criteria: 'Class', label: 'Class G', min: null, max: null },
  { criteria: 'Class', label: 'Class H', min: null, max: null },
  { criteria: 'Class', label: 'Class I', min: null, max: null },
  { criteria: 'Class', label: 'Class J', min: null, max: null },
] as const;

export type GroupCriteriaPreset = (typeof GROUP_CRITERIA_PRESETS)[number];

/** Conditions offered in the "Condition" dropdown, in display order. */
export const GROUP_CONDITION_OPTIONS = [
  { value: 'Default', label: 'Default' },
  { value: 'Equal', label: 'Equal' },
  { value: 'UpTo', label: 'Up to' },
  { value: 'Greater', label: 'Greater than' },
  { value: 'GreaterAndEqual', label: 'Greater and equal' },
  { value: 'Lower', label: 'Less than' },
  { value: 'LowerAndEqual', label: 'Less and equal' },
] as const;

/** Criteria that store a preset label rather than a number. */
export const LABEL_BASED_CRITERIA = new Set(['UTR', 'Level', 'Class']);
