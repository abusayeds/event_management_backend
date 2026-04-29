import bcrypt from 'bcryptjs';
import colors from 'colors';
import { UserGender, UserRole } from '../../prisma/generated/enums';
import { database } from '../config/database';
import logger from '../config/logger';
import { createUniqueAccountId } from '../modules/user/user.helpers';

type SeedUser = {
  firstName: string;
  lastName: string;
  displayName: string;
  username: string;
  email: string;
  phoneNumber: string;
  gender: UserGender;
  birthDate: string;
  location: string;
  hasSeparateAccount: boolean;
  country: string;
  state: string;
  city: string;
  skills: string[];
  role?: UserRole;
};

const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const userPassword = process.env.SEED_USER_PASSWORD || 'User@12345';

const seedUsers: SeedUser[] = [
  {
    firstName: 'Rakibul',
    lastName: 'Hasan',
    displayName: 'Rakib Hasan',
    username: 'rakib.hasan.admin',
    email: 'rakib.hasan.admin@gmail.com',
    phoneNumber: '+8801711000001',
    gender: UserGender.MALE,
    birthDate: '1992-06-12',
    location: 'Banani, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    hasSeparateAccount: true,
    skills: ['leadership', 'project-management', 'event-planning'],
    role: UserRole.ADMIN,
  },
  {
    firstName: 'Sadia',
    lastName: 'Afrin',
    displayName: 'Sadia Afrin',
    username: 'sadia.afrin',
    email: 'sadia.afrin01@gmail.com',
    phoneNumber: '+8801711000002',
    gender: UserGender.FEMALE,
    birthDate: '1998-03-08',
    hasSeparateAccount: true,
    location: 'Dhanmondi, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    skills: ['design', 'event-hosting'],
  },
  {
    firstName: 'Tanvir',
    lastName: 'Ahmed',
    displayName: 'Tanvir Ahmed',
    username: 'tanvir.ahmed',
    email: 'tanvir.ahmed02@gmail.com',
    phoneNumber: '+8801711000003',
    gender: UserGender.MALE,
    birthDate: '1997-09-16',
    location: 'Khulshi, Chattogram',
    country: 'Bangladesh',
    state: 'Chattogram',
    city: 'Chattogram',
    hasSeparateAccount: true,
    skills: ['marketing', 'sponsorship'],
  },
  {
    firstName: 'Nusrat',
    lastName: 'Jahan',
    displayName: 'Nusrat Jahan',
    username: 'nusrat.jahan',
    email: 'nusrat.jahan03@gmail.com',
    phoneNumber: '+8801711000004',
    gender: UserGender.FEMALE,
    birthDate: '1999-01-27',
    location: 'GEC Circle, Chattogram',
    country: 'Bangladesh',
    state: 'Chattogram',
    city: 'Chattogram',
    hasSeparateAccount: true,
    skills: ['coordination', 'public-speaking'],
  },
  {
    firstName: 'Mahmudul',
    lastName: 'Islam',
    displayName: 'Mahmudul Islam',
    username: 'mahmudul.islam',
    email: 'mahmudul.islam04@gmail.com',
    phoneNumber: '+8801711000005',
    gender: UserGender.MALE,
    birthDate: '1996-11-11',
    location: 'Uttara, Dhaka',
    country: 'Bangladesh',
    state: 'Dhaka',
    city: 'Dhaka',
    hasSeparateAccount: true,
    skills: ['logistics', 'operations'],
  },
  {
    firstName: 'Farzana',
    lastName: 'Rahman',
    displayName: 'Farzana Rahman',
    username: 'farzana.rahman',
    email: 'farzana.rahman05@gmail.com',
    phoneNumber: '+8801711000006',
    gender: UserGender.FEMALE,
    birthDate: '1995-07-21',
    location: 'Zindabazar, Sylhet',
    country: 'Bangladesh',
    state: 'Sylhet',
    city: 'Sylhet',
    hasSeparateAccount: true,
    skills: ['community-engagement', 'networking'],
  },
  {
    firstName: 'Mehedi',
    lastName: 'Hassan',
    displayName: 'Mehedi Hassan',
    username: 'mehedi.hassan',
    email: 'mehedi.hassan06@gmail.com',
    phoneNumber: '+8801711000007',
    gender: UserGender.MALE,
    birthDate: '2000-04-14',
    location: 'Bojra, Khulna',
    country: 'Bangladesh',
    state: 'Khulna',
    city: 'Khulna',
    hasSeparateAccount: true,
    skills: ['video-editing', 'social-media'],
  },
  {
    firstName: 'Ayesha',
    lastName: 'Sultana',
    displayName: 'Ayesha Sultana',
    username: 'ayesha.sultana',
    email: 'ayesha.sultana07@gmail.com',
    phoneNumber: '+8801711000008',
    gender: UserGender.FEMALE,
    birthDate: '1998-12-30',
    location: 'Boyra, Rajshahi',
    country: 'Bangladesh',
    state: 'Rajshahi',
    city: 'Rajshahi',
    hasSeparateAccount: true,
    skills: ['creative-writing', 'content-planning'],
  },
  {
    firstName: 'Imran',
    lastName: 'Kabir',
    displayName: 'Imran Kabir',
    username: 'imran.kabir',
    email: 'imran.kabir08@gmail.com',
    phoneNumber: '+8801711000009',
    gender: UserGender.MALE,
    birthDate: '1997-02-19',
    location: 'Kandirpar, Cumilla',
    country: 'Bangladesh',
    state: 'Chattogram',
    city: 'Cumilla',
    hasSeparateAccount: true,
    skills: ['vendor-management', 'budgeting'],
  },
  {
    firstName: 'Sharmin',
    lastName: 'Akter',
    displayName: 'Sharmin Akter',
    username: 'sharmin.akter',
    email: 'sharmin.akter09@gmail.com',
    phoneNumber: '+8801711000010',
    gender: UserGender.FEMALE,
    birthDate: '1996-08-03',
    location: 'Mymensingh Sadar, Mymensingh',
    country: 'Bangladesh',
    state: 'Mymensingh',
    city: 'Mymensingh',
    hasSeparateAccount: true,

    skills: ['registration-management', 'helpdesk'],
  },
  {
    firstName: 'Fahim',
    lastName: 'Rashid',
    displayName: 'Fahim Rashid',
    username: 'fahim.rashid',
    email: 'fahim.rashid10@gmail.com',
    phoneNumber: '+8801711000011',
    gender: UserGender.MALE,
    birthDate: '1999-10-25',
    location: 'Barishal Sadar, Barishal',
    country: 'Bangladesh',
    state: 'Barishal',
    city: 'Barishal',
    hasSeparateAccount: true,
    skills: ['audio-visual', 'stage-management'],
  },
];

