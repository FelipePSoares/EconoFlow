export const ChartColors = {
  income: '#2ecc71',
  incomeAlpha15: 'rgba(46, 204, 113, 0.15)',

  expense: '#ff6b6b',
  expenseAlpha12: 'rgba(255, 107, 107, 0.12)',

  budget: '#5dade2',
  budgetAlpha15: 'rgba(93, 173, 226, 0.15)',

  chartRed: 'rgb(255, 99, 132)',
  chartRedAlpha20: 'rgba(255, 99, 132, 0.2)',
  chartBlue: 'rgb(54, 162, 235)',
  chartBlueAlpha20: 'rgba(54, 162, 235, 0.2)',
  budgetExceeded: 'rgb(255, 0, 0)',

  white: '#ffffff',

  categoryPalette: [
    '#ff6b6b',
    '#4ecdc4',
    '#ffe66d',
    '#5dade2',
    '#f39c12',
    '#9b59b6',
    '#2ecc71',
    '#e74c3c',
    '#1abc9c',
    '#f1c40f'
  ] as string[]
} as const;

export const ThemeColors = {
  lightThemeColor: '#0f76a8',
  darkThemeColor: '#0f1724'
} as const;
