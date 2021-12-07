const app = require("express")();
const cors = require("cors");
const http = require("http").createServer(app);

const { MongoClient } = require("mongodb");

const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("running app");
});

http.listen(port, () => {
    console.log(`listening on *:${port}`);
});

//middleware
app.use(cors());
const io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// mongodb connections
const uri =
    "mongodb+srv://mahmud:mahmud@cluster0.bxr3c.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = client.db("calculator");
const collection = db.collection("calculations");

app.get("/calculations", async (request, response) => {
    try {
        const cursor = collection.find({});
        const results = await cursor.toArray();
        response.send(results[0]);
    } catch (e) {
        response.status(500).send({ message: e.message });
    }
});

const serverFunction = async () => {
    try {
        await client.connect();

        // app.get('/calculations', async (req, res) => {

        // });

        io.on("connection", (socket) => {
            socket.emit("connection", null);

            socket.on("calculate", async (data) => {
                //if result is fraction value then set precision on it
                try {
                    let calculatedResult =
                        calculateInput(data.input) % 1
                            ? calculateInput(data.input).toPrecision(3)
                            : calculateInput(data.input);

                    const cursor = collection.find({});
                    const results = await cursor.toArray();
                    let result;
                    let array = [];
                    array = [
                        ...array,
                        {
                            title: data.title,
                            result: calculatedResult,
                            input: data.input,
                        },
                    ];
                    if (results.length > 0) {
                        const filter = { _id: results[0]._id };
                        const updateDoc = {
                            $set: {
                                allResults: [
                                    ...results[0].allResults,
                                    {
                                        title: data.title,
                                        result: calculatedResult,
                                        input: data.input,
                                    },
                                ],
                            },
                        };
                        // console.log(result);
                        result = await collection.updateOne(filter, updateDoc);
                        // console.log("array :", array);
                    } else {
                        // console.log("array2 :", array);
                        result = await collection.insertOne({
                            allResults: [
                                {
                                    title: data.title,
                                    result: calculatedResult,
                                    input: data.input,
                                },
                            ],
                        });
                    }
                    setTimeout(function () {
                        io.emit("result", {
                                title: data.title,
                                result: calculatedResult,
                                input: data.input,
                        });
                    }, 15000);
                } catch {
                    io.emit("result", {
                        error: "Invalid Expression",
                    });
                }
            });

            socket.on("updateResults", async (data) => {
                const cursor = collection.find({});
                const results = await cursor.toArray();
                let result;
                const filter = { _id: results[0]._id };
                const updateDoc = { $set: { allResults: data.results } };
                result = await collection.updateOne(filter, updateDoc);
                io.emit(
                    "allResults",
                    await collection.find({}).toArray()
                );
            });
        });
    } finally {
        //
    }
}
serverFunction().catch(console.dir);

function calculateInput(fn) {
    return eval(fn);
}
