const express = require('express');
const axios = require('axios');
const { Buffer } = require("node:buffer");
const Jimp = require('jimp');
const admin = require('firebase-admin');
const cors = require('cors');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const port = 3000 | process.env.PORT;
const serviceAccount = require("./e-xcheck-firebase-adminsdk-cfxsa-bfba45c701.json");
const dayjs = require('dayjs');
require('dotenv').config()

const azureURL = process.env.AZURE_URL;
const azureKey = process.env.AZURE_KEY;

const filterPredictions = (predictions, confidence) => {
    return predictions.filter(prediction => prediction.probability > confidence);
}


const app = express();
const firebaseApp = initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore();


app.use(cors());
app.use(express.json({limit: '50mb'}));

// respond with "hello world" when a GET request is made to the homepage
app.post('/predict-image', async (req, res) => {
    const {image, confidence} = req.body;
    try{

        const stripedImage = image.replace(/^data:image\/\w+;base64,/, "");

        const b64Buffer = Buffer.from(stripedImage, 'base64');
        const response = await axios.post(azureURL, b64Buffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Prediction-Key': azureKey
            }
        });

        const filteredPredictionsResult = filterPredictions(response.data.predictions, confidence);
    
        // crop out all predicted images using Jimp
        const jimpImages = await Promise.all(filteredPredictionsResult.map(async (prediction) => {
            const image = await Jimp.read(b64Buffer);
            const {left, top, width, height} = prediction.boundingBox;
            const croppedImage = await image.crop(
                left * image.bitmap.width,
                top * image.bitmap.height,
                width * image.bitmap.width,
                height * image.bitmap.height
            );
            const croppedImageBuffer = await croppedImage.getBufferAsync(Jimp.MIME_JPEG);
            return 'data:image/jpeg;base64,'+croppedImageBuffer.toString('base64');
        }));

        // insert product with product info to result array
        const productInfo = await Promise.all(filteredPredictionsResult.map(async (prediction, index) => {
            //console.log(prediction.tagName);
            const productRef = db.collection('products').doc(prediction.tagName ? prediction.tagName : '');
            const doc = await productRef.get();
            if (!doc.exists) {
                return { ...prediction, image: jimpImages[index], productInfo: null};
            } else {
                return { productInfo: doc.data() , ...prediction, image: jimpImages[index], };
            }
        }));

        await Promise.all(productInfo);

        res.json({
            result: productInfo,
        });

    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.post('/product', async (req, res) => {
    const {productInfo} = req.body;
    try{
        const docRef = db.collection('products').doc(productInfo.name);
        await docRef.set(productInfo);
        res.json({
            result: productInfo,
        });
    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.get('/products', async (req, res) => {
    try{
        const snapshot = await db.collection('products').get();
        const products = [];
        snapshot.forEach(doc => {
            products.push(doc.data());
        });
        res.json({
            result: products,
        });
    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.post('/checkout', async (req, res) => {
    const {products} = req.body;
    try{
        const result = await db.collection('transactions').add({
            products,
            createdAt: new Date(),
        }); 
        res.json({
            result
        });
    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.get('/transactions', async (req, res) => {
    try{
        const snapshot = await db.collection('transactions').get();
        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push(doc.data());
        });

        // sum up total price of each transaction
        transactions.forEach(transaction => {
            transaction.createdAt = new Date(transaction.createdAt.toDate());
            transaction.totalPrice = transaction.products.reduce((acc, product) => {
                return acc + parseFloat(product.price);
            }, 0);
        });

        // sort by date
        transactions.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // group by date and calculate total price for each date
        const groupedTransactions = transactions.reduce((acc, transaction) => {
            const date = dayjs(transaction.createdAt).format('DD/MM/YYYY');
            if (acc[date]) {
                acc[date].totalPrice += transaction.totalPrice;
                acc[date].transactions.push(transaction);
            } else {
                acc[date] = {
                    totalPrice: transaction.totalPrice,
                    transactions: [transaction],
                }
            }
            return acc;
        }, {});

        res.json({
            result: groupedTransactions,
        });
    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.get('/transaction/:id', async (req, res) => {
    const {id} = req.params;
    try{
        const docRef = db.collection('transactions').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            res.json({
                result: null,
            });
        } else {
            res.json({
                result: doc.data(),
            });
        }
    }catch (e) {
        console.log(e);
        res.status(400).send(e.stack);
    }
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});