const resolveAvailableUsername = async (baseUsername: string) => {
  // Step:1 Reuse base username when it is not taken.
  const existingBase = await database.user.findFirst({
    where: { username: baseUsername },
    select: { id: true },
  });

  if (!existingBase) {
    return baseUsername;
  }

  // Step:2 Add numeric suffix until we find an available username.
  for (let index = 1; index <= 50; index += 1) {
    const candidate = `${baseUsername}${index}`;
    const exists = await database.user.findFirst({
      where: { username: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve username for seed base: ${baseUsername}`);
};

const createSeedUserIfMissing = async (seedUser: SeedUser, createdByOwner?: string) => {
  // Step:1 Skip creation if this seed email is already present.
  const existing = await database.user.findFirst({
    where: { email: seedUser.email },
    select: { id: true },
  });

  if (existing) {
    return false;
  }

  // Step:2 Hash password based on role and create a new unique account id.
  const rawPassword = seedUser.role === UserRole.ADMIN ? adminPassword : userPassword;
  const hashedPassword = await bcrypt.hash(rawPassword, 12);
  const accountId = await createUniqueAccountId();
  const username = await resolveAvailableUsername(seedUser.username);

  // Step:3 Create seeded user with mandatory fields.
  await database.user.create({
    data: {
      accountId,
      firstName: seedUser.firstName,
      lastName: seedUser.lastName,
      displayName: seedUser.displayName,
      username,
      email: seedUser.email,
      password: hashedPassword,
      phoneNumber: seedUser.phoneNumber,
      gender: seedUser.gender,
      birthDate: new Date(`${seedUser.birthDate}T00:00:00.000Z`),
      location: seedUser.location,
      country: seedUser.country,
      state: seedUser.state,
      city: seedUser.city,
      skills: seedUser.skills,
      createdByOwner,
      ...(seedUser.role ? { role: seedUser.role } : {}),
    },
  });

  return true;
};

export const seedDefaultUsers = async () => {
  // Step:1 Seed admin and 10 default users in an idempotent way.
  let createdCount = 0;

  const adminSeed = seedUsers.find(user => user.role === UserRole.ADMIN);
  if (!adminSeed) {
    throw new Error('Admin seed user is missing.');
  }

  const adminCreated = await createSeedUserIfMissing(adminSeed);
  if (adminCreated) {
    createdCount += 1;
  }

  const admin = await database.user.findFirst({
    where: { email: adminSeed.email },
    select: { id: true },
  });

  if (!admin) {
    throw new Error('Admin seed user could not be resolved.');
  }

  for (const seedUser of seedUsers.filter(user => user.email !== adminSeed.email)) {
    const created = await createSeedUserIfMissing(seedUser, admin.id);
    if (created) {
      createdCount += 1;
    }
  }

  // Step:2 Log seeding summary for visibility during startup.
  logger.info(
    colors.green(
      `   ✅ User seeding checked. Newly created: ${createdCount}, total seeds: ${seedUsers.length}`
    )
  );
};
