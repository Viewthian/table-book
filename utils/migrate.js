require('dotenv').config();
const mongoose = require("mongoose");

async function migrate() {
    const oldConn = await mongoose.createConnection(process.env.OLD_MONGODB_URI).asPromise();
    const newConn = await mongoose.createConnection(process.env.NEW_MONGODB_URI).asPromise();

    const collections = await oldConn.db.listCollections().toArray();

    for (const col of collections) {
        console.log(`Copying ${col.name}`);

        const docs = await oldConn.db.collection(col.name).find({}).toArray();

        if (docs.length) {
            await newConn.db.collection(col.name).insertMany(docs);
        }

        console.log(`Copied ${docs.length} documents`);
    }

    console.log("Migration complete.");

    await oldConn.close();
    await newConn.close();
}

migrate().catch(console.error);