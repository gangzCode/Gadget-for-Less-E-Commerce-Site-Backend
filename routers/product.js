const { Product } = require("../models/product");
const express = require("express");
const { Category } = require("../models/category");
const { SubCategory } = require("../models/subCategory");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const { auth0Verify } = require("./auth0-verify");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { Constants } = require("../models/constants");
const fs = require("fs");
const aws = require("aws-sdk");
const uuid = require("uuid"); // Import the UUID library
const { S3Client } = require("@aws-sdk/client-s3");

const dotenv = require("dotenv");

dotenv.config();

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

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isValid = FILE_TYPE_MAP[file.mimetype];
    let uploadError = new Error("invalid image type");

    if (isValid) {
      uploadError = null;
    }
    cb(uploadError, "public/uploads");
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("-");
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});

const uploadAWS = (prodId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${prodId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
  });

const uploadOptions = multer({ storage: storage });

router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.query.categories) {
      filter.category = { $in: req.query.categories.split(",") };
    }

    if (req.query.subCategories) {
      filter.subCategory = { $in: req.query.subCategories.split(",") };
    }

    if (req.query.innerSubCategories) {
      filter.innerSubCategory = { $in: req.query.innerSubCategories.split(",") };
    }

    let query = Product.find(filter).populate(["category", "subCategory"]);

    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit));
    }

    const productList = await query;

    if (!productList) {
      return res.status(500).json({ success: false, message: "No products found" });
    }

    res.status(200).send(productList);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get(`/productsForAdmin`, async (req, res) => {
  const productList = await Product.find(
    {},
    { _id: 1, name: 1, image: 1, variations: 1, isNumericVariation: 1 }
  ).populate(["category", "subCategory"]);
  let manipulatedList = [];
  for (let product of productList) {
    for (let variation of product.variations) {
      if (variation.sku) {
        let obj = {};
        obj._id = product._id;
        obj.name = product.name;
        obj.image = product.image;
        obj.isNumericVariation = product.isNumericVariation;
        obj.sku = variation.sku;
        obj.size = variation.size;
        obj.quantity = variation.quantity;
        obj.price = variation.discountedPrice;
        manipulatedList.push(obj);
      }
    }
  }
  if (!productList) {
    res.status(500).json({ success: false });
  }
  res.send(manipulatedList);
});

