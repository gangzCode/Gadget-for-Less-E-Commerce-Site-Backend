const {Category} = require('../models/category');
const express = require('express');
const router = express.Router();
const {verifyTokenAndAdmin,} = require("./verifyToken");
const {SubCategory} = require("../models/subCategory");
const {FilterGroup} = require("../models/filterGroups");
const {Filter} = require("../models/filter");
const aws = require("aws-sdk");
const uuid = require("uuid"); // Import the UUID library
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const mongoose = require("mongoose");

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

const uploadAWS = (filterId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${filterId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

router.get(`/getFilterGroup`, async (req, res) =>{
    try {
        const filterList = await FilterGroup.find().populate('filters');
        if(!filterList) {
            return res.status(500).json({success: false})
        }
        res.status(200).send(filterList);
    }catch (e) {
        console.error(e)
        res.status(500).send();
    }

})

router.get(`/getAllFilters`, async (req, res) =>{
    try {
        const filterList = await Filter.find();
        if(!filterList) {
            return res.status(500).json({success: false})
        }
        res.status(200).send(filterList);
    }catch (e) {
        console.error(e)
        res.status(500).send();
    }

})

router.get(`/getCardFilters`, async (req, res) =>{
    try {
        const filterList = await Filter.find({showAsCard: true}).limit(4);
        if(!filterList) {
            return res.status(500).json({success: false})
        }
        res.status(200).send(filterList);
    }catch (e) {
        console.error(e)
        res.status(500).send();
    }

})

router.post('/createFilterGroup', verifyTokenAndAdmin, async (req, res) => {
    try {
        const filterIds = req.body.filters || [];
        const filtersExist = await Filter.find({ _id: { $in: filterIds } }).countDocuments();

        if (filtersExist !== filterIds.length) {
            return res.status(400).send({ message: 'One or more filters do not exist' });
        }

        // Check if any of the filters are already assigned to a filter group
        const filterGroups = await FilterGroup.find({ filters: { $in: filterIds } });
        if (filterGroups.length > 0) {
            return res.status(400).send({ message: 'One or more filters are already assigned to another filter group' });
        }

        let filterGroup = new FilterGroup({
            name: req.body.name,
            filters: filterIds,
        });
        filterGroup = await filterGroup.save();

        // Update the filters with the filter group ID
        await Filter.updateMany(
            { _id: { $in: filterIds } },
            { $set: { filterGroup: filterGroup._id } }
        );

        return res.status(200).send(filterGroup);
    } catch (e) {
        console.error(e);
        return res.status(400).send({ message: 'Error creating filter group' });
    }
});

router.post('/createFilter', verifyTokenAndAdmin, async (req, res) => {
    let filterId;
    try {
      // Step 1: Create a temporary filter record in the database
      let filter = new Filter({
        name: req.body.name || "TEMP",
        showAsCard: req.body.showAsCard || false,
        tagLine: req.body.tagLine || "TEMP",
        filterGroup: mongoose.Types.ObjectId.isValid(req.body.filterGroup) ? req.body.filterGroup : null,
      });
      filter = await filter.save();
      filterId = filter._id.toString();
  
      // Step 2: Handle file uploads to AWS S3
      uploadAWS(filterId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          console.error("Upload Error:", err);  // Add this line to log the error
          return res.status(500).send({ message: 'The filter cannot be created', error: err });
        }
  
        // Step 3: Update the filter with new data and uploaded image URL
        filter = await updateFilter(filterId, req.body, req.files);
  
        if (!filter) {
          return res.status(500).send({ message: 'The filter cannot be created' });
        }
        res.status(200).send(filter);
      });
    } catch (e) {
      console.error(e);
  
      // Clean up the filter record if an error occurs
      try {
        if (filterId) {
          await Filter.findByIdAndDelete(filterId);
        }
      } catch (ignore) {}
  
      return res.status(500).send({ message: 'The filter cannot be created', error: e.message });
    }
});
  
async function updateFilter(filterId, data, fileList) {
    // Validate and set filter group
    const filterGroup = mongoose.Types.ObjectId.isValid(data.filterGroup)
      ? data.filterGroup
      : null;
  
    // Prepare the file path
    let imageUrl = '';
    if (fileList && fileList.image && fileList.image[0]) {
      imageUrl = fileList.image[0].location;
    }
  
    // Update the filter with new data
    let updateData = {
      name: data.name,
      showAsCard: JSON.parse(data.showAsCard),
      tagLine: data.tagLine,
      ...(imageUrl && { image: imageUrl }),
    //   filterGroup: filterGroup,
    };
  
    let filter = await Filter.findByIdAndUpdate(filterId, updateData, { new: true });
  
    return filter;
}  

