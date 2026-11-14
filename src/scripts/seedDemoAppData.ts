/**
 * Demo seed for app QA (idempotent).
 *
 * Creates 10 users (password: 1qazxsw2) plus rich related data.
 * Wired into server startup so production pull + restart inserts data.
 * After QA: delete this file AND remove the call from `src/server.ts`.
 */
import bcrypt from 'bcryptjs';
import colors from 'colors';
import {
  CompetitionLevel,
  ConnectionStatus,
  DonationPaymentStatus,
  DonationProvider,
  DonationType,
  EventType,
  FamilyRelationShip,
  FamilyRole,
  GroupCriteria,
  InvitationStatus,
  NotificationMedium,
  NotificationType,
  PlacementType,
  RoundCondition,
  UserFeedbackCategory,
  UserGender,
  UserRole,
  UserStatus,
} from '../../prisma/generated/enums';
import { closeDB, connectDB, database } from '../config/database';
import logger from '../config/logger';
import { createUniqueAccountId } from '../modules/user/user.helpers';
import { getDefaultProfilePictureUrl } from '../utils/s3Upload';


const DEMO_PASSWORD = '1qazxsw2';
const DEMO_TAG = 'demo-seed-v1';
const ITEMS_PER_USER = 10;

type DemoUserDef = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  gender: UserGender;
  birthDate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  skills: string[];
};

const demoUsers: DemoUserDef[] = [
  {
    firstName: 'Aria',
    lastName: 'Chen',
    username: 'demo.aria.chen',
    email: 'demo.aria.chen@gezhi.test',
    phoneNumber: '+8801811001001',
    gender: UserGender.FEMALE,
    birthDate: '1994-02-11',
    location: 'Gulshan, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['piano', 'choir'],
  },
  {
    firstName: 'Ben',
    lastName: 'Nguyen',
    username: 'demo.ben.nguyen',
    email: 'demo.ben.nguyen@gezhi.test',
    phoneNumber: '+8801811001002',
    gender: UserGender.MALE,
    birthDate: '1993-05-22',
    location: 'Banani, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['soccer', 'coaching'],
  },
  {
    firstName: 'Chloe',
    lastName: 'Park',
    username: 'demo.chloe.park',
    email: 'demo.chloe.park@gezhi.test',
    phoneNumber: '+8801811001003',
    gender: UserGender.FEMALE,
    birthDate: '1996-08-03',
    location: 'Dhanmondi, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['ballet', 'yoga'],
  },
  {
    firstName: 'Diego',
    lastName: 'Santos',
    username: 'demo.diego.santos',
    email: 'demo.diego.santos@gezhi.test',
    phoneNumber: '+8801811001004',
    gender: UserGender.MALE,
    birthDate: '1995-01-17',
    location: 'Uttara, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['robotics', 'math'],
  },
  {
    firstName: 'Elena',
    lastName: 'Rossi',
    username: 'demo.elena.rossi',
    email: 'demo.elena.rossi@gezhi.test',
    phoneNumber: '+8801811001005',
    gender: UserGender.FEMALE,
    birthDate: '1997-11-09',
    location: 'Mirpur, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['painting', 'design'],
  },
  {
    firstName: 'Farid',
    lastName: 'Hassan',
    username: 'demo.farid.hassan',
    email: 'demo.farid.hassan@gezhi.test',
    phoneNumber: '+8801811001006',
    gender: UserGender.MALE,
    birthDate: '1992-07-28',
    location: 'Agrabad, Chattogram',
    country: 'Bangladesh',
    state: 'Chattogram',
    city: 'Chattogram',
    skills: ['swimming', 'lifeguard'],
  },
  {
    firstName: 'Grace',
    lastName: 'Kim',
    username: 'demo.grace.kim',
    email: 'demo.grace.kim@gezhi.test',
    phoneNumber: '+8801811001007',
    gender: UserGender.FEMALE,
    birthDate: '1998-03-14',
    location: 'GEC, Chattogram',
    country: 'Bangladesh',
    state: 'Chattogram',
    city: 'Chattogram',
    skills: ['violin', 'orchestra'],
  },
  {
    firstName: 'Hassan',
    lastName: 'Ali',
    username: 'demo.hassan.ali',
    email: 'demo.hassan.ali@gezhi.test',
    phoneNumber: '+8801811001008',
    gender: UserGender.MALE,
    birthDate: '1991-09-05',
    location: 'Zindabazar, Sylhet',
    country: 'Bangladesh',
    state: 'Sylhet',
    city: 'Sylhet',
    skills: ['debate', 'public-speaking'],
  },
  {
    firstName: 'Ivy',
    lastName: 'Wong',
    username: 'demo.ivy.wong',
    email: 'demo.ivy.wong@gezhi.test',
    phoneNumber: '+8801811001009',
    gender: UserGender.FEMALE,
    birthDate: '1999-12-21',
    location: 'Boyra, Khulna',
    country: 'Bangladesh',
    state: 'Khulna',
    city: 'Khulna',
    skills: ['coding', 'chess'],
  },
  {
    firstName: 'Jamal',
    lastName: 'Rahman',
    username: 'demo.jamal.rahman',
    email: 'demo.jamal.rahman@gezhi.test',
    phoneNumber: '+8801811001010',
    gender: UserGender.MALE,
    birthDate: '1990-04-30',
    location: 'Rajshahi Sadar, Rajshahi',
    country: 'Bangladesh',
    state: 'Rajshahi',
    city: 'Rajshahi',
    skills: ['basketball', 'mentoring'],
  },
];

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

type SeededUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  city: string;
};

const ensureUsers = async (): Promise<SeededUser[]> => {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
  const profilePicture = getDefaultProfilePictureUrl();
  const users: SeededUser[] = [];

  for (const def of demoUsers) {
    const existing = await database.user.findFirst({
      where: { email: def.email },
      select: { id: true },
    });

    if (existing) {
      await database.user.update({
        where: { id: existing.id },
        data: {
          password: hashed,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          role: UserRole.USER,
          firstName: def.firstName,
          lastName: def.lastName,
          displayName: `${def.firstName} ${def.lastName}`,
          username: def.username,
          phoneNumber: def.phoneNumber,
          location: def.location,
          country: def.country,
          state: def.state,
          city: def.city,
          skills: def.skills,
        },
      });
      users.push({
        id: existing.id,
        email: def.email,
        username: def.username,
        firstName: def.firstName,
        lastName: def.lastName,
        city: def.city,
      });
      continue;
    }

    const accountId = await createUniqueAccountId();
    const created = await database.user.create({
      data: {
        accountId,
        firstName: def.firstName,
        lastName: def.lastName,
        displayName: `${def.firstName} ${def.lastName}`,
        username: def.username,
        email: def.email,
        password: hashed,
        phoneNumber: def.phoneNumber,
        gender: def.gender,
        birthDate: new Date(`${def.birthDate}T00:00:00.000Z`),
        profilePicture,
        location: def.location,
        country: def.country,
        state: def.state,
        city: def.city,
        skills: def.skills,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        hasSeparateAccount: true,
      },
      select: { id: true, email: true, username: true, firstName: true, lastName: true, city: true },
    });
    users.push(created);
  }

  return users;
};

