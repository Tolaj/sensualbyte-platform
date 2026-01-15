// ✅ 2) apps/api/src/routes/buckets.routes.js
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { bucketsController } from "../controllers/buckets.product.controller.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB (tune later)
});

export function bucketsRoutes() {
    const r = Router();
    r.use(requireAuth());

    const ctrl = (req) => bucketsController(req.ctx.db);

    // List objects
    // GET /v1/buckets/:resourceId/objects?prefix=foo/&recursive=1
    r.get("/:resourceId/objects", asyncHandler((req, res) => ctrl(req).listObjects(req, res)));

    // Upload object (multipart)
    // POST /v1/buckets/:resourceId/objects
    // form-data:
    //   file=<file>
    //   key=<optional full key>
    //   prefix=<optional prefix/>  (only used if key missing)
    r.post(
        "/:resourceId/objects",
        upload.single("file"),
        asyncHandler((req, res) => ctrl(req).uploadObject(req, res))
    );

    // Download object (supports nested keys via wildcard)
    // GET /v1/buckets/:resourceId/objects/<key>?download=1
    r.get("/:resourceId/objects/*", asyncHandler((req, res) => ctrl(req).downloadObject(req, res)));

    // Delete object
    // DELETE /v1/buckets/:resourceId/objects/<key>
    r.delete("/:resourceId/objects/*", asyncHandler((req, res) => ctrl(req).deleteObject(req, res)));

    return r;
}
