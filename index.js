const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());

// JWT Token
const jwt = require("jsonwebtoken");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@choloaki.pdqwxhs.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("choloakiDB").collection("users");
    const classCollection = client.db("choloakiDB").collection("classes");

    //JWT token post
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: "1h" });
      res.send({ token });
    });

    //Getting data from db
    app.get("/instructors", async (req, res) => {
      let query = { role: "instructor" };
      let sortby = { _id: -1 };

      //Query for Name wise data
      if (req.query?.toy_name) {
        const toyNameSearch = new RegExp(req.query.toy_name, "i");
        query = { toy_name: { $regex: toyNameSearch } };
      }

      //Query for category wise data
      if (req.query?.category) {
        query = { category: req.query.category };
      }

      //Query for Price Sort
      if (req.query?.price) {
        sortby = { toy_price: req.query.price };
      }

      const result = await userCollection.find(query).sort(sortby).toArray();
      res.send(result);
    });

    //Getting approved classes for public
    app.get("/classes/approved", async (req, res) => {
      let query = {};
      let sortby = { _id: -1 };

      query = { status: "approved" };

      const result = await classCollection.find(query).sort(sortby).toArray();
      res.send(result);
    });

    // User Upload
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      let existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/mytoys", async (req, res) => {
      let mysortby = { _id: -1 };
      let myquery = {};
      //For Pagination
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 20;
      const skip = page * limit;

      //Query for Name wise data
      if (req.query?.toy_name) {
        const toyNameSearch = new RegExp(req.query.toy_name, "i");
        myquery = { toy_name: { $regex: toyNameSearch } };
      }

      //Query for email wise data
      if (req.query?.uploaded_by) {
        myquery = { seller_email: req.query.uploaded_by };
      }

      //Query for email and Toy Name wise data
      if (req.query?.uploaded_by && req.query?.toy_name) {
        const MytoyNameSearch = new RegExp(req.query.toy_name, "i");
        myquery = {
          seller_email: req.query.uploaded_by,
          toy_name: { $regex: MytoyNameSearch },
        };
      }
      const result = await toysCollection
        .find(myquery)
        .skip(skip)
        .limit(limit)
        .sort(mysortby)
        .toArray();
      res.send(result);
    });

    //Getting categories from db
    app.get("/categories", async (req, res) => {
      const categoriesWithCount = await toysCollection
        .aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }, // Sort categories in ascending order
        ])
        .toArray();
      res.send(categoriesWithCount);
    });
    //Query for finding specific toy data
    app.get("/toy/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const toy = await toysCollection.findOne(query);
      res.send(toy);
    });
    //Query for updating specific toy data
    app.put("/toy/:id", async (req, res) => {
      const id = req.params.id;
      const toy = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updatedToy = {
        $set: {
          toy_name: toy.toy_name,
          toy_image: toy.toy_image,
          category: toy.category,
          toy_price: toy.toy_price,
          toy_quantity: toy.toy_quantity,
          toy_description: toy.toy_description,
          toyrating: toy.toyrating,
        },
      };
      const result = await toysCollection.updateOne(
        filter,
        updatedToy,
        options
      );
      res.send(result);
    });

    // Insert Toy
    app.post("/toys", async (req, res) => {
      const toy = req.body;
      const result = await toysCollection.insertOne(toy);
      res.send(result);
    });
    // Delete Toy
    app.delete("/toy/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await toysCollection.deleteOne(query);
      if (result.deletedCount === 1) {
        console.log("Successfully deleted one toy.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }
      res.send(result);
    });

    // Total Toys
    app.get("/totalToys", async (req, res) => {
      let myquery = {};
      //Query for Name wise data
      if (req.query?.toy_name) {
        const toyNameSearch = new RegExp(req.query.toy_name, "i");
        myquery = { toy_name: { $regex: toyNameSearch } };
      }
      const result = await toysCollection.countDocuments(myquery);
      res.send({ total_toys: result });
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is choloaki data sever!");
});

app.listen(port, () => {
  console.log(`Choloaki server listening on port ${port}`);
});