const seedForUser = async (
  user: SeededUser,
  allUsers: SeededUser[],
  programs: { id: string; name: string; imageUrl: string | null }[],
  coverFallback: string
) => {
  const others = allUsers.filter(u => u.id !== user.id);
  const familyName = `${user.firstName} Family (${DEMO_TAG})`;

  let family = await database.family.findFirst({
    where: { name: familyName, createdBy: user.id },
  });

  if (!family) {
    family = await database.family.create({
      data: {
        name: familyName,
        description: `Demo family for ${user.firstName} — ${DEMO_TAG}`,
        imageUrl: coverFallback,
        createdBy: user.id,
        familyMembers: {
          create: [
            { userId: user.id, role: FamilyRole.OWNER, relationShip: FamilyRelationShip.Self },
            ...others.slice(0, 3).map((member, index) => ({
              userId: member.id,
              role: FamilyRole.MEMBER,
              relationShip:
                index === 0
                  ? FamilyRelationShip.Spous
                  : index === 1
                    ? FamilyRelationShip.ChildStephanie
                    : FamilyRelationShip.Other,
            })),
          ],
        },
      },
    });
  }

  await database.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  // Connections (up to ITEMS_PER_USER unique pairs involving this user as requester)
  for (let i = 0; i < Math.min(ITEMS_PER_USER, others.length); i += 1) {
    const receiver = others[i];
    const status =
      i % 3 === 0
        ? ConnectionStatus.ACCEPTED
        : i % 3 === 1
          ? ConnectionStatus.PENDING
          : ConnectionStatus.ACCEPTED;

    await database.connection.upsert({
      where: {
        requesterId_receiverId: { requesterId: user.id, receiverId: receiver.id },
      },
      create: {
        requesterId: user.id,
        receiverId: receiver.id,
        status,
      },
      update: { status },
    });
  }

  const createdEventIds: string[] = [];

  for (let i = 0; i < ITEMS_PER_USER; i += 1) {
    const program = programs[i % programs.length];
    const eventName = `${DEMO_TAG} · ${user.firstName} Event ${i + 1}`;
    const existingEvent = await database.event.findFirst({
      where: { eventName, creatorId: user.id },
      select: { id: true },
    });

    if (existingEvent) {
      createdEventIds.push(existingEvent.id);
      continue;
    }

    const registrationDate = daysFromNow(i - 5);
    const deadline = daysFromNow(i + 10);
    const coverImage = program.imageUrl || coverFallback;

    const event = await database.event.create({
      data: {
        eventName,
        baseEventName: eventName,
        eventYear: String(new Date().getFullYear()),
        scheduleLabel: `Demo-${i + 1}`,
        coverImage,
        programId: program.id,
        organizer: `${user.firstName} ${user.lastName}`,
        location: `${user.firstName} Community Center`,
        eventPortal: 'https://sabbir2001.ssh.bd',
        registrationPortal: 'https://sabbir2001.ssh.bd',
        description: `${DEMO_TAG} demo event #${i + 1} for ${user.firstName}. Full schedule, groups, and rounds included for QA.`,
        note: DEMO_TAG,
        creatorId: user.id,
        lastEditorId: user.id,
        isPublished: true,
        isActive: true,
        isVerified: i % 2 === 0,
        isSharedToCommunity: true,
        isUserAgreementAccepted: true,
        schedule: {
          create: {
            // Live DB still uses CompetitionLevel enum on this column.
            competitionLevel: [
              CompetitionLevel.Preliminary,
              CompetitionLevel.SemiFinal,
              CompetitionLevel.Final,
              CompetitionLevel.Preliminary,
            ][i % 4],
            eventType: [EventType.Onsite, EventType.Online, EventType.Hybrid][i % 3],
            registrationDate,
            deadline,
            cost: 25 + i * 5,
            hasFinalDeadline: i % 2 === 0,
            finalDeadline: i % 2 === 0 ? daysFromNow(i + 15) : null,
            lateFee: i % 2 === 0 ? 10 : 0,
          },
        },
        groups: {
          create: [
            {
              name: 'Open Division',
              criteria: GroupCriteria.Age,
              condition: RoundCondition.UpTo,
              value: 18,
              rounds: {
                create: [
                  {
                    roundType: CompetitionLevel.Preliminary,
                    deadline: daysFromNow(i + 7),
                    cost: 10,
                    description: 'Demo preliminary round',
                  },
                  {
                    roundType: CompetitionLevel.Final,
                    deadline: daysFromNow(i + 12),
                    cost: 15,
                    description: 'Demo final round',
                  },
                ],
              },
            },
          ],
        },
        results:
          i % 3 === 0
            ? {
                create: [
                  { placement: PlacementType.First, note: 'Demo gold' },
                  { placement: PlacementType.Second, note: 'Demo silver' },
                ],
              }
            : undefined,
      },
      select: { id: true },
    });

    createdEventIds.push(event.id);
  }

  // Home events
  for (let i = 0; i < ITEMS_PER_USER; i += 1) {
    const title = `${DEMO_TAG} · ${user.firstName} Home ${i + 1}`;
    const existing = await database.homeEvent.findFirst({
      where: { title, createdById: user.id },
      select: { id: true },
    });
    if (existing) continue;

    const startsAt = daysFromNow(i + 1);
    const endsAt = new Date(startsAt);
    endsAt.setUTCHours(endsAt.getUTCHours() + 2);

    await database.homeEvent.create({
      data: {
        title,
        location: `${user.city} Park ${i + 1}`,
        startsAt,
        endsAt,
        url: 'https://sabbir2001.ssh.bd',
        note: DEMO_TAG,
        member: others[i % others.length]?.firstName ?? 'Family',
        createdById: user.id,
      },
    });
  }

  // Notifications
  for (let i = 0; i < ITEMS_PER_USER; i += 1) {
    const title = `${DEMO_TAG} notice ${i + 1} for ${user.firstName}`;
    const existing = await database.notification.findFirst({
      where: { recipientId: user.id, title },
      select: { id: true },
    });
    if (existing) continue;

    const sender = others[i % others.length];
    await database.notification.create({
      data: {
        recipientId: user.id,
        senderId: sender?.id,
        type: [NotificationType.System, NotificationType.Event, NotificationType.EventInvitation][
          i % 3
        ],
        medium: [NotificationMedium.InApp, NotificationMedium.Push],
        title,
        message: `Demo notification #${i + 1} — open the app and verify inbox flows.`,
        linkType: 'event',
        linkId: createdEventIds[i % createdEventIds.length],
        isRead: i % 4 === 0,
        data: { seed: DEMO_TAG },
      },
    });
  }

  // Feedbacks
  for (let i = 0; i < ITEMS_PER_USER; i += 1) {
    const message = `${DEMO_TAG} feedback #${i + 1} from ${user.email}`;
    const existing = await database.userFeedback.findFirst({
      where: { userId: user.id, message },
      select: { id: true },
    });
    if (existing) continue;

    await database.userFeedback.create({
      data: {
        userId: user.id,
        subject: `Demo feedback ${i + 1}`,
        message,
        category: [
          UserFeedbackCategory.GENERAL,
          UserFeedbackCategory.BUG_REPORT,
          UserFeedbackCategory.FEATURE_REQUEST,
          UserFeedbackCategory.OTHER,
        ][i % 4],
      },
    });
  }

  // Donations
  for (let i = 0; i < ITEMS_PER_USER; i += 1) {
    const note = `${DEMO_TAG} donation #${i + 1} ${user.email}`;
    const existing = await database.donationTransaction.findFirst({
      where: { userId: user.id, note },
      select: { id: true },
    });
    if (existing) continue;

    await database.donationTransaction.create({
      data: {
        userId: user.id,
        provider: [DonationProvider.Stripe, DonationProvider.Apple, DonationProvider.Google][i % 3],
        providerTransactionId: `demo_${user.id.slice(0, 8)}_${i + 1}`,
        donationType: i % 2 === 0 ? DonationType.OneTime : DonationType.Monthly,
        amount: 5 + i * 3,
        currency: 'USD',
        note,
        paymentStatus:
          i % 3 === 0
            ? DonationPaymentStatus.Succeeded
            : i % 3 === 1
              ? DonationPaymentStatus.Pending
              : DonationPaymentStatus.Failed,
        verifiedAt: i % 3 === 0 ? new Date() : null,
        rawPayload: { seed: DEMO_TAG },
      },
    });
  }

  // Event applications + invitations on this user's events
  for (let i = 0; i < Math.min(ITEMS_PER_USER, createdEventIds.length); i += 1) {
    const eventId = createdEventIds[i];
    const applicant = others[i % others.length];
    if (!applicant) continue;

    await database.eventApplied.upsert({
      where: { userId_eventId: { userId: applicant.id, eventId } },
      create: {
        userId: applicant.id,
        eventId,
        note: `${DEMO_TAG} application`,
      },
      update: { note: `${DEMO_TAG} application` },
    });

    const invitee = others[(i + 1) % others.length];
    if (!invitee) continue;

    const existingInvite = await database.eventInvitation.findFirst({
      where: { eventId, inviterId: user.id, inviteeId: invitee.id },
      select: { id: true },
    });
    if (!existingInvite) {
      await database.eventInvitation.create({
        data: {
          eventId,
          inviterId: user.id,
          inviteeId: invitee.id,
          message: `${DEMO_TAG} invitation`,
          status: i % 2 === 0 ? InvitationStatus.PENDING : InvitationStatus.ACCEPTED,
          respondedAt: i % 2 === 0 ? null : new Date(),
        },
      });
    }
  }

  return { familyId: family.id, events: createdEventIds.length };
};

