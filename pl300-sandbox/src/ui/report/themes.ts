export const THEMES: Record<string, { colors: string[]; bg?: string; fg?: string }> = {
  Default: { colors: ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550', '#197278', '#1AAB40', '#15C6F4', '#4092FF'] },
  Innovate: { colors: ['#2CBFC8', '#8D6FD1', '#F5C869', '#EE9E64', '#7FBA00', '#D45E90', '#00B294', '#E8467C'] },
  Executive: { colors: ['#3257A8', '#37A794', '#8B3D88', '#DD6B7F', '#6B91C9', '#F5C869', '#77C4A8', '#DEA6CF'] },
  Frontier: { colors: ['#936437', '#FFA500', '#B1C49B', '#4B6F5E', '#FFD23F', '#CC7A00', '#7B9E89', '#C89666'] },
  Tidal: { colors: ['#094782', '#0B72D7', '#098BF5', '#54B5FB', '#71C0A7', '#57B956', '#478F48', '#326633'] },
  'Color-blind safe': { colors: ['#074650', '#009292', '#FE6DB6', '#FEB5DA', '#480091', '#B66DFF', '#B5DAFE', '#6DB6FF'] },
  Highrise: { colors: ['#B73A3A', '#EC5656', '#F28A90', '#F8BCBD', '#99E472', '#23C26F', '#0AAC00', '#026645'] },
};
export const themeColors = (name: string) => (THEMES[name] ?? THEMES.Default).colors;
