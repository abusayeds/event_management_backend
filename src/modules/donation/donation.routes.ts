import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { DonationController } from './donation.controller';
import { DonationValidation } from './donation.validation';

const router = Router();

router.post(
  '/create',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(DonationValidation.createDonation),
  DonationController.createDonation
);

router.post('/webhook/stripe', DonationController.stripeWebhook);
router.post('/webhook/apple', DonationController.appleWebhook);
router.post('/webhook/google', DonationController.googleWebhook);

router.get(
  '/me',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(DonationValidation.getMyDonations),
  DonationController.getMyDonations
);

router.get(
  '/',
  auth(UserRole.ADMIN),
  validateRequest(DonationValidation.getDonationsForAdmin),
  DonationController.getDonationsForAdmin
);


export const DonationRoutes: Router = router;
