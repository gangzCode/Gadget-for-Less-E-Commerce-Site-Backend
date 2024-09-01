const { Category } = require("../models/category");
const express = require("express");
const router = express.Router();
const { verifyTokenAndAdmin } = require("./verifyToken");
const { SubCategory } = require("../models/subCategory");
const aws = require("aws-sdk");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const uuid = require("uuid");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

aws.config.update({
  secretAccessKey: process.env.SPACE_ACCESSKEYSECRET,
  accessKeyId: process.env.SPACE_ACCESSKEYID,
  region: process.env.SPACE_REGION,
});

const s3 = new S3Client({
  //endpoint: process.env.SPACE_ENDPOINT,
  region: process.env.SPACE_REGION,
  credentials: {
    accessKeyId: process.env.SPACE_ACCESSKEYID,
    secretAccessKey: process.env.SPACE_ACCESSKEYSECRET,
  },
});

const uploadAWS = (subCatId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${subCatId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
  });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isValid = FILE_TYPE_MAP[file.mimetype];
    let uploadError = new Error("invalid image type");

    if (isValid) {
      uploadError = null;
    }
    cb(uploadError, "public/categoryImages");
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("-");
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});
const uploadOptions = multer({ storage: storage });

router.get(`/`, async (req, res) => {
  const categoryList = await Category.find();

  if (!categoryList) {
    return res.status(500).json({ success: false });
  }
  res.status(200).send(categoryList);
});

router.get(`/getNavBarCategories`, async (req, res) => {
  const categoryList = await Category.find({ showInNav: true }).populate({
    path: "subCategory",
    match: { showInNav: true },
  });
  if (!categoryList) {
    return res.status(500).json({ success: false });
  }
  res.status(200).send(categoryList);
});

router.get(`/withSubcategories`, async (req, res) => {
  const categoryList = await Category.find().populate("subCategory", {
    _id: 1,
    name: 1,
    showInNav: 1,
    innerCategories: 1,
    image: 1,
  });
  if (!categoryList) {
    return res.status(500).json({ success: false });
  }
  res.status(200).send(categoryList);
});

router.post("/createCategory", verifyTokenAndAdmin, async (req, res) => {
  let category = new Category({
    name: req.body.name,
    showInNav: req.body.showInNav,
    subCategory: [],
  });
  category = await category.save();

  if (!category) return res.status(400).send("the category cannot be created!");

  res.send(category);
});

router.post("/createSubcategory", verifyTokenAndAdmin, async (req, res) => {
  let subCatId;
  try {
    // Create a new subcategory
    let subCategory = new SubCategory({
      name: "TEMP",
      showInNav: true,
      innerCategories: [],
    });
    subCategory = await subCategory.save();
    subCatId = subCategory._id.toString();

    // Handle file upload and update subcategory
    uploadAWS(subCatId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        // Cleanup in case of error
        await SubCategory.findByIdAndDelete(subCatId);
        return res.status(500).send("The sub-category cannot be created");
      }

      let updatedSubCategory = await updateSubCategory(subCatId, req.body, req.files);
      if (!updatedSubCategory) {
        // Cleanup in case of error
        await SubCategory.findByIdAndDelete(subCatId);
        return res.status(500).send("The sub-category cannot be created");
      }

      // Update the associated category if provided
      if (req.body.category) {
        await Category.findByIdAndUpdate(
          req.body.category,
          { $push: { subCategory: updatedSubCategory._id } },
          { new: true }
        );
      }

      res.send(updatedSubCategory);
    });
  } catch (e) {
    console.error(e);
    try {
      if (subCatId) {
        await SubCategory.findByIdAndDelete(subCatId);
      }
    } catch (ignore) {}
    return res.status(500).send("The sub-category cannot be created");
  }
});

async function updateSubCategory(subCatId, data, fileList) {
  let updateData = {
    name: data.name,
    showInNav: data.showInNav !== undefined ? data.showInNav : true,
    ...(fileList && fileList.image && fileList.image[0] && { image: fileList.image[0].location }),
    // Update innerCategories if provided
    innerCategories: data.innerCategories || [],
  };

  let subCategory = await SubCategory.findByIdAndUpdate(subCatId, updateData, { new: true });

  return subCategory;
}

router.post("/createInnerSubcategory/:subcategoryId", verifyTokenAndAdmin, async (req, res) => {
  try {
    const subcategoryId = req.params.subcategoryId;
    const innerCategories = req.body.innerCategories;

    if (!subcategoryId || !Array.isArray(innerCategories) || innerCategories.length === 0) {
      return res.status(400).send("Invalid request payload");
    }

    // Prepare the array of inner categories to be added
    const innerCategoriesToAdd = innerCategories.map((category) => ({ name: category.name }));

    // Update the main subcategory by pushing each new inner category
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      subcategoryId,
      { $push: { innerCategories: { $each: innerCategoriesToAdd } } }, // Use $each to add multiple items
      { new: true, useFindAndModify: false } // Return the updated document
    );

    if (!updatedSubCategory) {
      return res.status(404).send("The main subcategory cannot be found or updated!");
    }

    res.status(200).send(updatedSubCategory);
  } catch (error) {
    console.error("Error creating inner subcategory:", error);
    res.status(500).send("An error occurred while creating the inner subcategory.");
  }
});

