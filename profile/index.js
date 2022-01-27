const mongodb = require("mongodb");
let mongo_client = null;

const connection_mongoDB =
  "mongodb+srv://devops:59LzYD00s3q9JK2s@cluster0-qrhyj.mongodb.net?retryWrites=true&w=majority";
const MONGO_DB_NAME = "management";

const validator = require("validator");

// constants environment
const AZURE_STORAGE_CONNECTION_STRING =
  process.env["AUTH_AZURE_STORAGE_CONNECTION_STRING"];
const STORAGE_ACCOUNT_NAME = process.env["AZURE_STORAGE_ACCOUNT_NAME"];

module.exports = function (context, req) {
  switch (req.method) {
    case "GET":
      GET_profile();
      break;
    case "POST":
      POST_profile();
      break;
    case "PUT":
      PUT_profile();
      break;
    default:
      notAllowed();
      break;
  }

  async function GET_profile() {
    let requestedID;
    if (req.query) requestedID = req.query["id"];
    try {
      if (requestedID) {
        let person = await getPerson(requestedID);
        context.res = {
          body: person,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      } else {
        let people = await getPeople();
        context.res = {
          body: people,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    } catch (error) {
      context.res = error;
      context.done();
    }

    // Internal functions

    async function getPerson(id) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles_test")
            .aggregate([
              { $match: { _id: mongodb.ObjectID(id) } },
              { $project: { password: 0 } },
            ])
            .toArray(function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error,
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (docs) {
                resolve(docs);
              } else {
                reject({
                  status: 404,
                  body: {},
                  headers: { "Content-Type": "application/json" },
                });
              }
            });
        } catch (error) {
          context.log(error);
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function getPeople() {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles_test")
            .aggregate([
              {
                $project: { password: 0 },
              },
            ])
            .toArray(function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              }
              if (docs) {
                resolve(docs);
              } else {
                reject({
                  status: 404,
                  body: {},
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              }
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      });
    }
  }

  function notAllowed() {
    context.res = {
      status: 405,
      body: "Method not allowed",
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  function createMongoClient() {
    return new Promise(function (resolve, reject) {
      if (mongo_client) resolve();
      mongodb.MongoClient.connect(
        connection_mongoDB,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        function (error, _mongo_client) {
          if (error) reject(error);
          mongo_client = _mongo_client;
          resolve();
        }
      );
    });
  }
};
