import express from "express";
import { CategoryController } from "../controllers/category.controller";

const router = express.Router();
// Create a new category
//router.post("/", CategoryController.createCategory);
// Get all categories
router.get("/", CategoryController.getCategories);
router.post("/createCategories", CategoryController.createCategories);

export default router;