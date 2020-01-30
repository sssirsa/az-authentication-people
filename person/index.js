const mongodb = require('mongodb');
let cosmos_client = null;
let mongo_client = null;
const connection_cosmosDB = process.env["connection_cosmosDB"];
const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env['MONGO_DB_NAME'];

module.exports = async function (context, req) {
    switch (req.method) {
        case "GET":
            GET_person();
            break;
        case "POST":
            POST_person();
            break;
        default:
            notAllowed();
            break;
    }

    function notAllowed() {
        context.res = {
            status: 405,
            body: "Method not allowed",
            headers: {
                'Content-Type': 'application/json'
            }
        };
        context.done();
    }

    function GET_person() {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        try {
            if (requestedID) {

                let person = await getPerson(requestedID);
                context.res = {
                    body: person,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            else {
                let people = await getPeople();
                context.res = {
                    body: people,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
        }
        catch (error) {
            context.res(error);
            context.done();
        }
        function getPerson(id) {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('Person')
                        .findOne({ _id: mongodb.ObjectID(id) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                                if (docs) {
                                    resolve(docs);
                                }
                                else {
                                    reject({
                                        status: 404,
                                        body: {},
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                            }
                        );
                }
                catch (error) {
                    context.log(error);
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
            });
        }
        function getPeople() {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('Person')
                        .find()
                        .toArray(function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                });
                            }
                        });
                        resolve(docs);
                }
                catch(error){
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });
        }
    }

    function POST_person() {

    }

    function createCosmosClient() {
        return new Promise(function (resolve, reject) {
            if (!cosmos_client) {
                mongodb.MongoClient.connect(connection_cosmosDB, function (error, _cosmos_client) {
                    if (error) {
                        reject(error);
                    }
                    cosmos_client = _cosmos_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

    function createMongoClient() {
        return new Promise(function (resolve, reject) {
            if (!mongo_client) {
                mongodb.MongoClient.connect(connection_mongoDB, function (error, _mongo_client) {
                    if (error) {
                        reject(error);
                    }
                    mongo_client = _mongo_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

};