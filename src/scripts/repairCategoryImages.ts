import { database } from '../config/database';
import { repairCategoryImages } from '../utils/repairCategoryImages';

repairCategoryImages()
  .then(result => {
    console.log(
      `Category images repaired: ${result.repaired}; unavailable: ${result.unavailable.length}`
    );
    if (result.unavailable.length) process.exitCode = 1;
  })
  .catch(error => {
    console.error('Category image repair failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
