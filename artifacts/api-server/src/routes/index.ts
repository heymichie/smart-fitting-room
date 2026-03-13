import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import usersRouter from "./users";
import rightsSettingsRouter from "./rights-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(usersRouter);
router.use(rightsSettingsRouter);

export default router;
