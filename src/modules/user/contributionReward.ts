import { UserRepository } from './user.repository';

/** Awards contribution points when the business rule grants a positive score. */
export async function rewardUserContribution(userId: string, points: number): Promise<void> {
  if (points > 0) {
    await UserRepository.incrementContributionScore(userId, points);
  }
}
