import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { deriveDailyChallenge } from '@/daily/challenge';
import { getGameModule } from '@/engine/registry';
import { applyGameResult } from '@/progress/progressEngine';
import { createProfile, type UserProfile } from '@/progress/types';
import { describeLevel } from '@/progress/levels';
import { computeScore } from '@/scoring/scoringEngine';
import { getScoringProfile } from '@/scoring/profiles';
import { toWeekKey } from '@/utils/date';
import { generateDisplayName } from '@/utils/names';
import { validateAndReplay } from './replay';

/**
 * `submitGameResult` — the single authoritative write path for progression.
 *
 * Everything that could be forged is recomputed here: the puzzle is regenerated
 * from its seed, the moves are replayed, the score is derived by the same
 * scoring profile the client used, and progression is folded in by the same
 * pure progress engine. The client's numbers are never trusted; they exist only
 * so the result screen can animate before this call returns.
 *
 * The whole update runs in one transaction so a player who double-taps, retries
 * an offline queue, or plays on two devices can never double-count a session.
 */
export const submitGameResult = onCall(
  { region: 'us-central1', enforceAppCheck: false, maxInstances: 50 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to submit a result.');

    const now = Date.now();
    const { result } = validateAndReplay((request.data as { result?: unknown })?.result, now);

    const db = getFirestore();
    const profileRef = db.doc(`profiles/${uid}`);
    const sessionRef = profileRef.collection('sessions').doc(result.sessionId);
    const dailyRef = result.challengeId
      ? profileRef.collection('dailyEntries').doc(result.challengeId)
      : null;

    const outcome = await db.runTransaction(async (tx) => {
      const [profileSnap, sessionSnap] = await Promise.all([
        tx.get(profileRef),
        tx.get(sessionRef),
      ]);

      // Idempotency: the same session id is never counted twice. Daily session
      // ids are deterministic (`uid_YYYY-MM-DD`), so this also enforces the
      // one-attempt-per-day rule.
      if (sessionSnap.exists) {
        return { duplicate: true as const };
      }

      const profile: UserProfile = profileSnap.exists
        ? (profileSnap.data() as UserProfile)
        : createProfile({
            uid,
            displayName: request.auth?.token.name ?? generateDisplayName(uid),
            isAnonymous: request.auth?.token.firebase?.sign_in_provider === 'anonymous',
            now,
          });

      const module = getGameModule(result.moduleId);
      const score = computeScore(getScoringProfile(module.scoringProfileId), {
        result,
        module: {
          id: module.id,
          basePoints: module.scoring.basePoints,
          difficultyStep: module.scoring.difficultyStep,
        },
        player: {
          level: profile.level,
          currentStreak: profile.streak.current,
          personalBest:
            profile.modules?.[result.moduleId]?.variants?.[result.variantId]?.bestScore ?? null,
        },
      });

      const { profile: nextProfile } = applyGameResult({ profile, result, score, now });

      tx.set(profileRef, nextProfile);

      tx.set(sessionRef, {
        sessionId: result.sessionId,
        uid,
        moduleId: result.moduleId,
        engineVersion: result.engineVersion,
        variantId: result.variantId,
        mode: result.mode,
        challengeId: result.challengeId ?? null,
        seed: result.seed,
        status: result.outcome.status,
        movesUsed: result.outcome.movesUsed,
        maxMoves: result.outcome.maxMoves,
        durationMs: result.outcome.durationMs,
        accuracy: Number(result.outcome.accuracy.toFixed(4)),
        score: score.total,
        xp: score.xp,
        rating: score.rating,
        moveLog: result.moves.map((move) => move.label),
        solution: result.solution,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        createdAt: now,
      });

      if (dailyRef) {
        tx.set(dailyRef, {
          challengeId: result.challengeId,
          uid,
          sessionId: result.sessionId,
          status: result.outcome.status,
          score: score.total,
          xp: score.xp,
          movesUsed: result.outcome.movesUsed,
          maxMoves: result.outcome.maxMoves,
          durationMs: result.outcome.durationMs,
          moveLog: result.moves.map((move) => move.label),
          finishedAt: result.finishedAt,
        });
      }

      /* ---- Denormalised public identity + leaderboards ---- */
      const level = describeLevel(nextProfile.xp);
      const publicSlice = {
        uid,
        displayName: nextProfile.displayName,
        avatarId: nextProfile.avatarId,
        countryCode: nextProfile.countryCode ?? null,
        level: nextProfile.level,
        xp: nextProfile.xp,
        title: level.title,
        currentStreak: nextProfile.streak.current,
        badgeCount: Object.keys(nextProfile.badges).length,
        updatedAt: now,
      };
      tx.set(db.doc(`publicProfiles/${uid}`), publicSlice);

      const identity = {
        uid,
        displayName: nextProfile.displayName,
        avatarId: nextProfile.avatarId,
        countryCode: nextProfile.countryCode ?? null,
        level: nextProfile.level,
        updatedAt: now,
      };

      // All-time board: total XP.
      tx.set(db.doc(`leaderboards/global/entries/${uid}`), {
        ...identity,
        score: nextProfile.xp,
      });

      // Weekly board: XP accumulated this ISO week.
      tx.set(
        db.doc(`leaderboards/${toWeekKey(result.finishedAt)}/entries/${uid}`),
        { ...identity, score: FieldValue.increment(score.xp) },
        { merge: true },
      );

      // Daily board: the score for that day's challenge. Ties break on speed.
      if (result.challengeId && result.mode === 'daily') {
        tx.set(db.doc(`leaderboards/${result.challengeId}/entries/${uid}`), {
          ...identity,
          score: score.total,
          movesUsed: result.outcome.movesUsed,
          durationMs: result.outcome.durationMs,
        });

        // The identity fields are written alongside the stats, not just by the
        // scheduled provisioner. Merging stats alone would create a document
        // with nothing but counters if the first player of the day arrives
        // before `provisionDailyChallenges` has run — and every client reading
        // that document would then find no moduleId.
        const derived = deriveDailyChallenge(result.challengeId, result.moduleId);
        tx.set(
          db.doc(`challenges/${result.challengeId}`),
          {
            id: derived.id,
            date: derived.date,
            moduleId: derived.moduleId,
            variantId: derived.variantId,
            seed: derived.seed,
            stats: {
              played: FieldValue.increment(1),
              solved: FieldValue.increment(result.outcome.status === 'won' ? 1 : 0),
              totalMoves: FieldValue.increment(result.outcome.movesUsed),
              totalScore: FieldValue.increment(score.total),
            },
          },
          { merge: true },
        );
      }

      return { duplicate: false as const, score, level: nextProfile.level, xp: nextProfile.xp };
    });

    if (outcome.duplicate) {
      logger.info('Duplicate submission ignored', { uid, sessionId: result.sessionId });
      return { status: 'duplicate' as const };
    }

    return {
      status: 'recorded' as const,
      score: outcome.score.total,
      xp: outcome.score.xp,
      level: outcome.level,
      totalXp: outcome.xp,
    };
  },
);