router.get("/get/variations/total-cost", verifyTokenAndAdmin, async (req, res) => {
  try {
    const productList = await Product.find({}, { variations: 1 }) // Fetch only the variations field
      .populate("variations") // Populate the variations if necessary
      .exec();

    // Sum up the cost of all variations multiplied by their quantity
    const totalCost = productList.reduce((total, product) => {
      const variationsCost = product.variations.reduce((sum, variation) => {
        // Calculate the cost for each variation (cost * quantity)
        const variationCost = (variation.cost || 0) * (variation.quantity || 0); // Ensure to use cost and quantity
        return sum + variationCost;
      }, 0);
      return total + variationsCost;
    }, 0);

    res.status(200).json({ success: true, totalCost });
  } catch (error) {
    console.error("Error fetching variations:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get(`/latestProductsForAdmin/:limit`, async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10; // Default limit to 10 if not provided
    const productList = await Product.find(
      {},
      { _id: 1, name: 1, image: 1, variations: 1, isNumericVariation: 1 }
    )
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order to get the latest products
      .limit(limit) // Limit the number of results to the value of 'limit'
      .populate(["category", "subCategory"]);

    let manipulatedList = [];
    for (let product of productList) {
      for (let variation of product.variations) {
        if (variation.sku) {
          let obj = {};
          obj._id = product._id;
          obj.name = product.name;
          obj.image = product.image;
          obj.isNumericVariation = product.isNumericVariation;
          obj.sku = variation.sku;
          obj.color = variation.color;
          obj.size = variation.size;
          obj.quantity = variation.quantity;
          obj.price = variation.price;
          obj.discountedPrice = variation.discountedPrice;
          manipulatedList.push(obj);
        }
      }
    }

    if (!productList) {
      return res.status(500).json({ success: false });
    }
    res.send(manipulatedList);
  } catch (error) {
    return res.status(500).json({ error: "An error occurred while fetching the latest products." });
  }
});

//Get products from the sub category
// router.get(`/`, async (req, res) =>{
//     // localhost:4000/api/v1/products?subCategories=2342342,234230
//     let filter = {};

//     if(req.query.subCategories){
//         filter = {subCategory: req.query.subCategories.split(',')}
//     }

//     const productDam = await Product.find(filter).populate(['category', 'subCategory']);

//     if(!productDam){
//         res.status(500).json({success: false})
//     }
//     res.send(productDam);
// })

// Used in getDetails (USER)
router.get("/:id", async (req, res) => {
  if (!req.params.id || req.params.id === "undefined") {
    return res.status(500).json({ success: false });
  }

  try {
    const product = await Product.findById(req.params.id, { "variations.cost": 0 })
      .populate({
        path: "category",
        populate: {
          path: "subCategory",
          populate: {
            path: "innerCategories",
          },
        },
      })
      .populate("subCategory")
      .populate("filterList")
      .populate("innerSubCategory");

    if (!product) {
      return res.status(500).json({ success: false });
    }

    res.send(product);
  } catch (e) {
    return res.status(400).send();
  }
});

// Used in getDetails (ADMIN)
router.get(`/admin/:id`, verifyTokenAndAdmin, async (req, res) => {
  if (!req.params.id || req.params.id === "undefined") {
    return res.status(500).json({ success: false });
  }
  try {
    const product = await Product.findById(req.params.id)
      .populate(["category", "subCategory"])
      .populate("filterList");

    if (!product) {
      return res.status(500).json({ success: false });
    }
    res.send(product);
  } catch (e) {
    return res.status(400).send();
  }
});

router.post(`/`, verifyTokenAndAdmin, async (req, res) => {
  let prodId;
  try {
    let product = new Product({
      name: "TEMP",
      description: "TEMP",
      price: 0,
    });
    product = await product.save();
    prodId = product._id.toString();
    uploadAWS(prodId).fields([
      { name: "image", maxCount: 1 },
      { name: "imageAlt", maxCount: 1 },
      { name: "otherImages" },
    ])(req, res, async (err) => {
      if (err) {
        return res.status(500).send("The product cannot be created");
      }
      let product = await updateProduct(prodId, req.body, req.files);
      if (!product) {
        return res.status(500).send("The product cannot be created");
      }
      res.send(product);
    });
  } catch (e) {
    console.error(e);
    try {
      if (prodId) {
        await Product.findByIdAndDelete(prodId);
      }
    } catch (ignore) {}
    return res.status(500).send("The product cannot be created");
  }
});

router.post(`/update/`, verifyTokenAndAdmin, async (req, res) => {
  try {
    await uploadAWS(req.body.productId).fields([
      { name: "image", maxCount: 1 },
      { name: "imageAlt", maxCount: 1 },
      { name: "otherImages" },
    ])(req, res, async (err) => {
      if (err) {
        return res.status(500).send("The product cannot be updated");
      }
      let product = await updateProduct(req.body.productId, req.body, req.files);
      if (!product) {
        return res.status(500).send("The product cannot be updated");
      }
      res.send(product);
    });
  } catch (e) {
    return res.status(500).send("The product cannot be updated");
  }
});

async function updateProduct(prodId, data, fileList) {
  // Check for valid category and subcategory
  const category = await Category.findById(data.category);
  const subCategory = await SubCategory.findById(data.subCategory);
  if (!category || !subCategory) return null;

  // Parse variations safely
  let variations;
  try {
    variations =
      typeof data.variations === "string" ? JSON.parse(data.variations) : data.variations;
  } catch (error) {
    throw new Error("Invalid variations data");
  }

  // Validate that variations is an array and has at least one element
  if (!Array.isArray(variations) || variations.length === 0) {
    throw new Error("Variations must be a non-empty array");
  }

  // Initialize default prices and costs
  let tempPrice = Infinity;
  let tempDiscountedPrice = Infinity;
  let tempCost = Infinity;

  // Handle numeric variations separately if indicated
  if (data.isNumericVariation && JSON.parse(data.isNumericVariation)) {
    // Iterate over each variation
    for (let variation of variations) {
      // Ensure the variation is an object and has innerVariations as an array
      if (variation && Array.isArray(variation.innerVariations)) {
        for (let innerVar of variation.innerVariations) {
          // Ensure inner variation is an object with a defined price and cost
          if (innerVar && innerVar.price !== undefined) {
            let price = parseInt(innerVar.price);
            let discountedPrice = innerVar.discountedPrice
              ? parseInt(innerVar.discountedPrice)
              : undefined;
            let cost = innerVar.cost !== undefined ? parseInt(innerVar.cost) : tempCost;

            // Update the temp prices and costs
            if (price < tempPrice) {
              tempPrice = price;
              tempDiscountedPrice = discountedPrice || tempDiscountedPrice;
              tempCost = cost;
            }
          }
        }
      }
    }
  } else {
    // Handle non-numeric variations
    for (let variation of variations) {
      // Ensure the variation is an object with a defined price and cost
      if (variation && variation.price !== undefined) {
        let price = variation.price;
        let discountedPrice = variation.discountedPrice;
        let cost = variation.cost !== undefined ? variation.cost : tempCost;

        // Update the temp prices and costs
        if (price < tempPrice) {
          tempPrice = price;
          tempDiscountedPrice =
            discountedPrice !== undefined ? discountedPrice : tempDiscountedPrice;
          tempCost = cost;
        }
      }
    }
  }

  // Assign the final discounted price if it is valid
  let discountedPrice = tempDiscountedPrice !== Infinity ? tempDiscountedPrice : null;
  let cost = tempCost !== Infinity ? tempCost : null;

  // Prepare the file path list
  let filePathList = [];

  if (fileList && Array.isArray(fileList.otherImages)) {
    for (let file of fileList.otherImages) {
      filePathList.push(file.location);
    }
  }
  if (data.otherExistingImages && Array.isArray(data.otherExistingImages)) {
    for (let file of data.otherExistingImages) {
      filePathList.push(file);
    }
  }

  let specifications;
  try {
    specifications =
      typeof data.specifications === "string"
        ? JSON.parse(data.specifications)
        : data.specifications;
  } catch (error) {
    throw new Error("Invalid specifications data");
  }

  // Validate that specifications is an array and has at least one element
  if (!Array.isArray(specifications) || specifications.length === 0) {
    throw new Error("Specifications must be a non-empty array");
  }

  // Update the product with new data
  let updateData = {
    name: data.name,
    type: data.type,
    description: data.description,
    richDescription: data.richDescription,
    ...(fileList && fileList.image && fileList.image[0] && { image: fileList.image[0].location }),
    ...(fileList &&
      fileList.imageAlt &&
      fileList.imageAlt[0] && { imageAlt: fileList.imageAlt[0].location }),
    ...((data.otherImages || filePathList.length) && {
      otherImages: filePathList.length ? filePathList : [],
    }),
    specifications: specifications,
    isNumericVariation: JSON.parse(data.isNumericVariation),
    variations: variations,
    price: tempPrice !== Infinity ? tempPrice : null,
    discountedPrice: discountedPrice,
    cost: cost,
    category: data.category,
    subCategory: data.subCategory,
    innerSubCategory: data.innerSubCategory,
    isFeatured: JSON.parse(data.isFeatured),
    dateCreated: new Date(),
    filterList: (() => {
      try {
        return data.filterList ? JSON.parse(data.filterList) : [];
      } catch (error) {
        console.error("Failed to parse filterList:", error.message);
        return [];
      }
    })(),
  };

  let product = await Product.findByIdAndUpdate(prodId, updateData, { new: true });

  return product;
}

router.put("/:id", verifyTokenAndAdmin, uploadOptions.single("image"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).send("Invalid Product Id");
  }
  const category = await Category.findById(req.body.category);
  const subCategory = await SubCategory.findById(req.body.subCategory);
  if (!category) return res.status(400).send("Invalid Category");
  if (!subCategory) return res.status(400).send("Invalid Sub Category");

  const file = req.file;
  let imagepath;

  if (file) {
    const fileName = file.filename;
    const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;
    imagepath = `${basePath}${fileName}`;
  } else {
    imagepath = product.image;
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      description: req.body.description,
      richDescription: req.body.richDescription,
      image: imagepath,
      brand: req.body.brand,
      price: req.body.price,
      category: req.body.category,
      subCategory: req.body.subCategory,
      countInStock: req.body.countInStock,
      rating: req.body.rating,
      numReviews: req.body.numReviews,
      isFeatured: req.body.isFeatured,
    },
    { new: true }
  );

  if (!product) return res.status(500).send("the product cannot be updated!");

  res.send(product);
});

