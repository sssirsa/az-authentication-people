const mongodb = require("mongodb");
let mongo_client = null;

// middlewares
const jwt = require("jsonwebtoken");

const SECRET_JWT_SEED = process.env["SECRET_JWT_SEED"];

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
      if (req.headers.authorization.startsWith("Bearer ")) {
        const authHeader = req.headers.authorization;
        token = authHeader.substring(7, authHeader.length);
        const { uid, name } = jwt.verify(token, SECRET_JWT_SEED);
        const newToken = await generarJWT(uid, name);
        let user = await searchUser(name);
        const person = await searchPerson(user["person_id"].toString());
        let response = {
          access_token: newToken,
          person,
        };
        context.res = {
          status: 200,
          body: response,
          headers: {
            "Content-Type": "application/json",
          },
        };
        context.done();
      } else {
        context.res = {
          status: 405,
          body: "AU-016",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
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
              // todo mal
              console.log(error);
              reject(error);
            } else {
              resolve(token);
            }
          }
        );
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
