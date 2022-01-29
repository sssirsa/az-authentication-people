
const mongodb = require("mongodb");
let mongo_client = null;

// database
const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env["MONGO_DB_NAME"];

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET_JWT_SEED = process.env["SECRET_JWT_SEED"];

module.exports = function (context, req) {
  switch (req.method) {
    case "POST":
      POST_login();
      break;
    default:
      notAllowed();
      break;
  }

  function notAllowed() {
    context.res = {
      status: 405,
      body: "Method not allowed",
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  async function POST_login() {
    let userName = req.body["username"];
    let userPassword = req.body["password"];
    try {
      validate();
      let user = await searchUser();
      if (bcrypt.compareSync(userPassword, user.password)) {
        const token = await generarJWT(user._id, userName);
        const person = await searchPerson(user["person_id"].toString());
        const date_access = new Date();
        const userUpdate = { date_access };
        let query = { _id: mongodb.ObjectID(req.query["user._id"]) };
        await updateUser(userUpdate, query);
        let response = {
          access_token: token,
          person,
        };
        context.res = {
          status: 200,
          body: response,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      } else {
        context.res = {
          status: 401,
          body: "AU-015",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    } catch (error) {
      context.res = error;
      context.done();
    }

    //Internal functions
    function validate() {
      if (!userName) {
        context.res = {
          status: 400,
          body: { message: "AU-013" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      if (!userPassword) {
        context.res = {
          status: 400,
          body: { message: "AU-014" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    }

    async function searchUser() {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne({ username: userName }, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              if (!docs) {
                reject({
                  status: 401,
                  body: "AU-001",
                  headers: { "Content-Type": "application/json" },
                });
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function searchPerson(personId) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles")
            .findOne(
              { _id: mongodb.ObjectID(personId) },
              function (error, docs) {
                if (error) {
                  reject({
                    status: 500,
                    body: error.toString(),
                    headers: { "Content-Type": "application/json" },
                  });
                  return;
                }
                if (!docs) {
                  reject({
                    status: 401,
                    body: "AU-011",
                    headers: { "Content-Type": "application/json" },
                  });
                }
                resolve(docs);
              }
            );
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function updateUser(options, query) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .updateOne(query, { $set: options }, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function generarJWT(uid, name) {
      const payload = { uid, name };
      return new Promise((resolve, reject) => {
        jwt.sign(
          payload,
          SECRET_JWT_SEED,
          {
            expiresIn: "24h",
          },
          (error, token) => {
            if (error) {
              reject(error);
            } else {
              resolve(token);
            }
          }
        );
      });
    }
  }

  //Internal globals
  function createMongoClient() {
    return new Promise(function (resolve, reject) {
      if (!mongo_client) {
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
      } else {
        resolve();
      }
    });
  }
};
