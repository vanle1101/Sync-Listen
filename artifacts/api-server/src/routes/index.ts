import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mediaRouter from "./media";
import roomsRouter from "./rooms";
import soundcloudRouter from "./soundcloud";
import spotifyRouter from "./spotify";
import youtubeRouter from "./youtube";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(youtubeRouter);
router.use(soundcloudRouter);
router.use(spotifyRouter);
router.use(mediaRouter);

export default router;
