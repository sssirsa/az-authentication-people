const mongodb = require("mongodb");
let mongo_client = null;

const connection_mongoDB =
  "mongodb+srv://devops:59LzYD00s3q9JK2s@cluster0-qrhyj.mongodb.net?retryWrites=true&w=majority";
const MONGO_DB_NAME = "management";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET_JWT_SEED = "e201994dca9320fc94336603b1cfc970";

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
      console.log("validate pass");
      let user = await searchUser();
      if (bcrypt.compareSync(userPassword, user.password)) {
        const token = await generarJWT(user._id, userName);
        const person = await searchPerson(user["person_id"].toString());
        let response = {
          access_token: token,
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
          status: 401,
          body: "Invalid password",
          headers: {
            "Content-Type": "application/json",
          },
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
          body: { message: "No se ha recibido el usuario" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      if (!userPassword) {
        context.res = {
          status: 400,
          body: { message: "No se ha recibido la contraseña" },
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
            .collection("usuarios")
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
                  body: "Invalid username",
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
            .collection("profiles_test")
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
                    body: "Not found person",
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
