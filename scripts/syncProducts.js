const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Souvenir items data
const souvenirItems = [
    {
        name: "ASH-TREY NEW",
        price: 325,
        description: "Official Rimcollian ash tray with school emblem.",
        image: "/shop/ASH-TREY_NEW.png",
        stock: 15,
        category: "souvenir"
    },
    {
        name: "ASH-TREY OLD",
        price: 110,
        description: "Classic design ash tray with Rimcollian emblem.",
        image: "/shop/ASH-TREY_OLD.png",
        stock: 20,
        category: "souvenir"
    },
    {
        name: "BLEZER CREST",
        price: 500,
        description: "Embroidered blazer crest with Rimcollian emblem.",
        image: "/shop/BLEZER_CREST.png",
        stock: 25,
        category: "souvenir"
    },
    {
        name: "BLUE SHORT",
        price: 420,
        description: "Official Rimcollian blue shorts for sports.",
        image: "/shop/BLUE_SHORT.png",
        stock: 30,
        category: "souvenir"
    },
    {
        name: "BROCHURE",
        price: 10,
        description: "Rimcollian informational brochure.",
        image: "/shop/BROCHURE.png",
        stock: 100,
        category: "souvenir"
    },
    {
        name: "BUTTON SET SILVER",
        price: 7000,
        description: "Premium silver button set with Rimcollian crest.",
        image: "/shop/BUTTON_SET_SILVER.png",
        stock: 5,
        category: "souvenir"
    },
    {
        name: "BUTTON SET WHITE METAL",
        price: 770,
        description: "White metal button set featuring Rimcollian crest.",
        image: "/shop/BUTTON_SET_WHITE_METAL.png",
        stock: 15,
        category: "souvenir"
    },
    {
        name: "CRAVET",
        price: 600,
        description: "Formal cravat with subtle Rimcollian pattern.",
        image: "/shop/CRAVET.png",
        stock: 18,
        category: "souvenir"
    },
    {
        name: "CTL SET",
        price: 550,
        description: "Complete cufflinks and tie bar set.",
        image: "/shop/CTL_SET.png",
        stock: 12,
        category: "souvenir"
    },
    {
        name: "GOLF CAP WITH CREST",
        price: 450,
        description: "Navy blue golf cap with embroidered Rimcollian crest.",
        image: "/shop/GOLF_CAP_WITH_CREST.png",
        stock: 20,
        category: "souvenir"
    },
    {
        name: "HALF SLEEVE SHIRT WITH CREST",
        price: 825,
        description: "White half sleeve shirt with Rimcollian crest.",
        image: "/shop/HALF_SLEEVE_SHIRT_WITH_CREST.png",
        stock: 25,
        category: "souvenir"
    },
    {
        name: "HALF SLEEVE SHIRT WITHOUT CREST",
        price: 795,
        description: "Plain white half sleeve shirt without crest.",
        image: "/shop/HALF_SLEEVE_SHIRT_WITHOUT_CREST.png",
        stock: 25,
        category: "souvenir"
    },
    {
        name: "FIRST DAY COVER",
        price: 20,
        description: "Commemorative first day postal cover.",
        image: "/shop/FIRST_DAY_COVER.png",
        stock: 50,
        category: "souvenir"
    },
    {
        name: "FIRST DAY COVER CANCELLED",
        price: 50,
        description: "Cancelled commemorative first day postal cover.",
        image: "/shop/FIRST_DAY_COVER_CANCELLED.png",
        stock: 30,
        category: "souvenir"
    },
    {
        name: "LAPEL PIN SILVER",
        price: 800,
        description: "Silver lapel pin with Rimcollian crest.",
        image: "/shop/LAPEL_PIN_SILVER.png",
        stock: 10,
        category: "souvenir"
    },
    {
        name: "LAPEL PIN WHITE METAL",
        price: 200,
        description: "White metal lapel pin with Rimcollian crest.",
        image: "/shop/LAPEL_PIN_WHITE_METAL.png",
        stock: 25,
        category: "souvenir"
    },
    {
        name: "MEMENTO PLATE BIG",
        price: 1200,
        description: "Large commemorative plate with Rimcollian design.",
        image: "/shop/MEMENTO_PLATE_BIG.png",
        stock: 8,
        category: "souvenir"
    },
    {
        name: "METAL CREST",
        price: 600,
        description: "Detailed metal Rimcollian crest for display.",
        image: "/shop/METAL_CREST.png",
        stock: 15,
        category: "souvenir"
    },
    {
        name: "POCKET SQURE",
        price: 200,
        description: "Navy pocket square with Rimcollian design.",
        image: "/shop/POCKET_SQURE.png",
        stock: 30,
        category: "souvenir"
    },
    {
        name: "RIMC CRESTED WHITE BEER MUG",
        price: 1500,
        description: "White ceramic beer mug with Rimcollian crest.",
        image: "/shop/RIMC_CRESTED_WHITE_BEER_MUG.png",
        stock: 12,
        category: "souvenir"
    },
    {
        name: "RIMC HOODIE JACKET",
        price: 700,
        description: "Navy hoodie jacket with Rimcollian crest.",
        image: "/shop/RIMC_HOODIE_JACKET.png",
        stock: 18,
        category: "souvenir"
    },
    {
        name: "RIMC FULL SLEEVE SHIRT",
        price: 550,
        description: "White full sleeve shirt with Rimcollian crest.",
        image: "/shop/RIMC_FULL_SLEEVE_SHIRT.png",
        stock: 22,
        category: "souvenir"
    },
    {
        name: "RIMCOLLIAN MAROON TRACK SUIT",
        price: 1050,
        description: "Maroon track suit with Rimcollian branding.",
        image: "/shop/RIMCOLLIAN_MAROON_TRACK_SUIT.png",
        stock: 15,
        category: "souvenir"
    },
    {
        name: "RIMC TRACK LOWER & UPPER",
        price: 1350,
        description: "Complete track suit with Rimcollian branding.",
        image: "/shop/RIMC_TRACK_LOWER_&_UPPER.png",
        stock: 14,
        category: "souvenir"
    },
    {
        name: "RIMC T SHIRT",
        price: 500,
        description: "Navy blue t-shirt with Rimcollian crest.",
        image: "/shop/RIMC_T_SHIRT.png",
        stock: 35,
        category: "souvenir"
    },
    {
        name: "ROLLER PEN WITH BOX",
        price: 320,
        description: "Quality roller pen with Rimcollian branding.",
        image: "/shop/ROLLER_PEN_WITH_BOX.png",
        stock: 20,
        category: "souvenir"
    },
    {
        name: "SILVER SAREE BROOCH",
        price: 3400,
        description: "Elegant silver saree brooch with Rimcollian design.",
        image: "/shop/SILVER_SAREE_BROOCH.png",
        stock: 5,
        category: "souvenir"
    },
    {
        name: "STAMP",
        price: 300,
        description: "Commemorative Rimcollian stamp collection.",
        image: "/shop/STAMP.png",
        stock: 25,
        category: "souvenir"
    },
    {
        name: "TIE PIN",
        price: 200,
        description: "Elegant tie pin with Rimcollian crest.",
        image: "/shop/TIE_PIN.png",
        stock: 28,
        category: "souvenir"
    },
    {
        name: "TIE RIMCOLLIAN",
        price: 400,
        description: "Navy tie with Rimcollian crest pattern.",
        image: "/shop/TIE_RIMCOLLIAN.png",
        stock: 30,
        category: "souvenir"
    },
    {
        name: "T SHIRT VATS",
        price: 500,
        description: "Blue sports t-shirt with Rimcollian emblem.",
        image: "/shop/T_SHIRT_VATS.png",
        stock: 20,
        category: "souvenir"
    }
];

// Function to sync products
async function syncProducts() {
    try {
        const results = [];

        for (const item of souvenirItems) {
            const existingProduct = await Product.findOne({ name: item.name });

            if (existingProduct) {
                // Update existing product
                existingProduct.price = item.price;
                existingProduct.description = item.description;
                existingProduct.image = item.image;
                existingProduct.stock = item.stock;
                existingProduct.category = item.category;
                await existingProduct.save();
                results.push({ name: item.name, action: 'updated' });
            } else {
                // Create new product
                const newProduct = new Product(item);
                await newProduct.save();
                results.push({ name: item.name, action: 'created' });
            }
        }

        console.log('Products synced successfully:', results);
    } catch (error) {
        console.error('Error syncing products:', error);
    } finally {
        mongoose.disconnect();
    }
}

// Run the sync
syncProducts(); 