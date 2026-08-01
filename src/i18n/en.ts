/**
 * English catalogue — the source of truth.
 *
 * Every other locale is typed against this object, so a missing or misspelled
 * key is a compile error rather than a blank space in the running app. That is
 * the whole reason this is a plain object literal and not a JSON file: JSON
 * gives no such guarantee.
 *
 * Conventions:
 *  - Keys are `screen.element`, or `common.*` for shared strings.
 *  - `{placeholders}` are interpolated by `t()`.
 *  - A value may be a `{ one, other }` pair for counts; `t()` picks using the
 *    active locale's plural rule, which is not the same in every language.
 */
export const en = {
  nav: {
    play: 'Play',
    ranks: 'Ranks',
    you: 'You',
  },

  common: {
    done: 'Done',
    next: 'Next',
    skip: 'Skip',
    cancel: 'Cancel',
    save: 'Save',
    retry: 'Try again',
    loading: 'Just a moment.',
    streak: 'streak',
    xp: 'XP',
    level: 'Level {level}',
  },

  onboarding: {
    slide1Title: 'A hidden code',
    slide1Body:
      'Every round, MindCode hides a short number. Your job is to work out what it is.',
    slide2Title: 'Every guess tells you something',
    slide2Body:
      'A digit in the right place scores +1. The right digit in the wrong place scores −1. A digit that is not in the code scores nothing.',
    slide3Title: 'Five minutes a day',
    slide3Body:
      'One Daily Challenge, the same code for everyone in the world. Play each day to build a streak, earn XP and climb the ranks.',
    start: 'Start playing',
  },

  home: {
    welcome: 'Welcome',
    dailyChallenge: 'Daily Challenge',
    dailyIntro: 'Everyone in the world gets the same code today. One attempt.',
    dailySpent: 'You have used today’s attempt. The code stays secret until tomorrow.',
    dailySolved: {
      one: 'Solved in {count} guess for {score} points.',
      other: 'Solved in {count} guesses for {score} points.',
    },
    play: 'Play today’s code',
    nextChallenge: 'Next challenge in',
    communityStats: '{played} played · {percent}% solved',
    comingSoon: 'Coming to MindCode',
    comingSoonBody: 'More ways to train, built on the same engine.',
    howToPlay: 'How to play',
    unlocksAtLevel: 'Unlocks at level {level}',
    xpToNextLevel: '{into} / {span} XP to level {level}',
    maxLevel: '{xp} XP · maximum level',
    playVariant: 'Play {module}, {variant}',
  },

  /**
   * Game modules and their variants.
   *
   * The registry holds keys, not prose — a module descriptor is data, and data
   * has no language. Adding a training module adds entries here.
   */
  modules: {
    numberLogic: 'Number Logic',
    numberLogicTagline: 'Crack the hidden code.',
    memoryGrid: 'Memory Grid',
    memoryGridTagline: 'Hold the pattern, then rebuild it.',
    patternSense: 'Pattern Sense',
    patternSenseTagline: 'Find the rule, predict what comes next.',
    reactionLab: 'Reaction Lab',
    reactionLabTagline: 'Measure how fast your decisions actually are.',
    deductionRoom: 'Deduction Room',
    deductionRoomTagline: 'Short logic puzzles with one consistent answer.',
  },

  variants: {
    twoDigit: 'Two Digits',
    twoDigitSubtitle: 'A gentle warm-up. 6 guesses.',
    threeDigit: 'Three Digits',
    threeDigitSubtitle: 'The classic. 8 guesses.',
    fourDigit: 'Four Digits',
    fourDigitSubtitle: 'Serious deduction. 10 guesses.',
    memoryShort: 'Four Tiles',
    memoryShortSubtitle: 'A gentle warm-up. 3×3 grid.',
    memoryStandard: 'Six Tiles',
    memoryStandardSubtitle: 'Past the span most people hold. 3×3 grid.',
    memoryLong: 'Nine Tiles',
    memoryLongSubtitle: 'Serious recall. 4×4 grid.',
    sequence: 'Sequence',
    sequenceSubtitle: 'Numeric and visual progressions.',
    goNoGo: 'Go / No-Go',
    goNoGoSubtitle: 'Respond to the right signal, ignore the rest.',
    constraints: 'Constraints',
    constraintsSubtitle: 'Eliminate the impossible.',
  },

  policy: {
    plusMinus: 'Plus / Minus',
    plusMinusBody: 'Right place +1, right digit wrong place −1, wrong digit 0.',
    positive: 'Positive',
    positiveBody: 'Right place +2, right digit wrong place +1, wrong digit 0.',
    strict: 'Strict',
    strictBody: 'Only exact positions count. Misplaced digits tell you nothing.',
    legendExact: 'Correct digit, correct position',
    legendMisplaced: 'Correct digit, wrong position',
    legendAbsent: 'Digit is not in the code',
    legendNone: 'No information given',
  },

  game: {
    leave: 'Leave game',
    leaveTitle: 'Leave this game?',
    leaveDaily: 'Your one attempt at today’s challenge will be recorded as unfinished.',
    leaveClassic: 'This game will be recorded as unfinished.',
    keepPlaying: 'Keep playing',
    leaveConfirm: 'Leave',
    scoring: 'Scoring…',
  },

  numberLogic: {
    check: 'Check',
    guessesLeft: {
      one: '{count} guess left · {policy}',
      other: '{count} guesses left · {policy}',
    },
    emptyHint: 'Enter any {digits}-digit code to begin.\nEvery answer narrows it down.',
    candidatesLeft: '{count} left',
    errorMalformed: 'Enter {digits} digits.',
    errorDuplicate: 'You already tried that code.',
    errorGameOver: 'This game has already finished.',
    errorRejected: 'That move is not allowed.',
  },

  memoryGrid: {
    watch: 'Watch',
    recall: 'Repeat it',
    done: 'Done',
    watchHint: {
      one: '{count} tile, in order',
      other: '{count} tiles, in order',
    },
    progress: {
      one: '{recalled} of {total} · {count} mistake left',
      other: '{recalled} of {total} · {count} mistakes left',
    },
    recallHint: 'Tap the tiles in the order they lit up.',
    tile: 'Tile {number}',
    errorOutOfRange: 'That tile is not on the grid.',
  },

  result: {
    codeWas: 'The code was',
    score: 'Score',
    xpEarned: 'XP earned',
    guesses: 'Guesses',
    time: 'Time',
    howItScored: 'How it scored',
    personalBest: '🏅 Personal best',
    personalBestBody: 'Your highest score yet on {variant}.',
    levelUp: 'Level {level} — {title}',
    levelUpBody: 'A new rank. Harder variants unlock as you climb.',
    streak: '🔥 {count}-day streak',
    streakBody: 'Come back tomorrow to keep it alive.',
    badge: '🏆 {title}',
    share: 'Share result',
    notSynced: 'Saved on this device — it will sync when you are back online.',
    rejected:
      'This game could not be recorded, so it will not count towards your progress. Nothing to retry — sorry.',
  },

  rating: {
    flawlessTitle: 'Flawless',
    flawlessBody: 'Straight to the answer.',
    excellentTitle: 'Excellent',
    excellentBody: 'Sharp deduction — barely a wasted move.',
    solidTitle: 'Solid',
    solidBody: 'Clean logic, steady pace.',
    scrapedTitle: 'Got there',
    scrapedBody: 'Close call. Tomorrow will feel easier.',
    failedTitle: 'Not this time',
    failedBody: 'The pattern is clearer than it looks.',
  },

  scoring: {
    base: 'Solved',
    baseDetail: '{difficulty}★ difficulty',
    participation: 'Attempt',
    participationDetail: 'Every attempt trains the pattern',
    efficiency: 'Efficiency',
    efficiencyDetail: {
      one: '{count} attempt to spare',
      other: '{count} attempts to spare',
    },
    deduction: 'Deduction',
    deductionDetail: '{percent}% information per guess',
    firstTry: 'First try',
    firstTryDetail: 'Called it immediately',
    speed: 'Speed',
    speedDetail: '{seconds}s (par {par}s)',
    daily: 'Daily Challenge',
    dailyDetail: 'Same puzzle for everyone today',
    streak: 'Streak',
    streakDetail: '{count}-day streak',
  },

  profile: {
    loading: 'Loading profile',
    modeDaily: 'Daily',
    modeClassic: 'Classic',
    createAccount: 'Create an account to save progress',
    statistics: 'Statistics',
    gamesPlayed: 'Games played',
    gamesSolved: '{count} solved',
    winRate: 'Win rate',
    averageScore: 'Average score',
    bestScore: 'Best score',
    averageGuesses: 'Avg. guesses',
    totalAttempts: '{count} total attempts',
    averageTime: 'Avg. time',
    currentStreak: 'Current streak',
    longestStreak: 'longest {count}',
    dailyChallenges: 'Daily challenges',
    badges: 'Badges',
    badgesUnlocked: '{unlocked} of {total} unlocked',
    byVariant: 'By variant',
    variantRecord: '{won}/{played} solved',
    variantBest: ' · best {count} guesses',
    noRecord: 'Play a game to start building your record.',
    recentGames: 'Recent games',
    noRecentGames: 'Your last games will appear here once they sync.',
    settings: 'Settings',
    nextRank: '{xp} XP to level {level} · {title} at level {rankLevel}',
    nextLevel: '{xp} XP to level {level}',
    maxRank: 'You have reached the highest rank.',
  },

  leaderboard: {
    title: 'Leaderboard',
    rankedBy: 'Ranked by {metric}.',
    today: 'Today',
    thisWeek: 'This week',
    allTime: 'All time',
    metricScore: 'score',
    metricXp: 'XP',
    yourPosition: 'Your position',
    emptyTitle: 'Be the first',
    emptyDaily: 'No one has finished today’s challenge yet. Play it and take the top spot.',
    emptyOther: 'Scores will appear here as players complete games.',
    errorTitle: 'Nothing to show',
    errorBody: 'Could not load the leaderboard. Pull to retry.',
    guesses: {
      one: '{count} guess',
      other: '{count} guesses',
    },
  },

  badges: {
    title: 'Badges',
    unlockedCount: '{unlocked} of {total} unlocked',
    hidden: 'Hidden',
    hiddenBody: 'Keep playing to reveal',
  },

  /** One title + one body per badge in `src/progress/badges.ts`. */
  badge: {
    firstLight: 'First Light',
    firstLightBody: 'Complete your first game.',
    cleanRead: 'Clean Read',
    cleanReadBody: 'Solve a code on your very first guess.',
    efficientMind: 'Efficient Mind',
    efficientMindBody: 'Win using no more than half of your guesses.',
    deepEnd: 'The Deep End',
    deepEndBody: 'Solve a three-digit code.',
    fourDimensional: 'Four Dimensional',
    fourDimensionalBody: 'Solve a four-digit code.',
    totalRecall: 'Total Recall',
    totalRecallBody: 'Rebuild a memory sequence without a single mistake.',
    polymath: 'Polymath',
    polymathBody: 'Win a game in two different training modules.',
    streak3: 'Warming Up',
    streak3Body: 'Play three days in a row.',
    streak7: 'Seven Straight',
    streak7Body: 'Keep a seven-day streak.',
    streak30: 'Unbroken',
    streak30Body: 'Keep a thirty-day streak.',
    daily10: 'Regular',
    daily10Body: 'Complete ten Daily Challenges.',
    daily100: 'Devoted',
    daily100Body: 'Complete one hundred Daily Challenges.',
    centurion: 'Centurion',
    centurionBody: 'Play one hundred games.',
    level10: 'Logic Explorer',
    level10Body: 'Reach level 10.',
    level25: 'Cipher Adept',
    level25Body: 'Reach level 25.',
    level50: 'Mind Master',
    level50Body: 'Reach level 50.',
    quickThinker: 'Quick Thinker',
    quickThinkerBody: 'Solve a code in under twenty seconds.',
    winRun10: 'On A Roll',
    winRun10Body: 'Win ten games in a row.',
    nightOwl: 'Night Owl',
    nightOwlBody: 'Finish a game between midnight and 5am.',
    earlyBird: 'Early Bird',
    earlyBirdBody: 'Finish a game before 7am.',
    comeback: 'Comeback',
    comebackBody: 'Win a game right after losing one.',
  },

  /** Level titles. The brief names three of these explicitly. */
  rank: {
    beginner: 'Beginner',
    curiousMind: 'Curious Mind',
    patternSeeker: 'Pattern Seeker',
    deductor: 'Deductor',
    logicExplorer: 'Logic Explorer',
    codebreaker: 'Codebreaker',
    analyst: 'Analyst',
    strategist: 'Strategist',
    cipherAdept: 'Cipher Adept',
    mindArchitect: 'Mind Architect',
    grandmaster: 'Grandmaster of Logic',
    cognitiveElite: 'Cognitive Elite',
    oracle: 'Oracle',
    mindMaster: 'Mind Master',
  },

  settings: {
    title: 'Settings',
    profile: 'Profile',
    displayName: 'Display name',
    saveName: 'Save name',
    avatar: 'Avatar',
    preferences: 'Preferences',
    haptics: 'Haptics',
    hapticsHint: 'Subtle feedback on taps and results.',
    reducedMotion: 'Reduced motion',
    reducedMotionHint: 'Minimise animations across the app.',
    dailyReminder: 'Daily reminder',
    dailyReminderHint: 'A single nudge if your streak is at risk.',
    language: 'Language',
    languageSystem: 'Match device',
    account: 'Account',
    guest: 'Playing as a guest',
    localOnly: 'Progress lives on this device only.',
    synced: 'Progress is synced to your account.',
    signOut: 'Sign out',
    deleteAccount: 'Delete account',
    deleteTitle: 'Delete account',
    deleteBody:
      'This permanently removes your profile, statistics, badges and leaderboard entries. It cannot be undone.',
    deleteConfirm: 'Delete',
    deleteFailedTitle: 'Could not delete',
    deleteFailedBody:
      'Please sign in again and retry — deleting an account requires a recent sign-in.',
    about: 'About',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    support: 'Contact support',
    version: 'MindCode {version}',
    checkName: 'Check that name',
  },

  auth: {
    signUpTitle: 'Keep your progress',
    signUpBody:
      'Your streak, XP and badges stay on this device unless you create an account. Everything you have already earned carries over.',
    signInTitle: 'Welcome back',
    signInBody: 'Sign in to restore your streak, XP and badges.',
    displayName: 'Display name',
    displayNamePlaceholder: 'Shown on leaderboards',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    createAccount: 'Create account',
    signIn: 'Sign in',
    haveAccount: 'I already have an account',
    noAccount: 'Create an account instead',
    forgotPassword: 'Forgot password',
    resetSent: 'Check your inbox for a reset link.',
    enterEmailFirst: 'Enter your email first.',
  },

  authError: {
    invalidEmail: 'That email address does not look right.',
    emailInUse: 'An account already exists for that email.',
    weakPassword: 'Choose a password of at least 6 characters.',
    wrongCredentials: 'Email or password is incorrect.',
    tooManyRequests: 'Too many attempts. Try again in a few minutes.',
    networkFailed: 'No connection. Your progress is saved on this device.',
    recentLogin: 'Please sign in again before deleting your account.',
    generic: 'Something went wrong. Please try again.',
    nameTooShort: 'Pick a name with at least 2 characters.',
    nameTooLong: 'Keep it under {max} characters.',
  },

  howToPlay: {
    title: 'How to play',
    intro:
      'A code is hidden. Guess it. Every guess comes back as a single number that tells you how close you were.',
    scoringTitle: 'Scoring — {policy}',
    ambiguity:
      'The number you see is the total. That total can be ambiguous — and working out which combination produced it is the game.',
    exampleTitle: 'Example — the code is 82',
    example1: 'Neither digit appears in the code.',
    example2: 'Both digits are correct, but both are in the wrong place.',
    example3: 'Both digits correct, both in the right place. Solved.',
    dailyTitle: 'The Daily Challenge',
    dailyBody:
      'One code a day, the same for every player in the world, one attempt. It resets at midnight UTC. Play any day to keep your streak alive — solving is worth more, but showing up is what counts.',
    tipTitle: 'A tip',
    tipBody:
      'A guess that rules out possibilities is worth more than a guess that might be lucky. The counter beside each row shows how many codes are still consistent with everything you know.',
    memoryTitle: 'Memory Grid',
    memoryBody:
      'Tiles light up one at a time. Watch the order, then tap them back in the same sequence. A wrong tap costs a mistake but does not lose your progress.',
  },

  errorBoundary: {
    title: 'Something broke',
    body: 'Your progress is safe. Tap below to reload the app.',
    reload: 'Reload',
  },

  a11y: {
    emptyCode: 'Empty code, {digits} digits',
    enteredCode: 'Entered {digits}',
    guessRow: 'Guess {index}, {guess}, result {result}',
    levelProgress: 'Level {level} progress',
    badgeUnlocked: '{title}, unlocked. {description}',
    badgeLocked: '{title}, locked. {description}',
    badgeHidden: 'Hidden badge, not yet unlocked',
    leaderboardRow: 'Rank {rank}, {name}, {score} {metric}',
    leaderboardRowNoRank: '{name}, {score} {metric}',
    statTile: '{label}: {value}',
    statTileWithHint: '{label}: {value}, {hint}',
    avatarOption: 'Avatar {number}',
  },

  unavailable: {
    title: 'Not ready yet',
    body: 'This training module is on the roadmap. Its engine has not shipped in this build.',
  },
} as const;

export type TranslationCatalogue = typeof en;
