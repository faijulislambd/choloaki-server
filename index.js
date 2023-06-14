const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const paymentsCollection = client.db("choloakiDB").collection("payments");

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
    app.get(
      "/teacher/classes",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        let query = {};
        const email = req.query.email;
        let sortby = { _id: -1 };

        query = { instructor_email: email };

        const result = await classCollection.find(query).sort(sortby).toArray();
        res.send(result);
      }
    );

    //Getting all classes
    app.get("/admin/classes", verifyJWT, verifyAdmin, async (req, res) => {
      let sortby = { _id: -1 };
      const result = await classCollection.find().sort(sortby).toArray();
      res.send(result);
    });

    // Feedback To Class
    app.patch(
      "/admin/feedback/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    //Class status update
    app.patch(
      "/admin/class/status/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // Teacher New Class
    app.post(
      "/teacher/new-class",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const cls = req.body;
        const result = await classCollection.insertOne(cls);
        res.send(result);
      }
    );

    // Edit Class
    app.patch(
      "/instructor/class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const classData = req.body;

        const updatedClassData = {
          $set: {
            name: classData.name,
            seats: classData.seats,
            price: classData.price,
            image: classData.image,
          },
        };
        const result = await classCollection.updateOne(
          filter,
          updatedClassData
        );
        res.send(result);
      }
    );

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

    //Get Users Roles For Logged In User
    app.get("/users/role/:email", async (req, res) => {
      const query = { email: req.params.email };
      const option = { projection: { role: 1 } };
      const result = await userCollection.findOne(query, option);
      res.send(result);
    });

    //Users Role Change
    app.patch(
      "/admin/users/role/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // Cart Upload
    app.post("/cart", verifyJWT, verifyStudent, async (req, res) => {
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
    app.delete("/cart/:id", verifyJWT, async (req, res) => {
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

    // Payment Intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const amountFixed = parseInt(amount.toFixed(2));
      if (amountFixed > 0) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountFixed,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    //Payment to db
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const inserted = await paymentsCollection.insertOne(payment);

      const deleteQuery = {
        _id: { $in: payment.cart_ids.map((id) => new ObjectId(id)) },
      };
      const deleted = await cartCollection.deleteMany(deleteQuery);

      const updatedQuery = {
        _id: { $in: payment.classes_ids.map((id) => new ObjectId(id)) },
      };

      const updatedDoc = {
        $push: {
          students: payment.email,
        },
      };

      const updated = await classCollection.updateMany(
        updatedQuery,
        updatedDoc
      );

      res.send({ inserted, deleted, updated });
    });

    // Get Payment History
    app.get("/payments/:email", verifyJWT, verifyStudent, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentsCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Seat Patch
    app.patch("/classes/seat/:id", verifyJWT, async (req, res) => {
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
    app.get("/classes/seat/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query, {
        projection: { seats: 1 },
      });
      res.send(result);
    });

    //Get Enrolled Classes
    app.get(
      "/classes/enrolled/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;
        const query = { students: { $elemMatch: { $eq: email } } };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      }
    );

    // delete Class
    app.delete("/teacher/class/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    // Student Count
    //Getting student from db
    app.get("/student/count", async (req, res) => {
      try {
        const count = await userCollection.countDocuments({ role: "student" });

        res.json({ count });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error counting users" });
      }
    });

    // Admin Stats
    app.get("/admin/stats", verifyJWT, verifyAdmin, async (req, res) => {
      const studentQuery = { role: "student" };
      const instructorQuery = { role: "instructor" };
      const students = await userCollection.countDocuments(studentQuery);
      const instructors = await userCollection.countDocuments(instructorQuery);
      const classes = await classCollection.countDocuments();
      const payment = await paymentsCollection.find().toArray();
      const totalIncomeRaw = payment.reduce((sum, item) => item.price + sum, 0);
      const totalIncome = parseFloat(totalIncomeRaw.toFixed(2));
      res.send({ students, instructors, classes, totalIncome });
    });

    // Instructor Stats
    app.get(
      "/instructor/stats/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { instructor_email: email };
        const approveQuery = {
          $and: [{ instructor_email: email }, { status: "approved" }],
        };
        const deniedQuery = {
          $and: [{ instructor_email: email }, { status: "denied" }],
        };
        const pendingQuery = {
          $and: [{ instructor_email: email }, { status: "pending" }],
        };
        const classes = await classCollection.countDocuments(query);
        const approved = await classCollection.countDocuments(approveQuery);
        const denied = await classCollection.countDocuments(deniedQuery);
        const pending = await classCollection.countDocuments(pendingQuery);
        const students = await classCollection.find(query).toArray();
        const enrolledStudents = students.reduce(
          (sum, student) => student.students.length + sum,
          0
        );
        res.send({ classes, enrolledStudents, approved, denied, pending });
      }
    );

    // Student Stats
    app.get(
      "/student/stats/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const enrolledQuery = { students: { $elemMatch: { $eq: email } } };
        const enrolledClasses = await classCollection.countDocuments(
          enrolledQuery
        );
        const payment = await paymentsCollection.find(query).toArray();
        const totalSpent = payment.reduce((sum, item) => item.price + sum, 0);
        res.send({ enrolledClasses, totalSpent });
      }
    );

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