router.delete("/:id", verifyTokenAndAdmin, (req, res) => {
  Product.findByIdAndDelete(req.params.id)
    .then((product) => {
      if (product) {
        return res.status(200).json({ success: true, message: "the product is deleted!" });
      } else {
        return res.status(400).json({ success: false, message: "product not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

router.get(`/get/count`, async (req, res) => {
  const productCount = await Product.countDocuments();

  if (!productCount) {
    return res.status(500).json({ success: false });
  }
  return res.send({
    productCount: productCount,
  });
});

// Used in getFeatured (USER)
router.get("/get/featured/:limit", async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10; // Default to 10 if no limit is provided

    const products = await Product.find({ isFeatured: true })
      .limit(limit)
      .select(
        "_id name description image imageAlt type brand isFeatured variations specifications category innerSubCategory subCategory"
      );

    return res.status(200).json(products);
  } catch (err) {
    console.error("Error occurred:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Used in getFeatured (USER)
router.get("/get/bestSeller/:limit", async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10; // Default to 10 if no limit is provided

    const products = await Product.find()
      .sort({ purchaseCount: -1 })
      .limit(limit)
      .select(
        "_id name description image imageAlt type brand purchaseCount variations category innerSubCategory subCategory"
      );

    return res.status(200).json(products);
  } catch (err) {
    console.error("Error occurred:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Used in product (USER)
router.post(`/get/products`, async (req, res) => {
  try {
    const ITEMS_PER_PAGE = 12;

    let count = req.body.page ? req.body.page : 1;
    let sorting = req.body.sort ? req.body.sort : "latest";

    let sortObj;
    if (sorting === Constants.SORTING.LATEST) {
      sortObj = { _id: -1 };
    } else if (sorting === Constants.SORTING.FEATURED) {
      sortObj = { isFeatured: 1, _id: -1 };
    } else if (sorting === Constants.SORTING.BEST) {
      sortObj = {};
    } else if (sorting === Constants.SORTING.HIGH) {
      sortObj = { price: -1 };
    } else if (sorting === Constants.SORTING.LOW) {
      sortObj = { price: 1 };
    } else if (sorting === Constants.SORTING.AtoZ) {
      sortObj = { name: 1 };
    } else if (sorting === Constants.SORTING.ZtoA) {
      sortObj = { name: -1 };
    } else {
      sortObj = { _id: -1 };
    }
    count = count - 1;

    const filterStr = req.body.filters;
    let filters = null;
    try {
      filters = JSON.parse(filterStr);
    } catch (ignore) {}

    let products;
    let size;
    if (filters && filters.length > 0) {
      products = await Product.find({ filterList: { $all: filters } })
        .sort(sortObj)
        .skip(count * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
      size = await Product.find({ filterList: { $all: filters } }).count();
    } else {
      products = await Product.find({})
        .sort(sortObj)
        .skip(count * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
      size = await Product.find().count();
    }

    if (!products) {
      return res.status(500).json({ success: false });
    }
    let data = {};
    data.products = products;
    data.pageNum = Math.ceil(size / ITEMS_PER_PAGE);
    res.send(data);
  } catch (e) {
    return res.status(500).json({ success: false });
  }
});

// Used in product (USER)
router.post(`/get/productsFiltered`, async (req, res) => {
  try {
    const ITEMS_PER_PAGE = 12;

    let count = req.body.page ? req.body.page : 1;
    count = count - 1;

    let category;
    let products;
    let size;

    let sorting = req.body.sort ? req.body.sort : "latest";
    let sortObj;
    if (sorting === Constants.SORTING.LATEST) {
      sortObj = { _id: -1 };
    } else if (sorting === Constants.SORTING.FEATURED) {
      sortObj = { isFeatured: 1, _id: -1 };
    } else if (sorting === Constants.SORTING.BEST) {
      sortObj = {};
    } else if (sorting === Constants.SORTING.HIGH) {
      sortObj = { price: -1 };
    } else if (sorting === Constants.SORTING.LOW) {
      sortObj = { price: 1 };
    } else if (sorting === Constants.SORTING.AtoZ) {
      sortObj = { name: 1 };
    } else if (sorting === Constants.SORTING.ZtoA) {
      sortObj = { name: -1 };
    } else {
      sortObj = { _id: -1 };
    }

    const filterStr = req.body.filters;
    let filters = null;
    try {
      filters = JSON.parse(filterStr);
    } catch (ignore) {}

    if (req.body.catType === "S") {
      category = await SubCategory.findById(req.body.category);

      if (!category) {
        return res.status(404).json({ success: false, message: "Subcategory not found" });
      }
      if (filters && filters.length > 0) {
        products = await Product.find({
          subCategory: req.body.category,
          filterList: { $all: filters },
        })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({
          subCategory: req.body.category,
          filterList: { $all: filters },
        }).count();
      } else {
        products = await Product.find({ subCategory: req.body.category })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({ subCategory: req.body.category }).count();
      }
    } else if (req.body.catType === "I") {
      category = await SubCategory.findOne({ "innerCategories._id": req.body.category });
      if (!category) {
        return res.status(404).json({ success: false, message: "Inner subcategory not found" });
      }
      let tempCat;
      for (let innerCat of category.innerCategories) {
        if (innerCat._id.toString() === req.body.category) {
          tempCat = innerCat;
          break;
        }
      }
      if (!tempCat) {
        return res.status(404).json({ success: false, message: "Inner subcategory not found" });
      }
      category = tempCat;
      if (filters && filters.length > 0) {
        products = await Product.find({
          innerSubCategory: req.body.category,
          filterList: { $all: filters },
        })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({
          innerSubCategory: req.body.category,
          filterList: { $all: filters },
        }).count();
      } else {
        products = await Product.find({ innerSubCategory: req.body.category })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({ innerSubCategory: req.body.category }).count();
      }
    } else {
      category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
      if (filters && filters.length > 0) {
        products = await Product.find({
          category: req.body.category,
          filterList: { $all: filters },
        })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({
          category: req.body.category,
          filterList: { $all: filters },
        }).count();
      } else {
        products = await Product.find({ category: req.body.category })
          .sort(sortObj)
          .skip(count * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
        size = await Product.find({ category: req.body.category }).count();
      }
    }

    if (!products) {
      return res.status(500).json({ success: false });
    }

    let data = {};
    data.products = products;
    data.pageNum = Math.ceil(size / ITEMS_PER_PAGE);
    data.catName = category.name;
    res.send(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false });
  }
});

router.get("/get/productsWithDiscount", async (req, res) => {
  try {
    // Extract page and limit from query parameters
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page if not provided

    // Validate page and limit
    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Page and limit must be positive integers" });
    }

    const products = await Product.aggregate([
      { $unwind: "$variations" },
      { $match: { "variations.discountedPrice": { $gt: 0 } } },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          description: { $first: "$description" },
          image: { $first: "$image" },
          imageAlt: { $first: "$imageAlt" },
          variations: { $push: "$variations" },
          price: { $first: "$price" },
          discountedPrice: { $first: "$discountedPrice" },
          category: { $first: "$category" },
          subCategory: { $first: "$subCategory" },
          innerSubCategory: { $first: "$innerSubCategory" },
          isFeatured: { $first: "$isFeatured" },
          specifications: { $first: "$specifications" },
        },
      },
      { $skip: (page - 1) * limit }, // Skip documents for current page
      { $limit: limit }, // Limit the number of documents returned
    ]);

    // Count total products with discount for pagination metadata
    const totalProducts = await Product.countDocuments({
      "variations.discountedPrice": { $gt: 0 },
    });

    if (!products || products.length === 0) {
      return res.status(404).json({ success: false, message: "No products found with discounts" });
    }

    // Calculate total pages
    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({
      success: true,
      products: products,
      pagination: {
        page: page,
        limit: limit,
        totalProducts: totalProducts,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching products with discounts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/get/crumbs", async (req, res) => {
  try {
    let product;
    let cat;
    let subcat;
    let incat;

    if (req.query.product) {
      product = await Product.findById(req.query.product);
      cat = await Category.findById(product.category?.toString() || "");
      subcat = await SubCategory.findById(product.subCategory?.toString() || "");
      incat = subcat.innerCategories.find(
        (incat) => incat._id.toString() === product.innerSubCategory
      );
    } else {
      if (req.query.catType === "S") {
        subcat = await SubCategory.findById(req.query.category);
        cat = await Category.findOne({ subCategory: req.query.category });
      } else if (req.query.catType === "I") {
        subcat = await SubCategory.findOne({ "innerCategories._id": req.query.category });
        incat = subcat.innerCategories.find((incat) => incat._id.toString() === req.query.category);
        cat = await Category.findOne({ subCategory: subcat._id });
      } else {
        cat = await Category.findById(req.query.category);
      }
    }

    let data = {};
    data = {
      cat: cat
        ? {
            name: cat.name,
            id: cat._id,
          }
        : null,
      subcat: subcat
        ? {
            name: subcat.name,
            id: subcat._id,
          }
        : null,
      incat: incat
        ? {
            name: incat.name,
            id: incat._id,
          }
        : null,
      product: product
        ? {
            name: product.name,
            id: product._id,
          }
        : null,
    };

    res.send(data);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false });
  }
});

/*
router.get(`/get/featured/:count`, auth0Verify, async (req, res) =>{
    const count = req.params.count ? req.params.count : 0
    const products = await Product.find({isFeatured: true}).limit(+count);

    if(!products) {
        return res.status(500).json({success: false})
    }
    res.send(products);
})
*/

router.put(
  "/gallery-images/:id",
  verifyTokenAndAdmin,
  uploadOptions.array("images", 10),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).send("Invalid Product Id");
    }
    const files = req.files;
    let imagesPaths = [];
    const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

    if (files) {
      files.map((file) => {
        imagesPaths.push(`${basePath}${file.filename}`);
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        images: imagesPaths,
      },
      { new: true }
    );

    if (!product) return res.status(500).send("the gallery cannot be updated!");

    res.send(product);
  }
);

module.exports = router;
