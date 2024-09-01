const express = require('express');
require('dotenv/config');
const app = express();
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
//const { auth } = require('express-openid-connect');

//Uploaded image folder
app.use('/public', express.static('public'));

//middleware
app.use(cors());
app.options('*', cors());
//Auth 0 middleware
// app.use(
//     auth({
//       authRequired: false,
//       auth0Logout: true,
//       issuerBaseURL: process.env.ISSUER_BASE_URL,
//       baseURL: 'http://localhost:4000',
//       clientID: process.env.CLIENT_ID,
//       secret: process.env.SECRET,
//       idpLogout: true,
//     })
//   );


//Middleware
app.use(express.json());
app.use(morgan('tiny'));

//Routes
const productsRoutes = require('./routers/product');
const categoriesRoutes = require('./routers/categories');
const filterRoutes = require('./routers/filters');
const newsLetterssRoutes = require('./routers/news-letters');
const userRoutes = require("./routers/user");
const taxRoutes = require("./routers/tax");
const clientRoutes = require("./routers/client-router");
const authRoutes = require("./routers/auth");
const cartRoutes = require("./routers/carts");
const wishlistRoutes = require("./routers/wishlist");
const searchRoutes = require("./routers/search");
const orderRoutes = require("./routers/orders");
const subCategoryRoutes = require("./routers/subCategories");
const shippingPriceRoutes = require("./routers/shippingPrice-router");

const api = process.env.API_URL;

app.use(`${api}/products`, productsRoutes);
app.use(`${api}/categories`, categoriesRoutes);
app.use(`${api}/filters`, filterRoutes);
app.use(`${api}/news-letters`, newsLetterssRoutes);
app.use(`${api}/auth`, authRoutes);
app.use(`${api}/user`, userRoutes);
app.use(`${api}/tax`, taxRoutes);
app.use(`${api}/clients`, clientRoutes);
app.use(`${api}/order`, orderRoutes);
app.use(`${api}/cart`, cartRoutes);
app.use(`${api}/wishlist`, wishlistRoutes);
app.use(`${api}/search`, searchRoutes);
app.use(`${api}/subCategories`, subCategoryRoutes);
app.use(`${api}/shipping`, shippingPriceRoutes);

app.get('/', (req,res,next) =>{
    res.send("hello gangez")
});

// app.get('/', (req,res) =>{
//     res.send(req.oidc.isAuthenticated()? 'Logged in' : 'Logged out')
// })

const PORT = process.env.PORT || 4000;

//Database
mongoose
    .connect(process.env.CONNECTION_STRING, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: process.env.DB_NAME
    })
    .then(() => {
        console.log('we are using ' + process.env.DB_NAME);
        console.log('Database Connection is ready...');
    })
    .catch((err) => {
        console.log(err);
    });

//server
app.listen(PORT, () => {
    console.log('server is running http://localhost:4000');
});