router.put("/update", verifyTokenAndAdmin, async (req, res) => {
  try {
    const url = req.protocol + "://" + req.get("host");
    // let updateData = req.body.updatedData;

    // Use multer for handling image uploads
    uploadAWS(req.body.subId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        console.error("Error uploading image:", err);
        return res.status(500).send("Error uploading image");
      }

      try {
        const updateData = req.body.updatedData;
        if (req.body.isSub) {
          if (req.body.isInnerSub) {
            // Update inner subcategory
            console.log(req.body);

            const parentSubcategory = await SubCategory.findById(req.body.parentSubcategory);
            const innerCategory = parentSubcategory.innerCategories.id(req.body.subId);

            if (innerCategory) {
              Object.assign(innerCategory, updateData);
              await parentSubcategory.save();
              return res.status(200).send();
            } else {
              return res.status(404).send({ message: "Inner subcategory not found" });
            }
          } else {
            // Update subcategory
            const subCategory = await SubCategory.findById(req.body.subId);

            if (subCategory) {
              const updatedSubCategory = await updateSubCategory(
                req.body.subId,
                req.body.updatedData,
                req.files
              );

              if (
                req.body.updatedData.imagePath &&
                subCategory.imagePath &&
                subCategory.imagePath !== req.body.updatedData.imagePath
              ) {
                // Delete old image from AWS S3
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: process.env.SPACE_BUCKET_NAME,
                  Key: subCategory.imagePath.split("/")[1], // Adjust this to your S3 path
                });
                await s3.send(deleteCommand);
              }

              // Update category reference if provided
              if (req.body.updatedData.category) {
                const category = await Category.findById(req.body.updatedData.category);
                if (!category) {
                  return res.status(404).send({ message: "Category not found" });
                }

                // Remove subCategory reference from old category
                await Category.updateOne(
                  { subCategory: req.body.subId },
                  { $pull: { subCategory: req.body.subId } }
                );

                // Add subCategory reference to new category
                category.subCategory.push(updatedSubCategory._id);
                await category.save();
              }

              return res.status(200).send(updatedSubCategory);
            } else {
              return res.status(404).send({ message: "Subcategory not found" });
            }
          }
        } else {
          // Update category
          const category = await Category.findById(req.body.categoryId);

          if (category) {
            const updatedCategory = await Category.findByIdAndUpdate(
              req.body.categoryId,
              updateData,
              { new: true }
            );

            if (
              req.body.updatedData.imagePath &&
              category.imagePath &&
              category.imagePath !== req.body.updatedData.imagePath
            ) {
              // Delete old image from AWS S3
              const deleteCommand = new DeleteObjectCommand({
                Bucket: process.env.SPACE_BUCKET_NAME,
                Key: category.imagePath.split("/")[1], // Adjust this to your S3 path
              });
              await s3.send(deleteCommand);
            }

            return res.status(200).send(updatedCategory);
          } else {
            return res.status(404).send({ message: "Category not found" });
          }
        }
      } catch (e) {
        console.error(e);
        return res.status(500).send();
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
});

router.post("/delete", verifyTokenAndAdmin, async (req, res) => {
  try {
    const url = req.protocol + "://" + req.get("host");
    if (req.body.isSub) {
      if (req.body.isInnerSub) {
        await SubCategory.findByIdAndUpdate(req.body.parentSubcategory, {
          $pull: { innerCategories: { _id: req.body.subId } },
        });
        return res.status(200).send();
      } else {
        await Category.findByIdAndUpdate(req.body.categoryId, {
          $pull: { subCategory: req.body.subId },
        });
        const subCat = await SubCategory.findById(req.body.subId);
        if (subCat.imagePath && subCat.imagePath.trim() !== "") {
          const fs = require("fs");
          let path = subCat.imagePath.split(url + "/public/categoryImages/");
          fs.unlink("./public/categoryImages/" + path[1], (err) => {
            if (err) {
              console.error(err);
            }
          });
        }
        await SubCategory.findByIdAndDelete(req.body.subId);
        return res.status(200).send();
      }
    } else {
      let category = await Category.findById(req.body.categoryId);
      if (category.subCategory.length > 0) {
        let subId = category.subCategory.map((val) => {
          return val._id;
        });
        let subCats = await SubCategory.find({ _id: { $in: subId } });
        let imagePaths = [];
        for (let subCat of subCats) {
          if (subCat.imagePath) {
            imagePaths.push(subCat.imagePath);
          }
        }
        for (let imagePath of imagePaths) {
          const fs = require("fs");
          let path = imagePath.split(url + "/public/categoryImages/");
          fs.unlink("./public/categoryImages/" + path[1], (err) => {
            if (err) {
              console.error(err);
            }
          });
        }
        await SubCategory.deleteMany({ _id: { $in: subId } });
      }
      await Category.findByIdAndDelete(category._id);
      return res.status(200).send();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
});

router.get("/:id", async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(500).json({ message: "The category with the given ID was not found." });
  }
  res.status(200).send(category);
});

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  let category = new Category({
    name: req.body.name,
    icon: req.body.icon,
    color: req.body.color,
  });
  category = await category.save();

  if (!category) return res.status(400).send("the category cannot be created!");

  res.send(category);
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      icon: req.body.icon || category.icon,
      color: req.body.color,
    },
    { new: true }
  );

  if (!category) return res.status(400).send("the category cannot be created!");

  res.send(category);
});

router.delete("/:id", verifyTokenAndAdmin, (req, res) => {
  Category.findByIdAndRemove(req.params.id)
    .then((category) => {
      if (category) {
        return res.status(200).json({ success: true, message: "the category is deleted!" });
      } else {
        return res.status(404).json({ success: false, message: "category not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

module.exports = router;