/** Idempotent — safe on every server restart until this file is removed. */
export const seedDemoAppData = async (): Promise<void> => {
  logger.info(colors.cyan('🧪 Seeding demo app data (10 users + rich content)...'));

  const programs = await database.program.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, imageUrl: true },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });

  if (programs.length === 0) {
    throw new Error('No programs found. Seed the reference catalog first.');
  }

  const categoryWithImage = await database.category.findFirst({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  const coverFallback = categoryWithImage?.imageUrl || getDefaultProfilePictureUrl();

  const users = await ensureUsers();
  logger.info(colors.green(`   Demo users ready: ${users.length} (password: ${DEMO_PASSWORD})`));

  for (const user of users) {
    const summary = await seedForUser(user, users, programs, coverFallback);
    logger.info(
      colors.green(
        `   ✓ ${user.email} → family + ${summary.events} events + home/notif/feedback/donation/apps`
      )
    );
  }

  logger.info(colors.green('   ✅ Demo app data seed complete'));
  logger.info(colors.cyan(`   Login: demo.*@gezhi.test / ${DEMO_PASSWORD}`));
};

const runCli = async () => {
  try {
    await connectDB();
    await seedDemoAppData();
    process.exit(0);
  } catch (error) {
    logger.error(colors.red('Demo seed failed'), error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

if (require.main === module) {
  void runCli();
}
