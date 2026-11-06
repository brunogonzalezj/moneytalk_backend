import express from "express";
import { CategoryController } from "../controllers/category.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();
// Create a new category (con autenticación)
router.post("/", authMiddleware, CategoryController.createCategory);
// Get all categories
router.get("/", CategoryController.getCategories);
router.post("/createCategories", CategoryController.createCategories);

export default router;