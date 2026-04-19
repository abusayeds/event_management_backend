import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { FamilyRoutes } from '../modules/family/family.routes';
import { FamilyMemberRoutes } from '../modules/familyMember/familyMember.routes';
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
router.use('/users', UserRoutes);
router.use('/families', FamilyRoutes);
router.use('/family-members', FamilyMemberRoutes);

export default router;
