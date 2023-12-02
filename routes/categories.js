const express = require("express");
const authAdmin = require("../middlewares/authAdmin");
const Router = express.Router();
const Category = require("../models/Category");

// @route GET categories
// @desc Get All Categories
// @access Public
Router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort("-date");
    res.json(categories);
  } catch (err) {
    console.log(err);
  }
});

// @route GET amount categories
// @desc Get Amount Categories
// @access Private
Router.get("/amount", authAdmin, async (req, res) => {
  const amount = await Category.countDocuments();
  res.json(amount);
});

// @route POST category
// @desc Create Category
// @access Private
Router.post("/", authAdmin, async (req, res) => {
  try {
    const { genre, vn } = req.body;

    if (!genre || !vn) {
      return res.status(400).json({
        msg: "Vui lòng điền vào ô trống",
      });
    }

    const existingCategoryGenre = await Category.findOne({ genre: genre });
    if (existingCategoryGenre && existingCategoryGenre._id != id) {
      return res.status(400).json({ error: `Danh mục với thể loại tiếng anh '${genre}' đã tồn tại` });
    }
    const existingCategoryVn = await Category.findOne({ vn: vn });
    if (existingCategoryVn && existingCategoryVn._id != id) {
      return res.status(400).json({ error: `Danh mục với thể loại tiếng việt '${vn}' đã tồn tại` });
    }
    const newCategory = new Category({
      genre,
      vn,
    });
    await newCategory.save();
    res.json(newCategory);
  } catch (err) {
    console.log(err);
  }
});

// @route Patch category
// @desc Update Category
// @access Private
Router.patch("/:id", authAdmin, async (req, res) => {
  try {
    const { genre, vn } = req.body;
    const id = req.params.id
    if (!genre || !vn) {
      return res.status(400).json({
        msg: "Vui lòng điền vào ô trống",
      });
    }

    const existingCategoryGenre = await Category.findOne({ genre: genre });
    if (existingCategoryGenre && existingCategoryGenre._id != id) {
      return res.status(400).json({ error: `Danh mục với thể loại tiếng anh '${genre}' đã tồn tại` });
    }
    const existingCategoryVn = await Category.findOne({ vn: vn });
    if (existingCategoryVn && existingCategoryVn._id != id) {
      return res.status(400).json({ error: `Danh mục với thể loại tiếng việt '${vn}' đã tồn tại` });
    }
    const category = await Category.findById(req.params.id);
    category.genre = genre
    category.vn = vn
    await category.save();
    res.json(category);
  } catch (err) {
    console.log(err);
  }
});

// @route DELETE category
// @desc Remove A Category
// @access Private
Router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    await category.remove();

    return res.json({ message: 'Xoá danh mục thành công' });
  } catch (err) {
    res.status(400).json({ success: false, err });
  }
});


module.exports = Router;
