import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { CategoryRoutes } from '../modules/category/category.routes';
import { ConnectionRoutes } from '../modules/connection/connection.routes';
import { DonationRoutes } from '../modules/donation/donation.routes';
import { DashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { EventRoutes } from '../modules/event/event.routes';
import { FamilyRoutes } from '../modules/family/family.routes';
import { FamilyMemberRoutes } from '../modules/familyMember/familyMember.routes';
import { NotificationRoutes } from '../modules/notification/notification.routes';
import { ProgramRoutes } from '../modules/program/program.routes';
import { SettingsRoutes } from '../modules/settings/settings.routes';
import { SubcategoryRoutes } from '../modules/subcategory/subcategory.routes';
import { UserRoutes } from '../modules/user/user.routes';
import { EventApplicationRoutes } from '../modules/eventApplication/eventApplication.routes';

const router: Router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dawabuyi Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use('/auth', AuthRoutes);
router.use('/categories', CategoryRoutes);
router.use('/connections', ConnectionRoutes);
router.use('/donations', DonationRoutes);
router.use('/dashboard', DashboardRoutes);
router.use('/subcategories', SubcategoryRoutes);
router.use('/programs', ProgramRoutes);
router.use('/settings', SettingsRoutes);
router.use('/events', EventRoutes);
router.use('/users', UserRoutes);
router.use('/event-applications', EventApplicationRoutes);
router.use('/families', FamilyRoutes);
router.use('/family-members', FamilyMemberRoutes);
router.use('/notifications', NotificationRoutes);

export default router;