router.put('/editFilterGroup', verifyTokenAndAdmin, async (req, res) => {
    try {
        const filterGroupId = req.body.groupId;
        const updatedData = req.body.updatedData;
        
        // Check if provided filter IDs exist
        if (updatedData.filters) {
            const filterIds = updatedData.filters;
            const filtersExist = await Filter.find({ _id: { $in: filterIds } }).countDocuments();
            
            if (filtersExist !== filterIds.length) {
                return res.status(400).send({ message: 'One or more filters do not exist' });
            }
        }

        // Find the existing filter group
        const existingFilterGroup = await FilterGroup.findById(filterGroupId);
        if (!existingFilterGroup) {
            return res.status(404).send({ message: 'Filter group not found' });
        }

        // Determine which filters are being added and which are being removed
        const newFilters = updatedData.filters || [];
        const oldFilters = existingFilterGroup.filters.map(f => f.toString());

        const filtersToAdd = newFilters.filter(id => !oldFilters.includes(id));
        const filtersToRemove = oldFilters.filter(id => !newFilters.includes(id));

        // Update the filterGroup field for filters being added
        if (filtersToAdd.length > 0) {
            await Filter.updateMany(
                { _id: { $in: filtersToAdd } },
                { $set: { filterGroup: filterGroupId } }
            );
        }

        // Unset the filterGroup field for filters being removed
        if (filtersToRemove.length > 0) {
            await Filter.updateMany(
                { _id: { $in: filtersToRemove } },
                { $unset: { filterGroup: '' } }
            );
        }

        // Update the filter group with the new data
        const filterGroup = await FilterGroup.findByIdAndUpdate(
            filterGroupId,
            updatedData,
            { new: true }
        );

        if (!filterGroup) {
            return res.status(404).send({ message: 'Filter group not found' });
        }
        
        return res.status(200).send(filterGroup);
    } catch (e) {
        console.error(e);
        return res.status(500).send({ message: 'Error editing filter group' });
    }
});

/* router.put('/editFilter', verifyTokenAndAdmin, async (req, res) => {
    try {
        const filterId = req.body.filterId;
        const updatedData = req.body.updatedData;

        const filter = await Filter.findByIdAndUpdate(filterId, updatedData, { new: true });
        if (!filter) {
            return res.status(404).send({ message: 'Filter not found' });
        }
        
        return res.status(200).send(filter);
    } catch (e) {
        console.error(e);
        return res.status(500).send({ message: 'Error editing filter' });
    }
}); */

router.post(`/editFilter`, verifyTokenAndAdmin, async (req, res) => {
    try {
        const filterId = req.query.filterId;
        if (!filterId) {
            return res.status(400).send({ message: "Filter ID is required" });
        }

        // Handle file uploads to AWS S3
        uploadAWS(filterId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
            if (err) {
                console.error("Upload Error:", err);
                return res.status(500).send({ message: "The filter cannot be updated", error: err.message });
            }

            // Update the filter with new data and uploaded image URL
            try {
                const filter = await updateFilter(filterId, req.body, req.files);
                if (!filter) {
                    return res.status(404).send({ message: "Filter not found" });
                }
                return res.status(200).send(filter);
            } catch (updateError) {
                console.error("Update Error:", updateError);
                return res.status(500).send({ message: "The filter cannot be updated", error: updateError.message });
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({ message: "The filter cannot be updated", error: e.message });
    }
});

router.get('/getUnassignedFilters', async (req, res) => {
    try {
        const unassignedFilters = await Filter.find({ filterGroup: null });
        if (!unassignedFilters) {
            return res.status(500).json({ success: false });
        }
        res.status(200).send(unassignedFilters);
    } catch (e) {
        console.error(e);
        res.status(500).send();
    }
});


router.post('/delete', verifyTokenAndAdmin, async (req, res) => {
    try {
        if (req.body.isFilter) {
            const filterId = req.body.filterId;

            // Check if the filter is assigned to any filter group
            const filterGroup = await FilterGroup.findOne({ filters: filterId });

            if (filterGroup) {
                // Find and remove the filter from all filter groups
                await FilterGroup.updateMany(
                    { filters: filterId },
                    { $pull: { filters: filterId } }
                );
            }

            // Delete the filter
            await Filter.findByIdAndDelete(filterId);
            return res.status(200).send({ message: 'Filter deleted successfully' });
        } else {
            const filterGroupId = req.body.groupId;
            const filterGroup = await FilterGroup.findById(filterGroupId);

            if (!filterGroup) {
                return res.status(404).send({ message: 'Filter group not found' });
            }

            if (filterGroup.filters.length > 0) {
                // Update all filters in the filter group to have no filter group ID
                await Filter.updateMany(
                    { _id: { $in: filterGroup.filters } },
                    { $unset: { filterGroup: '' } }
                );
            }

            // Delete the filter group
            await FilterGroup.findByIdAndDelete(filterGroupId);
            return res.status(200).send({ message: 'Filter group deleted successfully' });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).send({ message: 'Error deleting filter or filter group' });
    }
});

module.exports = router;