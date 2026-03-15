import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import usersRouter from "./users";
import userAuthRouter from "./user-auth";
import rightsSettingsRouter from "./rights-settings";
import fittingRoomsRouter from "./fitting-rooms";
import fittingRoomSessionsRouter from "./fitting-room-sessions";
import voiceRecordingsRouter from "./voice-recordings";
import voiceCallRouter from "./voice-call";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(usersRouter);
router.use(userAuthRouter);
router.use(rightsSettingsRouter);
router.use(fittingRoomsRouter);
router.use(fittingRoomSessionsRouter);
router.use(voiceRecordingsRouter);
router.use(voiceCallRouter);

export default router;
