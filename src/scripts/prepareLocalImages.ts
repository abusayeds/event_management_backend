import { promises as fs } from 'fs';
import path from 'path';
import { uploadRoot, writeLocalFile } from '../utils/localStorage';
import { dashboardAsset, dashboardAssetFiles, DashboardAssetKey } from '../utils/dashboardAssets';

async function copyImages(source: string, destination: string) {
  let count = 0;
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
    await writeLocalFile(
      await fs.readFile(path.join(source, entry.name)),
      `${destination}/${entry.name}`
    );
    count++;
  }
  return count;
}

async function main() {
  for (const key of Object.keys(dashboardAssetFiles) as DashboardAssetKey[])
    await dashboardAsset(key);
  const categories = await copyImages(
    path.resolve('../Sharing-Event-Dashboard/public/images/categories'),
    'catalog-assets/categories'
  );
  let programs = 0;
  for (const ratio of ['16-9', '5-4']) {
    programs += await copyImages(
      path.resolve('temp-reference-data/Reference Data/Program', ratio),
      `catalog-assets/programs/${ratio}`
    );
  }
  console.log(
    `Stored ${categories} category assets and ${programs} original program images in ${uploadRoot}.`
  );
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
