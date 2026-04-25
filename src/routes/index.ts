import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { CategoryRoutes } from '../modules/category/category.routes';
import { ConnectionRoutes } from '../modules/connection/connection.routes';
import { EventRoutes } from '../modules/event/event.routes';
import { FamilyRoutes } from '../modules/family/family.routes';
import { FamilyMemberRoutes } from '../modules/familyMember/familyMember.routes';
import { ProgramRoutes } from '../modules/program/program.routes';
import { SubcategoryRoutes } from '../modules/subcategory/subcategory.routes';
import { UserRoutes } from '../modules/user/user.routes';

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
router.use('/subcategories', SubcategoryRoutes);
router.use('/programs', ProgramRoutes);
router.use('/events', EventRoutes);
router.use('/users', UserRoutes);
router.use('/families', FamilyRoutes);
router.use('/family-members', FamilyMemberRoutes);

export default router;
