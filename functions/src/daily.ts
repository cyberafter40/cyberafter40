import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { deriveDailyChallenge } from '@/daily/challenge';
import { DEFAULT_MODULE_ID } from '@/games';
import { addDays, toDateKey } from '@/utils/date';

/**
 * Daily Challenge provisioning.
 *
 * The puzzle itself does not need a server — it is derived from the date on
 * every device. This job exists so the challenge document is present *before*
 * the first player of the day submits, giving us a stable place to accumulate
 * community statistics and a record of which variant was live on which date.
 *
 * It runs just before midnight UTC and seeds today plus the next two days, so a
 * single failed run cannot leave a gap.
 */
export const provisionDailyChallenges = onSchedule(
  {
    schedule: '55 23 * * *',
    timeZone: 'Etc/UTC',
    region: 'us-central1',
    retryCount: 3,
  },
  async () => {
    const db = getFirestore();
    const today = toDateKey(Date.now());
    let created = 0;

    for (let offset = 0; offset <= 2; offset += 1) {
      const dateKey = addDays(today, offset);
      const ref = db.doc(`challenges/${dateKey}`);

      // Only ever create. Rewriting a live challenge would change the puzzle
      // underneath players who are mid-game.
      const existing = await ref.get();
      if (existing.exists) continue;

      const challenge = deriveDailyChallenge(dateKey, DEFAULT_MODULE_ID);
      await ref.create({
        id: challenge.id,
        date: challenge.date,
        moduleId: challenge.moduleId,
        variantId: challenge.variantId,
        seed: challenge.seed,
        createdAt: Date.now(),
        stats: { played: 0, solved: 0, totalMoves: 0, totalScore: 0 },
      }).catch((error: unknown) => {
        // A concurrent run won the race — harmless.
        logger.debug('Challenge already created', { dateKey, error });
      });
      created += 1;
    }

    logger.info('Provisioned daily challenges', { from: today, created });
  },
);
