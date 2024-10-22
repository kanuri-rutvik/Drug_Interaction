const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
 // Importing model from the file
const app = express();

// CORS configuration
app.use(cors());
app.use(express.json());

// Connect to MongoDB once
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/dd_interaction'; // Example: for local MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Drug Schema
const drugSchema = new mongoose.Schema({
    drug_name: String,
    medical_condition: String,
    side_effects: String,
    generic_name: String,
    drug_classes: String,
    brand_names: String,
    activity: String,
    rx_otc: String,
    pregnancy_category: String,
    csa: String,
    alcohol: String,
    related_drugs: String,
    medical_condition_description: String,
    rating: Number,
    no_of_reviews: Number,
    drug_link: String,
    medical_condition_url: String
});
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const interactionSchema = new mongoose.Schema({
    Drug_1: { type: String, required: true },
    Drug_2: { type: String, required: true },
    Interaction_Description: { type: String, required: true }
});

const Drug = mongoose.model('Drug', drugSchema, 'dd_collection');
const Interaction = mongoose.model('Interaction', interactionSchema, 'd2d_collection');
const User = mongoose.model('User', userSchema, 'users');
// API to handle user registration
app.post("/register", async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }

    // Create a new user instance
    const newUser = new User({
        firstName,
        lastName,
        email,
        password,
    });

    try {
        await newUser.save(); // Save user to MongoDB
        res.status(200).json({ message: "User registered successfully" });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: "Error registering user" });
    }
});

// API to get drug information by name
app.get('/api/drugs/:name', async (req, res) => {
    try {
        const drug = await Drug.findOne({ drug_name: req.params.name });
        if (!drug) return res.status(404).json({ message: 'Drug not found' });
        res.json(drug);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// API to get all drugs
app.get('/api/drugs', async (req, res) => {
    try {
        const drugs = await Drug.find();
        res.json(drugs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Updated API to check for drug interactions
app.post('/check-interaction', async (req, res) => {
    const { drugs } = req.body;
  
    if (!drugs || drugs.length < 2) {
      return res.status(400).send("At least two drugs are required to check interactions.");
    }
  
    try {
      // Generate all pair combinations of drugs
      const drugPairs = [];
      for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
          drugPairs.push({ Drug_1: drugs[i], Drug_2: drugs[j] });
        }
      }
  
      // Check for interactions in the database
      const interactions = await Promise.all(
        drugPairs.map(pair =>
          Interaction.findOne({
            $or: [
              { Drug_1: new RegExp(`^${pair.Drug_1}$`, 'i'), Drug_2: new RegExp(`^${pair.Drug_2}$`, 'i') },
              { Drug_1: new RegExp(`^${pair.Drug_2}$`, 'i'), Drug_2: new RegExp(`^${pair.Drug_1}$`, 'i') }
            ]
          })
        )
      );
  
      // Filter out any null values (where no interaction was found)
      const interactionResults = drugPairs.map((pair, index) => {
        return interactions[index]
          ? interactions[index]
          : { Drug_1: pair.Drug_1, Drug_2: pair.Drug_2, Interaction_Description: 'No interaction' };
      });
  
      res.json(interactionResults);
    } catch (error) {
      console.error("Error checking drug interaction:", error);
      res.status(500).send(error.message);
    }
  });
  

// Define Routes (Assuming ./routes/auth is set up)
app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
