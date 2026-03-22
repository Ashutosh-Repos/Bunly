import { router, publicProcedure } from "./router.js";
import { authRouter } from "./routers/auth.js";
import { userRouter } from "./routers/user.js";
import { channelRouter } from "./routers/channel.js";
import { playlistRouter } from "./routers/playlist.js";
import { videoRouter } from "./routers/video.js";
import { commentRouter } from "./routers/comment.js";
import { feedRouter } from "./routers/feed.js";
import { historyRouter } from "./routers/history.js";
import { notificationRouter } from "./routers/notification.js";
import { searchRouter } from "./routers/search.js";
import { engagementRouter } from "./routers/engagement.js";
import { reportRouter } from "./routers/report.js";
import { strikeRouter } from "./routers/strike.js";
import { adminRouter } from "./routers/admin.js";
import { communityRouter } from "./routers/community.js";
import { uploadRouter } from "./routers/upload.js";
import { categoryRouter } from "./routers/category.js";

/**
 * App Router containing all sub-routers
 */
export const appRouter = router({
    auth: authRouter,
    user: userRouter,
    channel: channelRouter,
    playlist: playlistRouter,
    video: videoRouter,
    category: categoryRouter,
    comment: commentRouter,
    feed: feedRouter,
    history: historyRouter,
    notification: notificationRouter,
    search: searchRouter,
    engagement: engagementRouter,
    report: reportRouter,
    strike: strikeRouter,
    admin: adminRouter,
    community: communityRouter,
    upload: uploadRouter,
    health: publicProcedure.query(() => {
        return { status: "ok", timestamp: new Date().toISOString() };
    }),
});

export type AppRouter = typeof appRouter;
