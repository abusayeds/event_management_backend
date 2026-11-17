import { closeDB, connectDB, database } from '../config/database';

async function main() {
  await connectDB();
  const id = 'cbb8f4c8-79fe-4e08-bf5b-5a0ef8e7b77c';
  const event = await database.event.findFirst({
    where: { id, deletedAt: null, isDeleted: false },
    select: {
      id: true,
      eventName: true,
      previousRecords: {
        select: { id: true, recordName: true, previousEventId: true },
      },
    },
  });
  console.log('OK event detail query:', {
    id: event?.id,
    eventName: event?.eventName,
    previousCount: event?.previousRecords?.length ?? 0,
  });
}

main()
  .catch(err => {
    console.error('FAIL', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
