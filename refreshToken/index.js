const jwt = require("jsonwebtoken");
const mongodb = require("mongodb");

//? database environment variables
const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env["MONGO_DB_NAME"];
const SECRET_JWT_SEED = process.env["SECRET_JWT_SEED"];

let mongo_client = null;

module.exports = function (context, req) {
  switch (req.method) {
    case "GET":
      GET_refreshToken();
      break;
    default:
      notAllowed();
      break;
  }

  async function GET_refreshToken() {
    try {
      let token;
      const authHeader = req.headers.authorization;
      //! not token sended in headers
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = {
          status: 400,
          body: { code: "AU-016" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      token = authHeader.substring(7, authHeader.length);
      const { uid, name } = jwt.verify(token, SECRET_JWT_SEED);
      const access_token = await generateJWT(uid, name);
      let user = await searchUser(name);
      const person = await searchPerson(user["person_id"].toString());
      const last_access = new Date();
      const userUpdate = { last_access };
      let query = { _id: mongodb.ObjectID(uid) };
      await updateUser(userUpdate, query);
      let response = { access_token, person };
      context.res = {
        status: 200,
        body: response,
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    } catch (error) {
      context.res = {
        status: 500,
        body: error.toString(),
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    }

    async function searchUser(name) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne({ username: name }, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (!docs) {
                reject({
                  status: 401,
                  body: { code: "AU-001" },
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
                }
                if (!docs) {
                  reject({
                    status: 401,
                    body: { code: "AU-011" },
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

    async function generateJWT(uid, name) {
      const payload = { uid, name };
      return new Promise((resolve, reject) => {
        jwt.sign(
          payload,
          SECRET_JWT_SEED,
          {
            expiresIn: "24h",
          },
          (error, token) => {
            error ? reject(error) : resolve(token);
          }
        );
      });
    }
  }

  function notAllowed() {
    context.res = {
      status: 405,
      body: { code: "AU-017" },
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  //? Internal globals
  async function createMongoClient() {
    return new Promise((resolve, reject) => {
      //* already mongo_client exists
      if (mongo_client) resolve();
      mongodb.MongoClient.connect(
        connection_mongoDB,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        (error, _mongo_client) => {
          if (error) reject(error);
          mongo_client = _mongo_client;
          resolve();
        }
      );
    });
  }
};
