import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  uploadImage,
  createMetadata,
  createMetadataSchema,
  getSalt,
  getSaltSchema,
} from "../services/nadfun";

const router = Router();

// Multer: accept single file up to 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// POST /api/v1/nadfun/upload-image
// Accepts multipart/form-data with "image" field
router.post(
  "/upload-image",
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No image file provided", code: "MISSING_IMAGE" });
        return;
      }

      const result = await uploadImage(file.buffer, file.mimetype);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/nadfun/create-metadata
// Accepts JSON body
router.post("/create-metadata", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createMetadataSchema.parse(req.body);
    const result = await createMetadata(input);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/nadfun/get-salt
// Accepts JSON body
router.post("/get-salt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = getSaltSchema.parse(req.body);
    const result = await getSalt(input);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
