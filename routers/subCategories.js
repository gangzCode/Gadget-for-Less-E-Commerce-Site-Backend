const { SubCategory } = require('../models/subCategory');
const express = require('express');
const router = express.Router();
const {
    verifyToken,
    verifyTokenAndAuthorization,
    verifyTokenAndAdmin,
  } = require("./verifyToken");  

router.get(`/`, async (req, res) =>{
    const subCategoryList = await SubCategory.find();

    if(!subCategoryList) {
        return res.status(500).json({success: false})
    } 
    res.status(200).send(subCategoryList);
})

router.get('/:id', async(req,res)=>{
    const subCategory = await SubCategory.findById(req.params.id);

    if(!subCategory) {
        return res.status(500).json({message: 'The sub category with the given ID was not found.'})
    } 
    res.status(200).send(subCategory);
})

router.post('/', async (req,res)=>{
    let subCategory = new SubCategory({
        name: req.body.name,
    })
    subCategory = await subCategory.save();

    if(!subCategory)
    return res.status(400).send('the sub category cannot be created!')

    res.send(subCategory);
})

router.put('/:id',async (req, res)=> {
    const subCategory = await SubCategory.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
        },
        { new: true}
    )

    if(!subCategory)
    return res.status(400).send('the sub category cannot be created!')

    res.send(subCategory);
})

router.delete('/:id', (req, res)=>{
    SubCategory.findByIdAndDelete(req.params.id).then(subCategory =>{
        if(subCategory) {
            return res.status(200).json({success: true, message: 'the sub category is deleted!'})
        } else {
            return res.status(404).json({success: false , message: "sub category not found!"})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})

module.exports =router;