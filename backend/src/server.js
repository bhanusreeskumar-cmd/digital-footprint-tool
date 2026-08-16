import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { scansRouter } from "./routes/scans.js";
import { removalsRouter } from "./routes/removals.js";
import { adminRouter } from "./routes/admin.js";
import { phoneVerificationRouter } from "./routes/phoneVerification.js";
import { nameVerificationRouter } from "./routes/nameVerification.js";
import { identityReviewsRouter } from "./routes/identityReviews.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
    });
  }
);

app.use(
  "/api/scans",
  scansRouter
);

app.use(
  "/api/removal-requests",
  removalsRouter
);

app.use(
  "/api/admin",
  adminRouter
);


app.use(
  "/api/phone-verification",
  phoneVerificationRouter
);

app.use(
  "/api/name-verification",
  nameVerificationRouter
);

app.use(
  "/api/identity-reviews",
  identityReviewsRouter
);

app.use(
  (err, _req, res, _next) => {
    console.error(err);

    res.status(500).json({
      error:
        "Unexpected server error.",
    });
  }
);

const port =
  Number(
    process.env.PORT ||
    3001
  );

app.listen(
  port,
  () => {
    console.log(
      `Footprint API running on http://localhost:${port}`
    );
  }
);