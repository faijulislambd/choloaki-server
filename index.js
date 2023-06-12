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

//Veify JWT Middlewire
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const cartCollection = client.db("choloakiDB").collection("cart");

    //JWT token post
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: "1h" });
      res.send({ token });
    });

    //Veify Admin JWT Middlewire

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //Veify Instructor JWT Middlewire

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //Veify Student JWT Middlewire

    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "student") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // check admin
    app.get("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    // check instructor
    app.get("/user/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    // check student
    app.get("/user/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    //Getting data from db
    app.get("/instructors", async (req, res) => {
      let query = { role: "instructor" };
      let sortby = { _id: -1 };

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

    //Getting class of specific teacher
    app.get("/teacher/classes", async (req, res) => {
      let query = {};
      const email = req.query.email;
      let sortby = { _id: -1 };

      query = { instructor_email: email };

      const result = await classCollection.find(query).sort(sortby).toArray();
      res.send(result);
    });

    //Getting all classes
    app.get("/admin/classes", async (req, res) => {
      let sortby = { _id: -1 };
      const result = await classCollection.find().sort(sortby).toArray();
      res.send(result);
    });

    // Feedback To Class
    app.patch("/admin/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;
      const filter = { _id: new ObjectId(id) };
      const updatedFeedback = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classCollection.updateOne(filter, updatedFeedback);
      res.send(result);
    });

    //Class status update
    app.patch("/admin/class/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status: status,
        },
      };
      const result = await classCollection.updateOne(filter, updatedStatus);
      res.send(result);
    });

    // User New Class
    app.post("/teacher/new-class", async (req, res) => {
      const cls = req.body;
      const result = await classCollection.insertOne(cls);
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

    //Get Users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      const email = req.query.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      res.send(result);
    });

    //Users Role Change
    app.patch("admin/users/role/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updatedRole = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedRole);
      res.send(result);
    });

    // Cart Upload
    app.post("/cart", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    //Get cart
    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // Delete Cart Item
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      if (result.deletedCount === 1) {
        console.log("Removed Cart Item");
      } else {
        console.log("No Items Deleted");
      }
      res.send(result);
    });
    // Seat Patch
    app.patch("/classes/seat/:id", async (req, res) => {
      const id = req.params.id;
      const seat = req.body.seats;
      const filter = { _id: new ObjectId(id) };
      const updatedClass = {
        $set: {
          seats: seat,
        },
      };
      console.log(seat);
      const result = await classCollection.updateOne(filter, updatedClass);
      res.send(result);
    });
    // Seat Get
    app.get("/classes/seat/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query, {
        projection: { seats: 1 },
      });
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
