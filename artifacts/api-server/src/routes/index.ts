import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import usersRouter from "./users";
import userAuthRouter from "./user-auth";
import rightsSettingsRouter from "./rights-settings";
import fittingRoomsRouter from "./fitting-rooms";
import voiceRecordingsRouter from "./voice-recordings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(usersRouter);
router.use(userAuthRouter);
router.use(rightsSettingsRouter);
router.use(fittingRoomsRouter);
router.use(voiceRecordingsRouter);

export default router;
