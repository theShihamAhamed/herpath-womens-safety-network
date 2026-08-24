// backend/src/modules/routes/routes.router.ts

import { Router } from 'express';
import { getAlternativeRoutes } from './routes.controller.js';
import { getRouteRecommendationHandler } from './recommendation.controller.js';



const router = Router();

// router.use(requireAuth); // route planning should require at least an anonymous session
router.get('/alternatives', getAlternativeRoutes);
router.get('/recommendation', getRouteRecommendationHandler);

export default router;

/**
 * In backend/src/app.ts, alongside your other module routers:
 *
 *   import routesRouter from './modules/routes/routes.router';
 *   app.use('/api/routes', routesRouter);
 */
